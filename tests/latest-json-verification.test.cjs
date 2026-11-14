'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function makePage() {
    const values = new Map();
    const context = vm.createContext({
        window: {}, Blob, Date,
        localStorage: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, String(value)); }
        },
        console: { warn() {}, error() {} }
    });
    vm.runInContext(read('store.js'), context, { filename: 'store.js' });
    vm.runInContext(read('app.js'), context, { filename: 'app.js' });
    vm.runInContext(read('app-persistence.js'), context, { filename: 'app-persistence.js' });
    const app = vm.runInContext('Object.create(MaintenanceApp.prototype)', context);
    app.updateSaveStatus = () => {};
    return { app, store: context.window.store, values };
}

function backup(history = []) {
    return {
        mainData: {
            currentDepartmentId: 'dept_default',
            departments: [{ id: 'dept_default', name: '部署' }],
            deptData: { dept_default: { machines: [], tasks: [], history } },
            settings: { lastSuccessfulSaveAt: '2026-11-15T00:00:00.000Z' }
        },
        embeddedMedia: { version: 1, entries: [] }
    };
}

function fileOf(value) {
    const text = JSON.stringify(value);
    return { name: 'latest.json', size: Buffer.byteLength(text), text: async () => text };
}

test('saved latest.json is read and validated before recording a verified time', async () => {
    const page = makePage();
    const verified = await page.app.verifyLatestJsonBackupFile(fileOf(backup([{ id: 'history-1', photos: [] }])));
    assert.equal(verified.fileName, 'latest.json');
    assert.equal(verified.kind, 'complete');
    assert.equal(verified.savedAt, '2026-11-15T00:00:00.000Z');
    assert.ok(Date.parse(verified.at));
    assert.equal(page.values.get('maintenance_latest_json_verified_v1'), JSON.stringify(verified));
    assert.equal(page.app.getLatestJsonVerificationState().needsAction, false);
});

test('malformed backup does not become verified', async () => {
    const page = makePage();
    await assert.rejects(page.app.verifyLatestJsonBackupFile(fileOf(backup([
        { id: 'history-1', photos: { broken: true } }
    ]))), /history.*写真/);
    assert.equal(page.values.has('maintenance_latest_json_verified_v1'), false);
});

test('backup missing a referenced audio body is rejected', async () => {
    const page = makePage();
    const value = backup([]);
    value.mainData.deptData.dept_default.photoManagerAudios = [
        { id: 'audio-1', mediaKey: 'photo-manager-audio:dept_default:audio-1' }
    ];
    await assert.rejects(page.app.verifyLatestJsonBackupFile(fileOf(value)), /本体が含まれていません/);
    assert.equal(page.values.has('maintenance_latest_json_verified_v1'), false);
});

test('verification expires after seven days and a newer export requires rechecking', () => {
    const page = makePage();
    page.app._lastLatestJsonVerified = {
        at: new Date(Date.now() - 8 * 86400000).toISOString(),
        savedAt: new Date().toISOString()
    };
    assert.match(page.app.getLatestJsonVerificationState().text, /7日以上/);
    page.app._lastLatestJsonVerified = {
        at: new Date().toISOString(),
        savedAt: new Date(Date.now() - 8 * 86400000).toISOString()
    };
    assert.match(page.app.getLatestJsonVerificationState().text, /内容が7日以上/);
    page.app._lastLatestJsonVerified.savedAt = new Date().toISOString();
    page.app._lastLatestJsonExport = { at: new Date(Date.now() + 1000).toISOString() };
    assert.match(page.app.getLatestJsonVerificationState().text, /未検証/);
});
