const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const readAppFile = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function startApp({ savedRecord = null, legacyRecord = null, legacyRecordV1 = null, legacyRawV2 = null,
    failOpen = false, blockOpen = false, abortRead = false, abortSave = false,
    getItemErrorKeys = [], url = 'https://example.com/mente/' } = {}) {
    const listeners = new Map();
    const localValues = new Map();
    if (legacyRecord) localValues.set('factory_maintenance_next_data_v2', JSON.stringify(legacyRecord));
    if (legacyRecordV1) localValues.set('factory_maintenance_next_data', JSON.stringify(legacyRecordV1));
    if (legacyRawV2) localValues.set('factory_maintenance_next_data_v2', legacyRawV2);
    const blockedLocalKeys = new Set(getItemErrorKeys);
    const opened = [];
    const committed = [];
    const saveStatuses = [];
    let alerts = 0;
    let appStarts = 0;
    const window = {
        location: { href: url },
        history: {
            state: null,
            replaceState(_state, _unused, nextUrl) { window.location.href = nextUrl; }
        },
        addEventListener(name, handler) { listeners.set(name, handler); },
        dispatchEvent(event) {
            if (event.type === 'maintenance-save-status') saveStatuses.push(event.detail.status);
        },
        setTimeout() {}
    };
    const database = {
        close() {},
        transaction(storeName, mode) {
            assert.equal(storeName, 'state');
            assert.ok(['readonly', 'readwrite'].includes(mode));
            const tx = {
                objectStore() {
                    return {
                        get(key) {
                            assert.equal(key, 'factory_maintenance_next_data_v2');
                            const request = {};
                            queueMicrotask(() => {
                                if (abortRead) {
                                    tx.error = new Error('Read aborted');
                                    tx.onabort();
                                    return;
                                }
                                request.result = savedRecord;
                                request.onsuccess();
                            });
                            return request;
                        },
                        put(value, key) {
                            assert.equal(mode, 'readwrite');
                            assert.equal(key, 'factory_maintenance_next_data_v2');
                            const request = {};
                            queueMicrotask(() => {
                                if (abortSave) {
                                    tx.error = new Error('Transaction aborted');
                                    tx.onabort();
                                } else {
                                    committed.push({ key, value });
                                    tx.oncomplete();
                                }
                            });
                            return request;
                        }
                    };
                }
            };
            return tx;
        }
    };
    const context = vm.createContext({
        window,
        URL,
        localStorage: {
            getItem(key) {
                if (blockedLocalKeys.has(key)) throw new Error(`Unavailable: ${key}`);
                return localValues.get(key) ?? null;
            },
            setItem(key, value) { localValues.set(key, String(value)); }
        },
        indexedDB: {
            open(name, version) {
                opened.push({ name, version });
                const request = {};
                queueMicrotask(() => {
                    if (failOpen) {
                        request.error = new Error('IndexedDB unavailable');
                        request.onerror({ target: request });
                    } else if (blockOpen) {
                        request.onblocked();
                    } else {
                        request.result = database;
                        request.onsuccess({ target: request });
                    }
                });
                return request;
            }
        },
        MaintenanceApp: class {
            constructor() { appStarts += 1; }
        },
        CustomEvent: class {
            constructor(type, options) { this.type = type; this.detail = options.detail; }
        },
        alert() { alerts += 1; },
        console: { error() {}, warn() {}, log() {} }
    });
    vm.runInContext(readAppFile('store.js'), context, { filename: 'store.js' });
    vm.runInContext(readAppFile('app-boot.js'), context, { filename: 'app-boot.js' });
    return {
        ready: () => listeners.get('DOMContentLoaded')(),
        window,
        opened,
        committed,
        localValues,
        saveStatuses,
        flush: () => new Promise(resolve => setImmediate(resolve)),
        get alerts() { return alerts; },
        get appStarts() { return appStarts; }
    };
}

const savedData = () => ({
    currentDepartmentId: 'dept_default',
    departments: [{ id: 'dept_default', name: '初期部署' }],
    deptData: { dept_default: { machines: [{ id: 'saved-machine', name: '保存済み' }] } },
    settings: { currentFile: 'latest.json', theme: 'light' }
});

test('existing IndexedDB v3 state loads and the app starts without a gate', async () => {
    const page = startApp({ savedRecord: savedData() });
    await page.ready();

    assert.deepEqual(page.opened, [{ name: 'FactoryMaintenanceDB', version: 3 }]);
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.window.store.startupStateSource, 'indexeddb');
    assert.equal(page.window.store.startupSaveSafe, true);
    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
});

test('IndexedDB open failure loads legacy localStorage and still starts the app', async () => {
    const page = startApp({ legacyRecord: savedData(), failOpen: true });
    await page.ready();

    assert.deepEqual(page.opened, [{ name: 'FactoryMaintenanceDB', version: 3 }]);
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.window.store.startupStateSource, 'localStorage');
    assert.equal(page.window.store.startupSaveSafe, false);
    assert.equal(page.committed.length, 0);
    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
});

test('IndexedDB fallback accepts edits and saves them in localStorage', async () => {
    const page = startApp({ failOpen: true });
    await page.ready();
    assert.equal(page.window.store.startupSaveSafe, false);
    page.window.store.activeData.machines.push({ id: 'new-machine' });
    await page.window.store.save();

    const saved = JSON.parse(page.localValues.get('factory_maintenance_next_data_v2'));
    assert.equal(saved.deptData.dept_default.machines[0].id, 'new-machine');
    assert.equal(page.saveStatuses.at(-1), 'saved');
    assert.equal(page.window.store.startupSaveSafe, true);
});

test('invalid empty localStorage candidate never enables a startup save', async () => {
    const page = startApp({ legacyRecord: {}, failOpen: true });
    await page.ready();
    assert.equal(page.window.store.startupStateSource, 'default');
    assert.equal(page.window.store.startupSaveSafe, false);
    assert.equal(page.committed.length, 0);
});

test('invalid IndexedDB state leaves startup read-only and uses a valid local candidate', async () => {
    const page = startApp({ savedRecord: {}, legacyRecord: savedData() });
    await page.ready();
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.window.store.startupStateSource, 'localStorage');
    assert.equal(page.window.store.startupSaveSafe, false);
    assert.equal(page.committed.length, 0);
    assert.match(page.window.store.storageWarning.message, /IndexedDB/);
});

test('corrupt current local candidate does not hide an older valid candidate', async () => {
    const page = startApp({ failOpen: true, legacyRawV2: '{bad', legacyRecordV1: savedData() });
    await page.ready();
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.window.store.startupStateSource, 'localStorage');
    assert.equal(page.window.store.startupSaveSafe, false);
});

test('single-department legacy state in IndexedDB is migrated when loaded', async () => {
    const page = startApp({ savedRecord: { machines: [{ id: 'old-machine' }], tasks: [], history: [] } });
    await page.ready();
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'old-machine');
    assert.equal(page.window.store.startupStateSource, 'indexeddb');
    assert.equal(page.committed.length, 0);
});

test('unreadable skill storage omits only that field from a complete export', async () => {
    const page = startApp({ savedRecord: savedData(), getItemErrorKeys: ['skillEvaluations'] });
    await page.ready();
    page.localValues.set('manualSkills', '[{"id":"skill-1"}]');
    const payload = JSON.parse(page.window.store.exportAsJSON());
    assert.equal(payload.mainData.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(Object.hasOwn(payload, 'skillEvaluations'), false);
    assert.equal(payload.manualSkills[0].id, 'skill-1');
    assert.match(page.window.store.lastExportWarnings[0], /skillEvaluations/);
});

test('malformed skill JSON is omitted without inventing an empty replacement', async () => {
    const page = startApp({ savedRecord: savedData() });
    await page.ready();
    page.localValues.set('manualSkills', '{bad');
    const payload = JSON.parse(page.window.store.exportAsJSON());
    assert.equal(Object.hasOwn(payload, 'manualSkills'), false);
    assert.equal(Object.hasOwn(payload, 'skillEvaluations'), true);
    assert.match(page.window.store.lastExportWarnings[0], /manualSkills/);
});

test('missing IndexedDB state starts without writing an empty initial state', async () => {
    const page = startApp();
    await page.ready();
    await page.flush();

    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
    assert.equal(page.committed.length, 0);
    assert.deepEqual(page.saveStatuses, []);
    assert.equal(page.window.store.startupStateSource, 'default');
    assert.equal(page.window.store.startupSaveSafe, false);

    page.window.store.activeData.machines.push({ id: 'first-edit' });
    await page.window.store.save();
    assert.equal(page.committed.length, 1);
    assert.equal(page.committed[0].key, 'factory_maintenance_next_data_v2');
    assert.equal(page.committed[0].value.deptData.dept_default.machines[0].id, 'first-edit');
    assert.ok(Date.parse(page.committed[0].value.settings.lastSuccessfulSaveAt));
    assert.deepEqual(page.saveStatuses, ['saving', 'saved']);
    assert.equal(page.window.store.startupSaveSafe, true);
});

test('missing IndexedDB state can show legacy data without overwriting it on startup', async () => {
    const page = startApp({ legacyRecord: savedData() });
    await page.ready();
    await page.flush();
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.committed.length, 0);
    assert.equal(page.window.store.startupStateSource, 'localStorage');
    assert.equal(page.window.store.startupSaveSafe, false);
});

test('blocked IndexedDB upgrade falls back to localStorage and starts the app', async () => {
    const page = startApp({ legacyRecord: savedData(), blockOpen: true });
    await page.ready();

    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
    assert.ok(page.window.store.storageWarning);
});

test('aborted IndexedDB read falls back and does not leave startup pending', async () => {
    const page = startApp({ legacyRecord: savedData(), abortRead: true });
    await page.ready();
    assert.equal(page.appStarts, 1);
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.ok(page.window.store.storageWarning);
});

test('aborted save reports error and never reports saved', async () => {
    const page = startApp({ savedRecord: savedData(), abortSave: true });
    await page.ready();
    await assert.rejects(page.window.store.save(), /Transaction aborted/);

    assert.deepEqual(page.saveStatuses, ['saving', 'error']);
    assert.equal(page.committed.length, 0);
    assert.equal(page.window.store.lastSuccessfulSaveAt, null);
    assert.equal(page.window.store.data.settings.lastSuccessfulSaveAt, undefined);
});

test('retired separate-workspace URL is canonicalized before opening the normal save area', async () => {
    const page = startApp({
        savedRecord: savedData(),
        url: 'https://example.com/mente/?workspace=separate&view=calendar#today'
    });
    await page.ready();

    assert.equal(page.window.location.href, 'https://example.com/mente/?view=calendar#today');
    assert.deepEqual(page.opened, [{ name: 'FactoryMaintenanceDB', version: 3 }]);
    assert.equal(page.appStarts, 1);
});
