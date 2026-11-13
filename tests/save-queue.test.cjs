'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');

function makeStore() {
    const events = [];
    const started = [];
    const committed = [];
    const localValues = new Map();
    const window = { dispatchEvent(event) { events.push(event.detail.status); } };
    const context = vm.createContext({
        window,
        localStorage: {
            getItem(key) { return localValues.get(key) ?? null; },
            setItem(key, value) { localValues.set(key, String(value)); },
            removeItem(key) { localValues.delete(key); }
        },
        CustomEvent: class {
            constructor(type, options) { this.type = type; this.detail = options.detail; }
        },
        console: { error() {}, warn() {} }
    });
    vm.runInContext(source, context, { filename: 'store.js' });
    const store = window.store;
    store.db = {
        transaction(name, mode) {
            assert.equal(name, 'state');
            assert.equal(mode, 'readwrite');
            const tx = {
                objectStore() {
                    return {
                        put(snapshot, key) {
                            assert.equal(key, store.STORAGE_KEY);
                            const request = {};
                            started.push({ snapshot, tx, request });
                            return request;
                        }
                    };
                }
            };
            return tx;
        }
    };
    const tick = () => new Promise(resolve => setImmediate(resolve));
    return {
        store, events, started, committed, localValues, tick,
        complete(index) {
            const write = started[index];
            committed.push(write.snapshot);
            write.tx.oncomplete();
        },
        abort(index) {
            const write = started[index];
            write.tx.error = new Error('Transaction aborted');
            write.tx.onabort();
        }
    };
}

test('overlapping saves serialize and pending edits collapse into the newest snapshot', async () => {
    const page = makeStore();
    const { store } = page;
    store.activeData.machines.push({ id: 'one' });
    const first = store.save();
    assert.equal(page.started.length, 1);

    store.activeData.machines.push({ id: 'two' });
    const second = store.save();
    store.activeData.machines.push({ id: 'three' });
    const third = store.save();
    assert.equal(page.started.length, 1);
    assert.equal(page.started[0].snapshot.deptData.dept_default.machines.length, 1);
    assert.equal(store._saveRequestedRevision, 3);

    page.complete(0);
    await page.tick();
    assert.equal(page.started.length, 2);
    assert.equal(page.started[1].snapshot.deptData.dept_default.machines.length, 3);
    assert.deepEqual(page.events, ['saving', 'saving']);

    page.complete(1);
    await Promise.all([first, second, third]);
    assert.deepEqual(page.events, ['saving', 'saving', 'saved']);
    assert.equal(page.committed.length, 2);
    assert.equal(store._savePersistedRevision, 3);
    assert.equal(store.storageCandidates.indexeddb.total, 3);
});

test('a failed write rejects its caller while a newer queued edit can still save', async () => {
    const page = makeStore();
    const { store } = page;
    store.activeData.machines.push({ id: 'first' });
    const first = store.save().then(() => null, error => error);
    store.activeData.machines.push({ id: 'second' });
    const second = store.save();

    page.abort(0);
    assert.match((await first).message, /Transaction aborted/);
    await page.tick();
    assert.equal(page.started.length, 2);
    page.complete(1);
    await second;

    assert.deepEqual(page.events, ['saving', 'error', 'saving', 'saved']);
    assert.equal(page.committed.length, 1);
    assert.equal(page.committed[0].deptData.dept_default.machines.length, 2);
    assert.equal(store._savePersistedRevision, 2);
});

test('a request error keeps later writes queued until the transaction aborts', async () => {
    const page = makeStore();
    const { store } = page;
    const first = store.save().then(() => null, error => error);
    const second = store.save();

    page.started[0].request.error = new Error('Put failed');
    page.started[0].request.onerror();
    await page.tick();
    assert.equal(page.started.length, 1);

    page.abort(0);
    assert.match((await first).message, /Put failed/);
    await page.tick();
    assert.equal(page.started.length, 2);
    page.complete(1);
    await second;
});

test('repair failure discards queued snapshots of the rolled-back object but allows future saves', async () => {
    const page = makeStore();
    const { store } = page;
    store.activeData.machines.push({ id: 'kept' });
    store.activeData.machines.length = 0;
    const repair = store.save({ discardQueuedOnFailure: true }).then(() => null, error => error);

    const follower = store.save().then(() => null, error => error);
    page.abort(0);
    assert.match((await repair).message, /Transaction aborted/);
    assert.match((await follower).message, /待機中の保存を中止/);
    await page.tick();
    assert.equal(page.started.length, 1);

    store.activeData.machines.push({ id: 'kept' });
    const afterRollback = store.save();
    assert.equal(page.started.length, 2);
    page.complete(1);
    await afterRollback;
    assert.equal(page.committed[0].deptData.dept_default.machines[0].id, 'kept');
});

test('failed import cannot be re-saved by a later queued callback from its discarded state', async () => {
    const page = makeStore();
    const { store } = page;
    const original = store.data;
    store.activeData.machines.push({ id: 'previous' });
    const previousSave = store.save();
    const importedData = {
        currentDepartmentId: 'dept_default',
        departments: [{ id: 'dept_default', name: '初期部署' }],
        deptData: { dept_default: { machines: [{ id: 'imported' }] } },
        settings: {}
    };
    const importResult = store.importFromJSON(JSON.stringify({
        mainData: importedData,
        skillEvaluations: { worker: { machine: '○' } }
    }));
    await page.tick();
    assert.equal(store.data.deptData.dept_default.machines[0].id, 'previous');
    assert.equal(page.localValues.has('skillEvaluations'), false);
    page.complete(0);
    await previousSave;
    await page.tick();
    assert.equal(store.data.deptData.dept_default.machines[0].id, 'imported');
    assert.equal(page.localValues.has('skillEvaluations'), true);
    assert.equal(page.started.length, 2);

    const lateSave = store.save().then(() => null, error => error);
    page.abort(1);
    assert.equal(await importResult, false);
    assert.match((await lateSave).message, /失敗した取込データ/);
    await page.tick();
    assert.equal(page.started.length, 2);
    assert.equal(page.committed.length, 1);
    assert.equal(page.committed[0].deptData.dept_default.machines[0].id, 'previous');
    assert.equal(store.data, original);
    assert.equal(page.localValues.has('skillEvaluations'), false);
});

test('import stops if another edit saves while waiting for the old queue to drain', async () => {
    const page = makeStore();
    const { store } = page;
    const original = store.data;
    const importedData = {
        currentDepartmentId: 'dept_default',
        departments: [{ id: 'dept_default', name: '初期部署' }],
        deptData: { dept_default: { machines: [{ id: 'imported' }] } },
        settings: {}
    };
    const importResult = store.importFromJSON(JSON.stringify({ mainData: importedData }), {
        expectedDataRef: original,
        expectedRevision: store._saveRequestedRevision,
        throwOnError: true
    }).then(() => null, error => error);

    store.activeData.machines.push({ id: 'late-edit' });
    const lateSave = store.save();
    assert.equal(page.started.length, 1);
    page.complete(0);
    await lateSave;
    const error = await importResult;

    assert.match(error.message, /バックアップ後に現在のデータが変更/);
    assert.equal(store.data, original);
    assert.equal(store.activeData.machines[0].id, 'late-edit');
    assert.equal(page.started.length, 1);
});
