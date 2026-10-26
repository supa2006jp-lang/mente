'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-persistence.js'), 'utf8');

function exportHarness({ pickerSupported = true, pickerName = 'latest.json', persistedHandle = false,
    permissionState = 'granted', permissionAfterRequest = 'granted', writeError = null,
    backupClickError = null } = {}) {
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
        window.showOpenFilePicker = async options => {
            pickerCalls += 1;
            assert.ok(Array.isArray(options.types));
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

test('first full export overwrites the selected existing latest.json and downloads only the dated backup', async () => {
    const h = exportHarness();
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 1);
    assert.deepEqual(h.writes, ['{"scope":"all"}']);
    assert.equal(h.closes, 1);
    assert.equal(h.savedHandles[0].id, 'maintenance_latest_json_file');
    assert.equal(h.downloads.length, 1);
    assert.match(h.downloads[0], /^maintenance_ALL_light_\d{4}-\d{2}-\d{2}\.json$/);
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
    assert.equal(h.downloads.length, 2);
    assert.ok(h.downloads.every(name => name !== 'latest.json'));
    assert.match(h.downloads[1], /^maintenance_ALL_complete_\d{4}-\d{2}-\d{2}\.json$/);
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

test('without a file picker, only the dated backup downloads and the user is told latest.json was not updated', async () => {
    const h = exportHarness({ pickerSupported: false });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.downloads.length, 1);
    assert.notEqual(h.downloads[0], 'latest.json');
    assert.equal(h.writes.length, 0);
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /latest\.json は更新していません/);
});

test('choosing a differently named file never writes to it', async () => {
    const h = exportHarness({ pickerName: 'other.json' });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.pickerCalls, 1);
    assert.equal(h.writes.length, 0);
    assert.equal(h.savedHandles.length, 0);
    assert.equal(h.downloads.length, 1);
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /latest\.json は更新していません/);
});

test('failed latest.json write leaves the dated backup and removes the unusable handle', async () => {
    const h = exportHarness({ writeError: new Error('Disk full') });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.equal(h.downloads.length, 1);
    assert.equal(h.writes.length, 0);
    assert.equal(h.closes, 0);
    assert.equal(h.aborts, 1);
    assert.deepEqual(h.deletedHandles, ['maintenance_latest_json_file']);
    assert.equal(h.app._latestJsonFileHandle, null);
    assert.equal(h.app._latestJsonForcePicker, true);
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /latest\.json は更新していません/);
    assert.equal(h.toasts.length, 0);
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
    assert.match(h.alerts[0], /latest\.json は更新していません/);
});

test('dated backup failure after latest.json write reports partial success', async () => {
    const h = exportHarness({ backupClickError: new Error('Download blocked') });
    await h.app.exportOptimizedBackup('light', 'all');

    assert.deepEqual(h.writes, ['{"scope":"all"}']);
    assert.equal(h.closes, 1);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.alerts.length, 1);
    assert.match(h.alerts[0], /latest\.json は更新しましたが/);
    assert.match(h.alerts[0], /日時付きバックアップを出力できませんでした/);
    assert.equal(h.toasts.length, 0);
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
