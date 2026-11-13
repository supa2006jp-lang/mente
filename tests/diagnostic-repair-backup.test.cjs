'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-settings.js'), 'utf8');

function makeHarness({ backupResult = { method: 'file' }, saveFails = false } = {}) {
    class MaintenanceApp {}
    const events = [];
    const alerts = [];
    const activeData = {
        photoManagerNames: { missing: '以前の名前' },
        archivedMaintenanceTasks: ['invalid-periodic', 'valid-periodic'],
        archivedGuides: [],
        archivedTasks: []
    };
    const store = {
        activeData,
        data: { currentDepartmentId: 'dept_default' },
        _saveRequestedRevision: 0,
        exportAsJSON() { events.push('export'); return '{"mainData":{}}'; },
        async save() {
            events.push('save');
            if (saveFails) throw new Error('save failed');
        }
    };
    const context = vm.createContext({
        MaintenanceApp, store,
        confirm: () => true,
        alert: message => alerts.push(message),
        console: { error() {} }
    });
    vm.runInContext(source, context, { filename: 'app-settings.js' });
    const app = new MaintenanceApp();
    app.collectOrphanPhotoManagerMetadata = () => [{ key: 'photoManagerNames', id: 'missing' }];
    app.getBrokenDataReport = () => ({ archivedMaintenanceTasks: ['invalid-periodic'], archivedGuides: [], archivedTasks: [] });
    app.beginVerifiedSafetyBackup = filename => {
        events.push('begin');
        assert.match(filename, /^maintenance_before_diagnostics_repair_.*\.json$/);
        return { kind: 'file' };
    };
    app.buildCompleteBackupJson = async json => { events.push('build'); return json; };
    app.saveVerifiedSafetyBackup = async () => { events.push('backup'); return backupResult; };
    app.addSystemActivityLog = () => events.push('log');
    app.showToast = () => events.push('toast');
    app.openScheduledDataDiagnosticsPanel = () => events.push('refresh');
    return { app, store, activeData, events, alerts };
}

test('diagnostic repair waits for a completed backup before editing records', async () => {
    const { app, activeData, events } = makeHarness();
    await app.autoRepairSafeDataIssues();

    assert.deepEqual(events.slice(0, 5), ['begin', 'export', 'build', 'backup', 'save']);
    assert.equal(activeData.photoManagerNames.missing, undefined);
    assert.deepEqual(Array.from(activeData.archivedMaintenanceTasks), ['valid-periodic']);
    assert.equal(app._diagnosticRepairInProgress, false);
});

test('diagnostic repair leaves records intact when backup is cancelled', async () => {
    const { app, activeData, events } = makeHarness({ backupResult: null });
    await app.autoRepairSafeDataIssues();

    assert.equal(events.includes('backup'), true);
    assert.equal(events.includes('save'), false);
    assert.equal(activeData.photoManagerNames.missing, '以前の名前');
    assert.deepEqual(Array.from(activeData.archivedMaintenanceTasks), ['invalid-periodic', 'valid-periodic']);
    assert.equal(app._diagnosticRepairInProgress, false);
});

test('diagnostic repair restores the in-memory data if saving fails', async () => {
    const { app, activeData, events, alerts } = makeHarness({ saveFails: true });
    await app.autoRepairSafeDataIssues();

    assert.equal(events.includes('save'), true);
    assert.equal(activeData.photoManagerNames.missing, '以前の名前');
    assert.deepEqual(Array.from(activeData.archivedMaintenanceTasks), ['invalid-periodic', 'valid-periodic']);
    assert.match(alerts[0], /save failed/);
});

test('orphan metadata cleanup also requires the completed backup', async () => {
    const cancelled = makeHarness({ backupResult: null });
    await cancelled.app.confirmCleanOrphanPhotoManagerMetadata();
    assert.equal(cancelled.activeData.photoManagerNames.missing, '以前の名前');
    assert.equal(cancelled.events.includes('save'), false);

    const completed = makeHarness();
    await completed.app.confirmCleanOrphanPhotoManagerMetadata();
    assert.equal(completed.activeData.photoManagerNames.missing, undefined);
    assert.ok(completed.events.indexOf('backup') < completed.events.indexOf('save'));
});

test('diagnostic repair stops if a save starts while the backup is being confirmed', async () => {
    const { app, store, activeData, events, alerts } = makeHarness();
    app.saveVerifiedSafetyBackup = async () => {
        events.push('backup');
        store._saveRequestedRevision++;
        return { method: 'file' };
    };
    await app.autoRepairSafeDataIssues();

    assert.equal(events.includes('save'), false);
    assert.equal(activeData.photoManagerNames.missing, '以前の名前');
    assert.deepEqual(Array.from(activeData.archivedMaintenanceTasks), ['invalid-periodic', 'valid-periodic']);
    assert.match(alerts[0], /データが変わりました/);
});

test('metadata cleanup stops when the target department changes during backup', async () => {
    const { app, store, activeData, events, alerts } = makeHarness();
    app.saveVerifiedSafetyBackup = async () => {
        events.push('backup');
        store.data.currentDepartmentId = 'other-department';
        return { method: 'file' };
    };
    await app.confirmCleanOrphanPhotoManagerMetadata();

    assert.equal(events.includes('save'), false);
    assert.equal(activeData.photoManagerNames.missing, '以前の名前');
    assert.match(alerts[0], /データが変わりました/);
});

test('failed repair restores removed records without dropping edits made during the save', async () => {
    const { app, store, activeData } = makeHarness();
    store.save = async () => {
        activeData.archivedMaintenanceTasks.push('new-periodic');
        activeData.photoManagerNames.new = '新しい名前';
        throw new Error('save failed');
    };
    await app.autoRepairSafeDataIssues();

    assert.deepEqual(Array.from(activeData.archivedMaintenanceTasks), [
        'invalid-periodic', 'valid-periodic', 'new-periodic'
    ]);
    assert.equal(activeData.photoManagerNames.missing, '以前の名前');
    assert.equal(activeData.photoManagerNames.new, '新しい名前');
});

test('failed cleanup keeps a newly written value for a previously removed metadata key', async () => {
    const { app, store, activeData } = makeHarness();
    store.save = async () => {
        activeData.photoManagerNames.missing = '新しく更新した名前';
        throw new Error('save failed');
    };
    await app.confirmCleanOrphanPhotoManagerMetadata();

    assert.equal(activeData.photoManagerNames.missing, '新しく更新した名前');
});

test('failed repair restores every occurrence of a duplicate broken reference', async () => {
    const { app, activeData } = makeHarness({ saveFails: true });
    activeData.archivedMaintenanceTasks.push('invalid-periodic');
    await app.autoRepairSafeDataIssues();

    assert.deepEqual(Array.from(activeData.archivedMaintenanceTasks), [
        'invalid-periodic', 'valid-periodic', 'invalid-periodic'
    ]);
});
