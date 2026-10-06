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
                                options.afterPut?.({ key, value: snapshot });
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
function dataWithMachineCounts(counts) {
    const data = sampleData();
    data.departments = Object.keys(counts).map(id => ({ id, name: id }));
    data.currentDepartmentId = data.departments[0].id;
    data.deptData = Object.fromEntries(Object.entries(counts).map(([id, count]) => [id, {
        machines: Array.from({ length: count }, (_, index) => ({
            id: id + '-' + index,
            name: 'Machine ' + index
        })),
        tasks: [],
        history: [],
        partsMaster: []
    }]));
    return data;
}

test('a sudden collapse of persisted inventory asks before replacing the saved state', async () => {
    const original = dataWithMachineCounts({ dept_default: 100 });
    const savedAt = '2026-10-06T02:30:00.000Z';
    const { store, idb, events } = loadStore({
        idb: { record: original, revision: { revision: 7, savedAt } }
    });
    await store.init();
    store.activeData.machines.length = 0;

    await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
    assert.equal(idb.record.deptData.dept_default.machines.length, 100);
    assert.equal(idb.revision.revision, 7);
    assert.equal(idb.puts.length, 0);
    assert.equal(store.lastSavedAt, savedAt);
    const warning = events.find(event => event.status === 'shrink');
    assert.ok(warning);
    assert.equal(warning.beforeCount, 100);
    assert.equal(warning.afterCount, 0);
    assert.equal(warning.savedAt, savedAt);
    assert.ok(!events.some(event => event.status === 'saved'));

    // The pending choice remains in force even when memory changes again.
    store.activeData.machines.push({ id: 'replacement', name: 'Replacement' });
    await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
    assert.equal(idb.record.deptData.dept_default.machines.length, 100);
    assert.equal(idb.puts.length, 0);
});

test('confirming an intentional sudden decrease commits it and clears the save latch', async () => {
    const { store, idb, statuses } = loadStore({
        idb: { record: dataWithMachineCounts({ dept_default: 100 }) }
    });
    await store.init();
    store.activeData.machines.length = 0;
    await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');

    await store.confirmSuddenDecrease();
    assert.equal(idb.record.deptData.dept_default.machines.length, 0);
    assert.equal(idb.revision.revision, 1);
    assert.ok(statuses.includes('saved'));

    store.activeData.machines.push({ id: 'later', name: 'Later' });
    await store.save();
    assert.equal(idb.record.deptData.dept_default.machines[0].id, 'later');
    assert.equal(idb.revision.revision, 2);
});

test('a normal partial deletion does not require a sudden-decrease confirmation', async () => {
    const { store, idb, statuses } = loadStore({
        idb: { record: dataWithMachineCounts({ dept_default: 100 }) }
    });
    await store.init();
    store.activeData.machines.splice(90);
    await store.save();
    assert.equal(idb.record.deptData.dept_default.machines.length, 90);
    assert.equal(idb.revision.revision, 1);
    assert.ok(!statuses.includes('shrink'));
});

test('deleting the only few records does not trigger the large-data safety prompt', async () => {
    const { store, idb, statuses } = loadStore({
        idb: { record: dataWithMachineCounts({ dept_default: 2 }) }
    });
    await store.init();
    store.activeData.machines.length = 0;
    await store.save();
    assert.equal(idb.record.deptData.dept_default.machines.length, 0);
    assert.ok(!statuses.includes('shrink'));
});

test('the sudden-decrease threshold counts records across all departments', async () => {
    const original = dataWithMachineCounts({ dept_default: 100, dept_other: 1 });
    original.currentDepartmentId = 'dept_other';
    const { store, idb, events } = loadStore({ idb: { record: original } });
    await store.init();
    store.data.deptData.dept_default.machines.length = 0;

    await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
    const warning = events.find(event => event.status === 'shrink');
    assert.ok(warning);
    assert.equal(warning.beforeCount, 101);
    assert.equal(warning.afterCount, 1);
    assert.equal(idb.record.deptData.dept_default.machines.length, 100);
    assert.equal(idb.record.deptData.dept_other.machines.length, 1);
});

test('a stale tab reports a revision conflict before it can confirm a decrease', async () => {
    const shared = fakeIndexedDB({ record: dataWithMachineCounts({ dept_default: 100 }) });
    const first = loadStore({ idbService: shared });
    const second = loadStore({ idbService: shared });
    await Promise.all([first.store.init(), second.store.init()]);

    first.store.activeData.machines[0].name = 'Newer edit';
    await first.store.save();
    second.store.activeData.machines.length = 0;
    await assert.rejects(second.store.save(), error => error.code === 'STORAGE_CONFLICT');
    assert.ok(second.statuses.includes('conflict'));
    assert.ok(!second.statuses.includes('shrink'));
    assert.equal(shared.state.record.deptData.dept_default.machines.length, 100);
    assert.equal(shared.state.record.deptData.dept_default.machines[0].name, 'Newer edit');
});
function runtimeShrinkBootHarness(confirmSuddenDecrease = async () => {}, verifySuddenDecreaseSource = async () => true) {
    const listeners = new Map();
    let reloads = 0;
    let appCount = 0;
    let confirmations = 0;
    let verifications = 0;
    function element(tagName) {
        return {
            tagName,
            children: [],
            parent: null,
            listeners: {},
            style: {},
            textContent: '',
            disabled: false,
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
            focus() { this.focused = true; }
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
            const callbacks = listeners.get(type) || [];
            callbacks.push(callback);
            listeners.set(type, callbacks);
        },
        dispatchEvent(event) {
            for (const callback of listeners.get(event.type) || []) callback(event);
        },
        setTimeout() {},
        location: { reload() { reloads += 1; } }
    };
    const store = {
        init: async () => 'loaded',
        save() { throw new Error('the warning must never trigger a save'); },
        async verifySuddenDecreaseSource() { verifications += 1; return verifySuddenDecreaseSource(); },
        async confirmSuddenDecrease() {
            confirmations += 1;
            return confirmSuddenDecrease();
        }
    };
    const context = vm.createContext({
        document,
        window,
        store,
        MaintenanceApp: class { constructor() { appCount += 1; } },
        console: { error() {} },
        alert() {}
    });
    vm.runInContext(bootSource, context, { filename: 'app-boot.js' });
    return {
        async boot() {
            for (const callback of listeners.get('DOMContentLoaded') || []) await callback();
        },
        warn(detail = {}) {
            window.dispatchEvent({
                type: 'maintenance-save-status',
                detail: {
                    status: 'shrink',
                    beforeCount: 100,
                    afterCount: 0,
                    savedAt: '2026-10-06T02:30:00.000Z',
                    ...detail
                }
            });
        },
        find,
        document,
        get reloads() { return reloads; },
        get appCount() { return appCount; },
        get confirmations() { return confirmations; },
        get verifications() { return verifications; }
    };
}

test('runtime shrink warning offers restoration by reloading the persisted state', async () => {
    let resolveVerification;
    const verification = new Promise(resolve => { resolveVerification = resolve; });
    const harness = runtimeShrinkBootHarness(async () => {}, () => verification);
    await harness.boot();
    assert.equal(harness.appCount, 1);
    assert.equal(harness.document.getElementById('maintenance-storage-gate'), null);

    harness.warn();
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    assert.match(harness.find(node => node.tagName === 'p')?.textContent || '', /100.*0/);
    const restore = harness.find(node => node.textContent === '前回保存した記録に戻す');
    assert.ok(restore);
    assert.equal(restore.focused, true);
    assert.equal(harness.confirmations, 0);

    const click = restore.listeners.click();
    assert.equal(harness.verifications, 1);
    assert.equal(harness.reloads, 0);
    resolveVerification(true);
    await click;
    assert.equal(harness.reloads, 1);
    assert.equal(harness.confirmations, 0);
});

test('runtime shrink warning reloads only after explicit reduced-data save succeeds', async () => {
    let resolveConfirmation;
    const confirmation = new Promise(resolve => { resolveConfirmation = resolve; });
    const harness = runtimeShrinkBootHarness(() => confirmation);
    await harness.boot();
    harness.warn();
    const restore = harness.find(node => node.textContent === '前回保存した記録に戻す');
    const keep = harness.find(node => node.textContent === '減った内容を保存する');
    assert.ok(restore);
    assert.ok(keep);

    const click = keep.listeners.click();
    assert.equal(harness.confirmations, 1);
    assert.equal(harness.reloads, 0);
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    assert.equal(restore.disabled, true);
    assert.equal(keep.disabled, true);

    resolveConfirmation();
    await click;
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    assert.equal(harness.reloads, 1);
});

test('failed reduced-data confirmation keeps a blocking recovery gate', async () => {
    const harness = runtimeShrinkBootHarness(async () => {
        throw new Error('write failed');
    });
    await harness.boot();
    harness.warn();
    const keep = harness.find(node => node.textContent === '減った内容を保存する');
    await keep.listeners.click();

    assert.equal(harness.confirmations, 1);
    assert.equal(harness.reloads, 0);
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    assert.ok(harness.find(node => node.textContent === '減った内容を保存できませんでした'));
    assert.ok(harness.find(node => node.textContent === '再読み込み'));
});
test('notebook rows alone trigger a decrease warning when a date is emptied', async () => {
    const original = dataWithMachineCounts({ dept_default: 0 });
    original.deptData.dept_default.shiftNotebooks = {
        '2026-10-06': {
            day: { rows: Array.from({ length: 20 }, (_, index) => ({
                id: 'note-' + index,
                text: 'Notebook entry ' + index
            })) }
        }
    };
    const { store, idb, events } = loadStore({ idb: { record: original } });
    await store.init();
    store.activeData.shiftNotebooks = {};

    await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
    const warning = events.find(event => event.status === 'shrink');
    assert.ok(warning);
    assert.equal(warning.beforeCount, 20);
    assert.equal(warning.afterCount, 0);
    assert.equal(idb.record.deptData.dept_default.shiftNotebooks['2026-10-06'].day.rows.length, 20);
    assert.equal(idb.puts.length, 0);
});

test('restoration verifies the committed source and rejects a newer tab revision', async () => {
    const shared = fakeIndexedDB({ record: dataWithMachineCounts({ dept_default: 100 }) });
    const first = loadStore({ idbService: shared });
    const second = loadStore({ idbService: shared });
    await Promise.all([first.store.init(), second.store.init()]);

    first.store.activeData.machines.length = 0;
    await assert.rejects(first.store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
    assert.equal(await first.store.verifySuddenDecreaseSource(), true);

    second.store.activeData.machines[0].name = 'Updated elsewhere';
    await second.store.save();
    await assert.rejects(first.store.verifySuddenDecreaseSource(),
        error => error.code === 'STORAGE_CONFLICT');
    assert.ok(first.statuses.includes('conflict'));
    assert.equal(shared.state.record.deptData.dept_default.machines[0].name, 'Updated elsewhere');
});

test('restoration rejects a missing or invalid persisted source even when its revision is unchanged', async () => {
    for (const missingOrInvalid of [undefined, { deptData: {} }]) {
        const shared = fakeIndexedDB({ record: dataWithMachineCounts({ dept_default: 100 }) });
        const { store, statuses } = loadStore({ idbService: shared });
        await store.init();
        store.activeData.machines.length = 0;
        await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
        shared.state.record = missingOrInvalid;

        await assert.rejects(store.verifySuddenDecreaseSource(),
            error => error.code === 'STORAGE_CONFLICT');
        assert.ok(statuses.includes('conflict'));
        assert.equal(shared.state.puts.length, 0);
    }
});

test('duplicate decrease warnings do not rebuild the gate during explicit save', async () => {
    let resolveConfirmation;
    const confirmation = new Promise(resolve => { resolveConfirmation = resolve; });
    const harness = runtimeShrinkBootHarness(() => confirmation);
    await harness.boot();
    harness.warn();
    const originalGate = harness.document.getElementById('maintenance-storage-gate');
    const keep = harness.find(node => node.textContent === '減った内容を保存する');
    const click = keep.listeners.click();
    assert.equal(keep.disabled, true);

    harness.warn();
    assert.equal(harness.document.getElementById('maintenance-storage-gate'), originalGate);
    assert.equal(keep.disabled, true);
    assert.equal(harness.confirmations, 1);

    resolveConfirmation();
    await click;
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    assert.equal(harness.reloads, 1);
});

test('failed source verification keeps the recovery gate and never reloads automatically', async () => {
    const harness = runtimeShrinkBootHarness(async () => {}, async () => {
        throw new Error('source changed');
    });
    await harness.boot();
    harness.warn();
    const restore = harness.find(node => node.textContent === '前回保存した記録に戻す');
    await restore.listeners.click();

    assert.equal(harness.verifications, 1);
    assert.equal(harness.reloads, 0);
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    assert.ok(harness.find(node => node.textContent === '前回保存した記録を確認できませんでした'));
    const reload = harness.find(node => node.textContent === '再読み込み');
    assert.ok(reload);
    reload.listeners.click();
    assert.equal(harness.reloads, 1);
});
test('confirmation rejects a further same-tab drop until the new count is confirmed', async () => {
    const { store, idb, events } = loadStore({
        idb: { record: dataWithMachineCounts({ dept_default: 100 }) }
    });
    await store.init();
    store.activeData.machines.length = 9;
    await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE'
        && error.beforeCount === 100 && error.afterCount === 9);
    assert.equal(idb.record.deptData.dept_default.machines.length, 100);

    store.activeData.machines.length = 0;
    await assert.rejects(store.confirmSuddenDecrease(),
        error => error.code === 'SUDDEN_DATA_DECREASE'
            && error.beforeCount === 100 && error.afterCount === 0);
    assert.equal(idb.record.deptData.dept_default.machines.length, 100);
    assert.equal(idb.revision, undefined);
    assert.equal(idb.puts.length, 0);
    assert.equal(events.filter(event => event.status === 'shrink').at(-1).afterCount, 0);

    await store.confirmSuddenDecrease();
    assert.equal(idb.record.deptData.dept_default.machines.length, 0);
    assert.equal(idb.revision.revision, 1);
});
test('a changed decrease count refreshes the gate and requests a second explicit confirmation', async () => {
    let confirmations = 0;
    const harness = runtimeShrinkBootHarness(async () => {
        confirmations += 1;
        if (confirmations === 1) {
            const error = new Error('count changed again');
            error.code = 'SUDDEN_DATA_DECREASE';
            error.beforeCount = 100;
            error.afterCount = 0;
            error.savedAt = '2026-10-06T02:30:00.000Z';
            throw error;
        }
    });
    await harness.boot();
    harness.warn({ afterCount: 9 });
    const firstGate = harness.document.getElementById('maintenance-storage-gate');
    harness.warn({ afterCount: 9 });
    assert.equal(harness.document.getElementById('maintenance-storage-gate'), firstGate);

    const firstKeep = harness.find(node => node.textContent === '減った内容を保存する');
    await firstKeep.listeners.click();
    const refreshedGate = harness.document.getElementById('maintenance-storage-gate');
    assert.ok(refreshedGate);
    assert.notEqual(refreshedGate, firstGate);
    assert.match(harness.find(node => node.tagName === 'p')?.textContent || '', /100 件.*0 件/);
    assert.equal(harness.reloads, 0);
    assert.equal(harness.find(node => node.textContent === '減った内容を保存できませんでした'), undefined);

    const secondKeep = harness.find(node => node.textContent === '減った内容を保存する');
    await secondKeep.listeners.click();
    assert.equal(harness.confirmations, 2);
    assert.equal(harness.reloads, 1);
    assert.equal(harness.document.getElementById('maintenance-storage-gate'), refreshedGate);
});

function importSkillStorage() {
    return fakeLocalStorage({
        skillEvaluations: '{"existing":{"rating":2}}',
        manualSkills: '[{"id":"existing","name":"Existing skill"}]'
    });
}

function importPayload(format, machineCount = 2) {
    const importedMachines = Array.from({ length: machineCount }, (_, index) => ({
        id: 'imported-' + index,
        name: 'Imported ' + index
    }));
    const skillEvaluations = { imported: { rating: 5 } };
    const manualSkills = [{ id: 'imported', name: 'Imported skill' }];
    if (format === 'whole') {
        const mainData = sampleData();
        mainData.deptData.dept_default.machines = importedMachines;
        mainData.settings.theme = 'dark';
        return JSON.stringify({ mainData, skillEvaluations, manualSkills });
    }
    return JSON.stringify({
        type: 'single_department_backup',
        departmentName: '工程',
        data: { machines: importedMachines, tasks: [], history: [], partsMaster: [] },
        skillEvaluations,
        manualSkills
    });
}

function importSnapshot(store, storage) {
    return {
        data: clone(store.data),
        skillEvaluations: storage.getItem('skillEvaluations'),
        manualSkills: storage.getItem('manualSkills')
    };
}

function assertImportSnapshot(store, storage, expected) {
    assert.deepStrictEqual(clone(store.data), expected.data);
    assert.equal(storage.getItem('skillEvaluations'), expected.skillEvaluations);
    assert.equal(storage.getItem('manualSkills'), expected.manualSkills);
}

for (const format of ['whole', 'single']) {
    for (const failure of ['abort', 'conflict', 'pending shrink']) {
        test(format + ' import preserves memory and skills when save fails: ' + failure, async () => {
            const original = failure === 'pending shrink'
                ? dataWithMachineCounts({ dept_default: 100 })
                : sampleData();
            const shared = fakeIndexedDB({
                record: original,
                abortPut: failure === 'abort'
            });
            const storage = importSkillStorage();
            const { store, statuses } = loadStore({ idbService: shared, localStorage: storage });
            await store.init();

            if (failure === 'conflict') {
                const otherTab = loadStore({ idbService: shared });
                await otherTab.store.init();
                otherTab.store.activeData.machines[0].name = 'Changed in another tab';
                await otherTab.store.save();
            }
            if (failure === 'pending shrink') {
                store.activeData.machines.length = 0;
                await assert.rejects(store.save(), error => error.code === 'SUDDEN_DATA_DECREASE');
            }

            const before = importSnapshot(store, storage);
            const savedBefore = clone(shared.state.record);
            const payload = importPayload(format);
            const result = format === 'whole'
                ? await store.importFromJSON(payload)
                : await store.importToCurrentDeptFromJSON(payload);

            assert.equal(format === 'whole' ? result : result.success, false);
            assertImportSnapshot(store, storage, before);
            assert.deepStrictEqual(shared.state.record, savedBefore);
            assert.ok(statuses.includes(failure === 'pending shrink' ? 'shrink'
                : failure === 'abort' ? 'error' : 'conflict'));
        });
    }
}

test('successful whole-data import saves replacement records and both skill collections', async () => {
    const storage = importSkillStorage();
    const { store, idb } = loadStore({ idb: { record: sampleData() }, localStorage: storage });
    await store.init();

    assert.equal(await store.importFromJSON(importPayload('whole')), true);
    assert.equal(store.activeData.machines[0].name, 'Imported 0');
    assert.equal(idb.record.deptData.dept_default.machines[1].name, 'Imported 1');
    assert.equal(idb.record.settings.theme, 'dark');
    assert.deepStrictEqual(JSON.parse(storage.getItem('skillEvaluations')),
        { imported: { rating: 5 } });
    assert.deepStrictEqual(JSON.parse(storage.getItem('manualSkills')),
        [{ id: 'imported', name: 'Imported skill' }]);
});

test('successful single-department import saves records and merges skill collections', async () => {
    const storage = importSkillStorage();
    const { store, idb } = loadStore({ idb: { record: sampleData() }, localStorage: storage });
    await store.init();

    const result = await store.importToCurrentDeptFromJSON(importPayload('single'));
    assert.equal(result.success, true);
    assert.equal(result.departmentName, '工程');
    assert.equal(store.activeData.machines[0].name, 'Imported 0');
    assert.equal(idb.record.deptData.dept_default.machines[1].name, 'Imported 1');
    assert.deepStrictEqual(JSON.parse(storage.getItem('skillEvaluations')),
        { existing: { rating: 2 }, imported: { rating: 5 } });
    assert.deepStrictEqual(JSON.parse(storage.getItem('manualSkills')), [
        { id: 'existing', name: 'Existing skill' },
        { id: 'imported', name: 'Imported skill' }
    ]);
});

test('confirmed full import may intentionally replace many records with an empty backup', async () => {
    const storage = importSkillStorage();
    const { store, idb, statuses } = loadStore({
        idb: { record: dataWithMachineCounts({ dept_default: 100 }) },
        localStorage: storage
    });
    await store.init();

    assert.equal(await store.importFromJSON(importPayload('whole', 0)), true);
    assert.equal(store.activeData.machines.length, 0);
    assert.equal(idb.record.deptData.dept_default.machines.length, 0);
    assert.ok(!statuses.includes('shrink'));
});

for (const format of ['whole', 'single']) {
    test(format + ' import rolls back a partially written skill update when localStorage fails', async () => {
        const storage = importSkillStorage();
        const originalSetItem = storage.setItem;
        storage.setItem = (key, value) => {
            if (key === 'manualSkills' && String(value).includes('Imported skill')) {
                throw new Error('localStorage quota exceeded');
            }
            originalSetItem(key, value);
        };
        const { store, idb } = loadStore({
            idb: { record: sampleData() },
            localStorage: storage
        });
        await store.init();
        const before = importSnapshot(store, storage);
        const savedBefore = clone(idb.record);

        const result = format === 'whole'
            ? await store.importFromJSON(importPayload(format))
            : await store.importToCurrentDeptFromJSON(importPayload(format));

        assert.equal(format === 'whole' ? result : result.success, false);
        assertImportSnapshot(store, storage, before);
        assert.deepStrictEqual(idb.record, savedBefore);
        assert.equal(idb.puts.length, 0);
    });
}

test('legacy single-department JSON import preserves current data after a failed save', async () => {
    const storage = importSkillStorage();
    const { store, idb } = loadStore({
        idb: { record: sampleData(), abortPut: true },
        localStorage: storage
    });
    await store.init();
    const before = importSnapshot(store, storage);
    const savedBefore = clone(idb.record);

    const result = await store.importFromJSON(JSON.stringify({
        machines: [{ id: 'legacy', name: 'Legacy machine' }],
        tasks: [],
        history: [],
        settings: { theme: 'dark' }
    }));

    assert.equal(result, false);
    assertImportSnapshot(store, storage, before);
    assert.deepStrictEqual(idb.record, savedBefore);
});

test('queued same-tab save wins over an import prepared against its old revision', async () => {
    const storage = importSkillStorage();
    const { store, idb } = loadStore({ idb: { record: sampleData() }, localStorage: storage });
    await store.init();
    store.activeData.machines[0].name = 'Earlier same-tab edit';

    const earlierSave = store.save();
    const beforeImport = importSnapshot(store, storage);
    const importResult = store.importFromJSON(importPayload('whole'));
    await earlierSave;

    assert.equal(await importResult, false);
    assertImportSnapshot(store, storage, beforeImport);
    assert.equal(idb.record.deptData.dept_default.machines[0].name, 'Earlier same-tab edit');
    assert.equal(idb.revision.revision, 1);
});

test('an edit saved while an import waits wins and the stale import rolls back', async () => {
    const storage = importSkillStorage();
    const { store, idb } = loadStore({ idb: { record: sampleData() }, localStorage: storage });
    await store.init();
    const originalSkills = importSnapshot(store, storage);

    let releaseQueue;
    store._saveQueue = new Promise(resolve => { releaseQueue = resolve; });
    const importResult = store.importFromJSON(importPayload('whole'));
    store.activeData.machines[0].name = 'Edited while import waited';
    const editSave = store.save();
    releaseQueue();

    assert.equal(await importResult, false);
    await editSave;
    assert.equal(store.activeData.machines[0].name, 'Edited while import waited');
    assert.equal(idb.record.deptData.dept_default.machines[0].name, 'Edited while import waited');
    assert.equal(storage.getItem('skillEvaluations'), originalSkills.skillEvaluations);
    assert.equal(storage.getItem('manualSkills'), originalSkills.manualSkills);
    assert.equal(idb.revision.revision, 1);
});

test('an edit after import IDB put is restored before the import reports failure', async () => {
    const storage = importSkillStorage();
    const initialSkills = {
        skillEvaluations: storage.getItem('skillEvaluations'),
        manualSkills: storage.getItem('manualSkills')
    };
    let store;
    let editSave;
    let injected = false;
    const shared = fakeIndexedDB({
        record: sampleData(),
        afterPut({ key, value }) {
            if (key !== 'factory_maintenance_next_data_v2'
                || value?.deptData?.dept_default?.machines?.[0]?.id !== 'imported-0') return;
            injected = true;
            store.activeData.machines[0].name = 'Edited after import put';
            editSave = store.save();
        }
    });
    const harness = loadStore({ idbService: shared, localStorage: storage });
    store = harness.store;
    await store.init();

    const result = await store.importFromJSON(importPayload('whole'));
    assert.equal(injected, true);
    assert.equal(result, false);
    await editSave;

    assert.equal(store.activeData.machines[0].name, 'Edited after import put');
    assert.equal(shared.state.record.deptData.dept_default.machines[0].name, 'Edited after import put');
    assert.equal(shared.state.revision.revision, 2);
    assert.equal(storage.getItem('skillEvaluations'), initialSkills.skillEvaluations);
    assert.equal(storage.getItem('manualSkills'), initialSkills.manualSkills);
});
