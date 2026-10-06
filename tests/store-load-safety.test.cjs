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
    const primaryKey = 'factory_maintenance_next_data_v2';
    const revisionKey = `${primaryKey}__revision`;
    const state = {
        record: clone(options.record),
        revision: clone(options.revision),
        puts: [],
        deletes: [],
        opens: 0,
        openVersions: [],
        closes: 0
    };
    let writeTail = Promise.resolve();
    const db = {
        objectStoreNames: { contains() { return true; } },
        createObjectStore() {},
        transaction(name, mode) {
            const staged = [];
            const start = mode === 'readwrite' ? writeTail : Promise.resolve();
            let releaseWrite = () => {};
            if (mode === 'readwrite') writeTail = new Promise(resolve => { releaseWrite = resolve; });
            let pending = 0;
            let finished = false;
            let completeScheduled = false;
            const tx = {
                error: null,
                abort() {
                    if (finished) return;
                    finished = true;
                    tx.error = tx.error || new Error('transaction aborted');
                    releaseWrite();
                    queueMicrotask(() => tx.onabort?.({ target: tx }));
                },
                objectStore() {
                    return {
                        get(key) {
                            return requestFor(request => {
                                if (options.readError && mode === 'readonly') {
                                    throw new Error('read failed');
                                }
                                request.result = clone(key === primaryKey ? state.record : state.revision);
                                if (options.abortRead && mode === 'readonly') {
                                    queueMicrotask(() => tx.abort());
                                }
                            });
                        },
                        getAllKeys() {
                            return requestFor(request => {
                                const keys = [...(options.extraKeys || [])];
                                if (state.record !== undefined) keys.push(primaryKey);
                                if (state.revision !== undefined) keys.push(revisionKey);
                                request.result = keys;
                            });
                        },
                        put(value, key) {
                            const snapshot = clone(value);
                            state.puts.push({ key, value: snapshot });
                            return requestFor(() => {
                                if (options.abortPut) {
                                    tx.abort();
                                    return;
                                }
                                staged.push({ key, value: snapshot });
                            });
                        },
                        delete(key) {
                            state.deletes.push(key);
                            return requestFor(() => staged.push({ key, deleted: true }));
                        }
                    };
                }
            };
            function maybeComplete() {
                if (pending || finished || completeScheduled) return;
                completeScheduled = true;
                queueMicrotask(() => {
                    completeScheduled = false;
                    if (pending || finished) return;
                    finished = true;
                    for (const change of staged) {
                        if (change.key === primaryKey) state.record = change.deleted ? undefined : change.value;
                        if (change.key === revisionKey) state.revision = change.deleted ? undefined : change.value;
                    }
                    releaseWrite();
                    tx.oncomplete?.({ target: tx });
                });
            }
            function requestFor(action) {
                const request = { result: undefined, error: null };
                pending += 1;
                start.then(() => queueMicrotask(() => {
                    if (finished) return;
                    try {
                        action(request);
                        if (!finished) request.onsuccess?.({ target: request });
                    } catch (error) {
                        request.error = error;
                        tx.error = error;
                        request.onerror?.({ target: request });
                        tx.abort();
                    }
                    pending -= 1;
                    maybeComplete();
                }));
                return request;
            }
            return tx;
        },
        close() { state.closes += 1; }
    };
    return {
        state,
        triggerVersionChange() { db.onversionchange?.({ target: db }); },
        indexedDB: {
            open(_name, version) {
                state.opens += 1;
                state.openVersions.push(version);
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
    const idb = options.idbService || fakeIndexedDB(options.idb || {});
    const statuses = [];
    const events = [];
    const window = {
        dispatchEvent(event) {
            if (event.type === 'maintenance-save-status') {
                statuses.push(event.detail.status);
                events.push(event.detail);
            }
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
    return { store: vm.runInContext('store', context), storage, idb: idb.state, statuses, events };
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

test('the upgraded database version preserves existing state and media stores', async () => {
    const shared = fakeIndexedDB({ record: sampleData() });
    const { store } = loadStore({ idbService: shared });
    await store.init();
    assert.deepEqual(shared.state.openVersions, [3]);
    assert.equal(store.activeData.machines[0].name, 'Press');
    assert.equal(shared.state.puts.length, 0);
});

test('versionchange closes the old connection and blocks further saves', async () => {
    const shared = fakeIndexedDB({ record: sampleData() });
    const { store, statuses } = loadStore({ idbService: shared });
    await store.init();
    shared.triggerVersionChange();
    assert.equal(shared.state.closes, 1);
    assert.ok(statuses.includes('conflict'));
    await assert.rejects(store.save(), error => error.code === 'STORAGE_CONFLICT');
    assert.equal(shared.state.puts.length, 0);
});

test('existing revision metadata supplies the actual last saved time at load', async () => {
    const savedAt = '2026-10-06T02:30:00.000Z';
    const { store } = loadStore({
        idb: { record: sampleData(), revision: { revision: 7, savedAt } }
    });
    await store.init();
    assert.equal(store._revision, 7);
    assert.equal(store.lastSavedAt, savedAt);
});

test('a second tab cannot overwrite a newer state with its stale snapshot', async () => {
    const shared = fakeIndexedDB({ record: sampleData() });
    const first = loadStore({ idbService: shared });
    const second = loadStore({ idbService: shared });
    await Promise.all([first.store.init(), second.store.init()]);
    assert.equal(first.store._revision, 0);
    assert.equal(second.store._revision, 0);

    first.store.activeData.machines[0].name = 'First tab';
    await first.store.save();
    assert.equal(shared.state.revision.revision, 1);
    assert.equal(first.store.lastSavedAt, shared.state.revision.savedAt);
    assert.equal(first.events.at(-1).at, first.store.lastSavedAt);

    second.store.activeData.machines[0].name = 'Stale second tab';
    const putsBeforeConflict = shared.state.puts.length;
    await assert.rejects(second.store.save(), error => error.name === 'StorageConflictError'
        && error.code === 'STORAGE_CONFLICT');
    assert.equal(shared.state.record.deptData.dept_default.machines[0].name, 'First tab');
    assert.equal(shared.state.puts.length, putsBeforeConflict);
    assert.ok(second.statuses.includes('conflict'));
    assert.ok(!second.statuses.includes('saved'));

    await assert.rejects(second.store.save(), error => error.code === 'STORAGE_CONFLICT');
    assert.equal(shared.state.puts.length, putsBeforeConflict);
});

test('simultaneous saves from two tabs let only the first transaction commit', async () => {
    const shared = fakeIndexedDB({ record: sampleData() });
    const first = loadStore({ idbService: shared });
    const second = loadStore({ idbService: shared });
    await Promise.all([first.store.init(), second.store.init()]);
    first.store.activeData.machines[0].name = 'Winner';
    second.store.activeData.machines[0].name = 'Rejected';
    const firstSave = first.store.save();
    const secondSave = second.store.save();
    await firstSave;
    await assert.rejects(secondSave, error => error.code === 'STORAGE_CONFLICT');
    assert.equal(shared.state.record.deptData.dept_default.machines[0].name, 'Winner');
    assert.equal(shared.state.revision.revision, 1);
    assert.ok(second.statuses.includes('conflict'));
});

test('multiple saves in one tab serialize and advance the revision only on commit', async () => {
    const { store, idb, events } = loadStore({ idb: { record: sampleData() } });
    await store.init();
    store.activeData.machines[0].name = 'First edit';
    const first = store.save();
    store.activeData.machines[0].name = 'Second edit';
    const second = store.save();
    await Promise.all([first, second]);
    assert.equal(store._revision, 2);
    assert.equal(idb.revision.revision, 2);
    assert.equal(idb.record.deptData.dept_default.machines[0].name, 'Second edit');
    assert.equal(events.filter(event => event.status === 'saved').length, 2);
    assert.equal(store.lastSavedAt, idb.revision.savedAt);
});

test('a fresh tab cannot overwrite data created by another fresh tab', async () => {
    const shared = fakeIndexedDB();
    const first = loadStore({ idbService: shared });
    const second = loadStore({ idbService: shared });
    assert.equal(await first.store.init(), 'empty-unconfirmed');
    assert.equal(await second.store.init(), 'empty-unconfirmed');
    first.store.confirmEmptyStore();
    second.store.confirmEmptyStore();
    first.store.activeData.machines.push({ id: 'a', name: 'Created first' });
    await first.store.save();
    second.store.activeData.machines.push({ id: 'b', name: 'Created second' });
    await assert.rejects(second.store.save(), error => error.code === 'STORAGE_CONFLICT');
    assert.equal(shared.state.record.deptData.dept_default.machines[0].name, 'Created first');
});

test('corrupt revision metadata stops initialization before any save', async () => {
    const { store, idb } = loadStore({
        idb: { record: sampleData(), revision: { revision: 'wrong', savedAt: null } }
    });
    await assert.rejects(store.init());
    await assert.rejects(store.save());
    assert.equal(idb.puts.length, 0);
});

test('negative revision and invalid saved time each stop initialization', async () => {
    for (const revision of [
        { revision: -1, savedAt: '2026-10-06T02:30:00.000Z' },
        { revision: 2, savedAt: 'invalid' },
        { revision: 0, savedAt: '2026-10-06T02:30:00.000Z' }
    ]) {
        const { store, idb } = loadStore({ idb: { record: sampleData(), revision } });
        await assert.rejects(store.init());
        assert.equal(idb.puts.length, 0);
    }
});

test('a revision record without the primary state cannot be mistaken for a fresh profile', async () => {
    const { store, idb } = loadStore({
        idb: { revision: { revision: 1, savedAt: '2026-10-06T02:30:00.000Z' } }
    });
    await assert.rejects(store.init());
    await assert.rejects(store.save());
    assert.equal(idb.puts.length, 0);
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
