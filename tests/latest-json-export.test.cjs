'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-persistence.js'), 'utf8');

function exportHarness({ pickerSupported = true, savePickerSupported = true, pickerName = 'latest.json', persistedHandle = false,
    permissionState = 'granted', permissionAfterRequest = 'granted', writeError = null,
    backupClickError = null, pickerError = null } = {}) {
    const downloads = [];
    const writes = [];
    const alerts = [];
    const toasts = [];
    const savedHandles = [];
    const deletedHandles = [];
    const buttons = [{ disabled: false }, { disabled: false }];
    let pickerCalls = 0;
    let closes = 0;
    let aborts = 0;
    let queryCalls = 0;
    let permissionRequests = 0;
    const handle = {
        kind: 'file',
        name: pickerName,
        async queryPermission() { queryCalls += 1; return permissionState; },
        async requestPermission() { permissionRequests += 1; return permissionAfterRequest; },
        async createWritable() {
            return {
                async write(blob) {
                    if (writeError) throw writeError;
                    writes.push(await blob.text());
                },
                async close() { closes += 1; },
                async abort() { aborts += 1; }
            };
        }
    };
    class MaintenanceApp {}
    const window = {};
    if (pickerSupported) {
        if (savePickerSupported) {
            window.showSaveFilePicker = async options => {
                pickerCalls += 1;
                assert.equal(options.suggestedName, 'latest.json');
                if (pickerError) throw pickerError;
                return handle;
            };
        }
        window.showOpenFilePicker = async options => {
            pickerCalls += 1;
            assert.ok(Array.isArray(options.types));
            if (pickerError) throw pickerError;
            return [handle];
        };
    }
    const store = {
        data: {
            currentDepartmentId: 'dept_default',
            departments: [{ id: 'dept_default', name: '工程' }]
        },
        exportAsJSON() { return '{"scope":"all"}'; },
        exportCurrentDeptAsJSON() { return '{"scope":"dept"}'; },
        async saveMediaFileHandle(id, savedHandle) { savedHandles.push({ id, handle: savedHandle }); },
        async loadMediaFileHandle(id) {
            assert.equal(id, 'maintenance_latest_json_file');
            return persistedHandle ? handle : null;
        },
        async deleteMediaBlob(id) { deletedHandles.push(id); }
    };
    const document = {
        querySelectorAll(selector) {
            assert.equal(selector, '.backup-export-choice');
            return buttons;
        },
        getElementById() { return null; },
        createElement(tag) {
            assert.equal(tag, 'a');
            return {
                download: '',
                click() {
                    if (backupClickError) throw backupClickError;
                    downloads.push(this.download);
                }
            };
        }
    };
    const context = vm.createContext({
        MaintenanceApp, store, document, window, Blob,
        URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
        setTimeout(callback) { callback(); },
        alert(message) { alerts.push(message); },
        console: { warn() {}, error() {} }
    });
    vm.runInContext(source, context, { filename: 'app-persistence.js' });
    const app = Object.create(MaintenanceApp.prototype);
    app.getLocalDateString = () => '2026-11-14';
    app.closeModal = () => {};
    app.showToast = (...values) => { toasts.push(values); };
    app.openPendingImportResultIfAny = () => {};
    return {
        app, downloads, writes, alerts, toasts, savedHandles, deletedHandles, buttons,
        get pickerCalls() { return pickerCalls; },
        get closes() { return closes; },
        get aborts() { return aborts; },
        get queryCalls() { return queryCalls; },
        get permissionRequests() { return permissionRequests; }
    };
}

test('first full export writes only latest.json through the save picker', async () => {
    const h = exportHarness();
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 1);
    assert.deepEqual(h.writes, ['{"scope":"all"}']);
    assert.equal(h.closes, 1);
    assert.equal(h.savedHandles[0].id, 'maintenance_latest_json_file');
    assert.equal(h.downloads.length, 0);
    assert.equal(h.app._lastLatestJsonExport.kind, 'file');
    assert.equal(h.alerts.length, 0);
    assert.ok(h.buttons.every(button => button.disabled === false));
});

test('later full export reuses the same file handle without another picker or latest.json download', async () => {
    const h = exportHarness();
    await h.app.exportOptimizedBackup('light', 'all');
    await h.app.exportOptimizedBackup('complete', 'all');

    assert.equal(h.pickerCalls, 1);
    assert.deepEqual(h.writes, ['{"scope":"all"}', '{"scope":"all"}']);
    assert.equal(h.closes, 2);
    assert.equal(h.downloads.length, 0);
});

test('a previously saved handle is loaded on startup and reused without opening a picker', async () => {
    const h = exportHarness({ persistedHandle: true });
    h.app.setupSideEffects();
    await Promise.resolve();
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 0);
    assert.deepEqual(h.writes, ['{"scope":"all"}']);
    assert.equal(h.queryCalls, 1);
    assert.equal(h.alerts.length, 0);
});

test('a saved handle requests write permission again before reuse', async () => {
    const h = exportHarness({ persistedHandle: true, permissionState: 'prompt' });
    h.app.setupSideEffects();
    await Promise.resolve();
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 0);
    assert.equal(h.queryCalls, 1);
    assert.equal(h.permissionRequests, 1);
    assert.deepEqual(h.writes, ['{"scope":"all"}']);
});

test('without a file picker, one latest.json download is started', async () => {
    const h = exportHarness({ pickerSupported: false });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0], 'latest.json');
    assert.equal(h.writes.length, 0);
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /直接上書きを利用できません/);
    assert.equal(h.app._lastLatestJsonExport.kind, 'download');
});

test('when only the open picker exists, it still overwrites selected latest.json', async () => {
    const h = exportHarness({ savePickerSupported: false });
    await h.app.exportOptimizedBackup('light', 'all');
    assert.equal(h.pickerCalls, 1);
    assert.equal(h.writes.length, 1);
    assert.equal(h.downloads.length, 0);
});

test('canceling the picker produces no file', async () => {
    const h = exportHarness({ pickerError: Object.assign(new Error('Canceled'), { name: 'AbortError' }) });
    await h.app.exportOptimizedBackup('light', 'all');
    assert.equal(h.writes.length, 0);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.alerts.length, 0);
    assert.ok(h.buttons.every(button => button.disabled === false));
});

test('choosing a differently named file never writes to it', async () => {
    const h = exportHarness({ pickerName: 'other.json' });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 1);
    assert.equal(h.writes.length, 0);
    assert.equal(h.savedHandles.length, 0);
    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0], 'latest.json');
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /保存先には latest\.json/);
});

test('failed latest.json write starts only one latest.json download and removes the unusable handle', async () => {
    const h = exportHarness({ writeError: new Error('Disk full') });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0], 'latest.json');
    assert.equal(h.writes.length, 0);
    assert.equal(h.closes, 0);
    assert.equal(h.aborts, 1);
    assert.deepEqual(h.deletedHandles, ['maintenance_latest_json_file']);
    assert.equal(h.app._latestJsonFileHandle, null);
    assert.equal(h.app._latestJsonForcePicker, true);
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /Disk full/);
});

test('a stale persisted handle with the wrong filename is removed without writing', async () => {
    const h = exportHarness({ persistedHandle: true, pickerName: 'other.json' });
    h.app.setupSideEffects();
    await Promise.resolve();
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 0);
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.deletedHandles, ['maintenance_latest_json_file']);
    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0], 'latest.json');
    assert.match(h.alerts[0], /保存先が latest\.json ではありません/);
});

test('successful direct latest.json write never triggers a second download', async () => {
    const h = exportHarness({ backupClickError: new Error('Download blocked') });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.deepEqual(h.writes, ['{"scope":"all"}']);
    assert.equal(h.closes, 1);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.alerts.length, 0);
});

test('department export remains a single dated download and never requests latest.json', async () => {
    const h = exportHarness();
    await h.app.exportOptimizedBackup('complete', 'dept');

    assert.equal(h.pickerCalls, 0);
    assert.equal(h.downloads.length, 1);
    assert.match(h.downloads[0], /^maintenance_工程_complete_\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(h.writes.length, 0);
    assert.equal(h.savedHandles.length, 0);
});
