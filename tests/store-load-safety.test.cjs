'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storeSource = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const bootSource = fs.readFileSync(path.join(__dirname, '..', 'app-boot.js'), 'utf8');
const MARKER_KEY = 'factory_maintenance_state_present_v1';

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sampleData() {
    return {
        currentDepartmentId: 'dept_default',
        departments: [{ id: 'dept_default', name: '工程' }],
        deptData: {
            dept_default: {
                machines: [{ id: 'machine-1', name: 'Press' }],
                tasks: [],
                history: [],
                partsMaster: []
            }
        },
        settings: { currentFile: 'latest.json', theme: 'light' }
    };
}

function fakeLocalStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
        values,
        getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
        setItem(key, value) { values.set(String(key), String(value)); },
        removeItem(key) { values.delete(String(key)); }
    };
}

function fakeIndexedDB(options = {}) {
    const state = {
        record: clone(options.record),
        puts: [],
        deletes: [],
        opens: 0
    };
    const db = {
        objectStoreNames: { contains() { return true; } },
        createObjectStore() {},
        transaction(name, mode) {
            const tx = {
                error: null,
                objectStore() {
                    return {
                        get() {
                            const request = { result: undefined, error: null };
                            queueMicrotask(() => {
                                if (options.readError) {
                                    request.error = new Error('read failed');
                                    request.onerror?.({ target: request });
                                    tx.error = request.error;
                                    queueMicrotask(() => tx.onerror?.({ target: tx }));
                                    return;
                                }
                                request.result = clone(state.record);
                                request.onsuccess?.({ target: request });
                                if (options.abortRead) {
                                    tx.error = new Error('read transaction aborted');
                                    queueMicrotask(() => tx.onabort?.({ target: tx }));
                                } else if (mode === 'readonly') {
                                    queueMicrotask(() => tx.oncomplete?.({ target: tx }));
                                }
                            });
                            return request;
                        },
                        getAllKeys() {
                            const keys = [...(options.extraKeys || [])];
                            if (state.record !== undefined) keys.push('factory_maintenance_next_data_v2');
                            const request = { result: keys, error: null };
                            queueMicrotask(() => {
                                request.onsuccess?.({ target: request });
                                if (mode === 'readonly') {
                                    queueMicrotask(() => tx.oncomplete?.({ target: tx }));
                                }
                            });
                            return request;
                        },
                        put(value, key) {
                            const request = { result: key, error: null };
                            const snapshot = clone(value);
                            state.puts.push({ key, value: snapshot });
                            queueMicrotask(() => {
                                request.onsuccess?.({ target: request });
                                if (options.abortPut) {
                                    tx.error = new Error('transaction aborted');
                                    queueMicrotask(() => tx.onabort?.({ target: tx }));
                                } else {
                                    state.record = snapshot;
                                    queueMicrotask(() => tx.oncomplete?.({ target: tx }));
                                }
                            });
                            return request;
                        },
                        delete(key) {
                            const request = {};
                            state.deletes.push(key);
                            queueMicrotask(() => {
                                request.onsuccess?.({ target: request });
                                queueMicrotask(() => tx.oncomplete?.({ target: tx }));
                            });
                            return request;
                        }
                    };
                }
            };
            return tx;
        },
        close() {}
    };
    return {
        state,
        indexedDB: {
            open() {
                state.opens += 1;
                const request = { result: null, error: null };
                queueMicrotask(() => {
                    if (options.openError) {
                        request.error = new Error('open failed');
                        request.onerror?.({ target: request });
                    } else {
                        request.result = db;
                        request.onsuccess?.({ target: request });
                    }
                });
                return request;
            }
        }
    };
}

function loadStore(options = {}) {
    const storage = options.localStorage || fakeLocalStorage();
    const idb = fakeIndexedDB(options.idb || {});
    const statuses = [];
    const window = {
        dispatchEvent(event) {
            if (event.type === 'maintenance-save-status') statuses.push(event.detail.status);
        }
    };
    const context = vm.createContext({
        indexedDB: idb.indexedDB,
        localStorage: storage,
        window,
        CustomEvent: class {
            constructor(type, options) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        console: { log() {}, error() {}, warn() {} },
        setTimeout,
        clearTimeout
    });
    vm.runInContext(storeSource, context, { filename: 'store.js' });
    return { store: vm.runInContext('store', context), storage, idb: idb.state, statuses };
}

test('a successful IndexedDB read hydrates the existing data without replacing it', async () => {
    const existing = sampleData();
    const { store, idb, storage } = loadStore({ idb: { record: existing } });
    await store.init();
    assert.equal(store.activeData.machines[0].name, 'Press');
    assert.equal(idb.puts.length, 0);
    assert.equal(storage.getItem(MARKER_KEY), '1');
});

test('startup preserves older automatic backup records for recovery', async () => {
    const { store, idb } = loadStore({
        idb: { record: sampleData(), extraKeys: ['maintenance_auto_backup_old'] }
    });
    await store.init();
    assert.deepEqual(idb.deletes, []);
});

test('an IndexedDB read error cannot start with empty defaults or overwrite data', async () => {
    const { store, idb } = loadStore({ idb: { readError: true } });
    await assert.rejects(async () => store.init());
    await assert.rejects(async () => store.save());
    assert.equal(idb.puts.length, 0);
});

test('a read transaction abort after request success cannot hydrate data', async () => {
    const { store, idb } = loadStore({ idb: { record: sampleData(), abortRead: true } });
    await assert.rejects(async () => store.init());
    await assert.rejects(async () => store.save());
    assert.equal(idb.puts.length, 0);
});

test('an IndexedDB open error does not silently fall back to empty localStorage', async () => {
    const { store, idb, storage } = loadStore({ idb: { openError: true } });
    await assert.rejects(async () => store.init());
    await assert.rejects(async () => store.save());
    assert.equal(idb.puts.length, 0);
    assert.equal(storage.getItem(MARKER_KEY), null);
});

test('an absent record on a genuinely fresh profile waits for explicit new-data confirmation', async () => {
    const { store, idb, storage } = loadStore();
    const state = await store.init();
    assert.equal(state, 'empty-unconfirmed');
    assert.equal(idb.puts.length, 0);
    await assert.rejects(async () => store.save());
    assert.equal(idb.puts.length, 0);
    assert.equal(storage.getItem(MARKER_KEY), null);
    await store.confirmEmptyStore();
    store.activeData.machines.push({ id: 'fresh', name: 'New machine' });
    await store.save();
    assert.equal(idb.record.deptData.dept_default.machines[0].name, 'New machine');
    assert.equal(storage.getItem(MARKER_KEY), '1');
});

test('an absent record after a prior save is a load failure, not a new profile', async () => {
    const storage = fakeLocalStorage({ [MARKER_KEY]: '1' });
    const { store, idb } = loadStore({ localStorage: storage });
    await assert.rejects(async () => store.init());
    await assert.rejects(async () => store.save());
    assert.equal(idb.puts.length, 0);
});

test('a malformed IndexedDB record with empty deptData is not normalized into a blank state', async () => {
    const { store, idb } = loadStore({ idb: { record: { deptData: {} } } });
    await assert.rejects(async () => store.init());
    assert.equal(idb.puts.length, 0);
});

test('a missing primary record with surviving backup keys cannot be treated as fresh', async () => {
    const { store, idb } = loadStore({
        idb: { extraKeys: ['maintenance_auto_backup_previous'] }
    });
    await assert.rejects(async () => store.init());
    assert.equal(idb.puts.length, 0);
    assert.deepEqual(idb.deletes, []);
});

test('valid legacy data migrates only after it has been parsed', async () => {
    const existing = sampleData();
    const storage = fakeLocalStorage({ factory_maintenance_next_data_v2: JSON.stringify(existing) });
    const { store, idb } = loadStore({ localStorage: storage });
    await store.init();
    assert.equal(store.activeData.machines[0].name, 'Press');
    assert.equal(idb.record.deptData.dept_default.machines[0].name, 'Press');
});

test('corrupt legacy data cannot be replaced with defaults', async () => {
    const storage = fakeLocalStorage({ factory_maintenance_next_data_v2: '{broken json' });
    const { store, idb } = loadStore({ localStorage: storage });
    await assert.rejects(async () => store.init());
    assert.equal(idb.puts.length, 0);
});

test('a transaction abort rejects save and never reports saved', async () => {
    const { store, idb, statuses } = loadStore({ idb: { record: sampleData(), abortPut: true } });
    await store.init();
    store.activeData.machines[0].name = 'Changed';
    await assert.rejects(async () => store.save());
    assert.equal(idb.record.deptData.dept_default.machines[0].name, 'Press');
    assert.ok(statuses.includes('error'));
    assert.ok(!statuses.includes('saved'));
});

test('boot does not construct the app after store initialization fails', async () => {
    let boot = null;
    let appCount = 0;
    const window = {
        addEventListener(type, listener) {
            if (type === 'DOMContentLoaded') boot = listener;
        },
        setTimeout() { throw new Error('diagnostics must not run on failed load'); }
    };
    const context = vm.createContext({
        window,
        store: { init: async () => { throw new Error('unreadable storage'); } },
        MaintenanceApp: class { constructor() { appCount += 1; } },
        console: { error() {} },
        alert() {}
    });
    vm.runInContext(bootSource, context, { filename: 'app-boot.js' });
    assert.equal(typeof boot, 'function');
    await boot();
    assert.equal(appCount, 0);
});


test('boot waits for explicit new-data choice when storage is genuinely empty', async () => {
    let boot = null;
    let appCount = 0;
    let confirmCount = 0;
    let diagnosticsScheduled = 0;

    function element(tagName) {
        return {
            tagName,
            children: [],
            parent: null,
            listeners: {},
            style: {},
            textContent: '',
            appendChild(child) {
                child.parent = this;
                this.children.push(child);
                return child;
            },
            append(...children) { children.forEach(child => this.appendChild(child)); },
            remove() {
                if (this.parent) {
                    this.parent.children = this.parent.children.filter(child => child !== this);
                    this.parent = null;
                }
            },
            addEventListener(type, callback) { this.listeners[type] = callback; },
            focus() {}
        };
    }
    const root = element('body');
    const find = predicate => {
        const visit = node => predicate(node)
            ? node
            : node.children.map(visit).find(Boolean);
        return visit(root);
    };
    const document = {
        body: root,
        createElement: element,
        getElementById(id) { return find(node => node.id === id) || null; }
    };
    const window = {
        addEventListener(type, callback) {
            if (type === 'DOMContentLoaded') boot = callback;
        },
        setTimeout() { diagnosticsScheduled += 1; },
        location: { reload() {} }
    };
    const context = vm.createContext({
        document,
        window,
        store: {
            init: async () => 'empty-unconfirmed',
            confirmEmptyStore() { confirmCount += 1; }
        },
        MaintenanceApp: class {
            constructor() {
                assert.equal(confirmCount, 1);
                appCount += 1;
            }
        },
        console: { error() {} },
        alert() {}
    });
    vm.runInContext(bootSource, context, { filename: 'app-boot.js' });
    await boot();
    assert.equal(appCount, 0);
    assert.equal(confirmCount, 0);
    assert.equal(diagnosticsScheduled, 0);
    assert.ok(document.getElementById('maintenance-storage-gate'));
    const startNew = find(node => node.textContent === '新規データで開始');
    assert.ok(startNew);
    startNew.listeners.click();
    assert.equal(confirmCount, 1);
    assert.equal(appCount, 1);
    assert.equal(diagnosticsScheduled, 1);
    assert.equal(document.getElementById('maintenance-storage-gate'), null);
});
