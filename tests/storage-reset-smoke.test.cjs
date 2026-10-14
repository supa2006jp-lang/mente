const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const readAppFile = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function startApp({ savedRecord = null, legacyRecord = null, failOpen = false, blockOpen = false,
    abortRead = false, abortSave = false, url = 'https://example.com/mente/' } = {}) {
    const listeners = new Map();
    const localValues = new Map();
    if (legacyRecord) localValues.set('factory_maintenance_next_data_v2', JSON.stringify(legacyRecord));
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
            getItem(key) { return localValues.get(key) ?? null; },
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
    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
});

test('IndexedDB open failure loads legacy localStorage and still starts the app', async () => {
    const page = startApp({ legacyRecord: savedData(), failOpen: true });
    await page.ready();

    assert.deepEqual(page.opened, [{ name: 'FactoryMaintenanceDB', version: 3 }]);
    assert.equal(page.window.store.data.deptData.dept_default.machines[0].id, 'saved-machine');
    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
});

test('IndexedDB fallback accepts edits and saves them in localStorage', async () => {
    const page = startApp({ failOpen: true });
    await page.ready();
    page.window.store.activeData.machines.push({ id: 'new-machine' });
    await page.window.store.save();

    const saved = JSON.parse(page.localValues.get('factory_maintenance_next_data_v2'));
    assert.equal(saved.deptData.dept_default.machines[0].id, 'new-machine');
    assert.equal(page.saveStatuses.at(-1), 'saved');
});

test('missing IndexedDB state starts the app and commits the initial state', async () => {
    const page = startApp();
    await page.ready();
    await page.flush();

    assert.equal(page.appStarts, 1);
    assert.equal(page.alerts, 0);
    assert.equal(page.committed.length, 1);
    assert.equal(page.committed[0].key, 'factory_maintenance_next_data_v2');
    assert.equal(page.committed[0].value.currentDepartmentId, 'dept_default');
    assert.deepEqual(page.saveStatuses, ['saving', 'saved']);
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
