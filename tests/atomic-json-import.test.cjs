const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const mainKey = 'factory_maintenance_next_data_v2';

function createStore() {
    const localValues = new Map();
    const writes = [];
    const failures = new Set();
    const localStorage = {
        getItem(key) { return localValues.get(key) ?? null; },
        setItem(key, value) {
            if (failures.has(key)) throw new Error(`Blocked ${key}`);
            writes.push(key);
            localValues.set(key, String(value));
        },
        removeItem(key) {
            if (failures.has(key)) throw new Error(`Blocked ${key}`);
            writes.push(key);
            localValues.delete(key);
        }
    };
    const context = vm.createContext({
        localStorage,
        window: { dispatchEvent() {} },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        console: { error() {}, warn() {}, log() {} }
    });
    vm.runInContext(`${source}\nglobalThis.StoreClass = MaintenanceStore;`, context, { filename: 'store.js' });
    const store = new context.StoreClass();
    store.data.deptData.dept_default.machines.push({ id: 'original-machine' });
    localValues.set('skillEvaluations', '{"original":{"level":2}}');
    localValues.set('manualSkills', '[{"id":"original-skill"}]');
    return { store, localValues, writes, failures, StoreClass: context.StoreClass };
}

const fullPayload = () => ({
    mainData: {
        currentDepartmentId: 'dept_default',
        departments: [{ id: 'dept_default', name: '取込部署' }],
        deptData: { dept_default: { machines: [{ id: 'imported-machine' }], tasks: [], history: [] } },
        settings: { theme: 'dark' }
    },
    skillEvaluations: { imported: { level: 3 } },
    manualSkills: [{ id: 'imported-skill' }]
});

test('malformed full JSON leaves both main state and skill data unchanged', async () => {
    const { store, localValues, writes } = createStore();
    const original = store.data;
    const payload = fullPayload();
    payload.mainData = {};

    assert.equal(await store.importFromJSON(JSON.stringify(payload)), false);
    assert.equal(store.data, original);
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
    assert.equal(localValues.get('manualSkills'), '[{"id":"original-skill"}]');
    assert.deepEqual(writes, []);
});

test('full import reports a malformed nested photo field before any write', async () => {
    const { store, localValues, writes } = createStore();
    const original = store.data;
    const payload = fullPayload();
    payload.mainData.deptData.dept_default.history = [{ id: 'h1', photos: { bad: true } }];

    await assert.rejects(
        store.importFromJSON(JSON.stringify(payload), { throwOnError: true }),
        error => error.code === 'INVALID_IMPORT_SHAPE'
            && /history\[0\]\.photos/.test(error.message)
    );
    assert.equal(store.data, original);
    assert.deepEqual(writes, []);
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
    assert.equal(localValues.get('manualSkills'), '[{"id":"original-skill"}]');
});

test('full import reports an invalid department list rather than normalizing it away', async () => {
    const { store, writes } = createStore();
    const payload = fullPayload();
    payload.mainData.departments = { bad: true };

    await assert.rejects(
        store.importFromJSON(JSON.stringify(payload), { throwOnError: true }),
        /部署一覧が配列ではありません/
    );
    assert.deepEqual(writes, []);
});

test('full import rejects missing packed images instead of silently clearing them', async () => {
    const { store, writes } = createStore();
    const payload = fullPayload();
    payload.mainData.deptData.dept_default.machines[0].photo = 'maintenance-image-ref://img_missing';
    payload.imageAssets = {};

    await assert.rejects(
        store.importFromJSON(JSON.stringify(payload), { throwOnError: true }),
        error => error.code === 'INVALID_IMPORT_IMAGE_ASSETS'
            && /machines\[0\]\.photo/.test(error.message)
    );
    assert.deepEqual(writes, []);
});

test('full import rejects invalid packed image data', async () => {
    const { store, writes } = createStore();
    const payload = fullPayload();
    payload.mainData.deptData.dept_default.machines[0].photo = 'maintenance-image-ref://img_1';
    payload.imageAssets = { img_1: 'data:image/png;base64,not-valid!' };

    await assert.rejects(
        store.importFromJSON(JSON.stringify(payload), { throwOnError: true }),
        /img_1 に有効な画像本体がありません/
    );
    assert.deepEqual(writes, []);
});

test('failed main save rolls back both skill keys and keeps the old state', async () => {
    const { store, localValues, failures } = createStore();
    const original = store.data;
    const previousJson = JSON.stringify(store.data);
    failures.add(mainKey);

    assert.equal(await store.importFromJSON(JSON.stringify(fullPayload())), false);
    assert.equal(store.data, original);
    assert.equal(JSON.stringify(store.data), previousJson);
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
    assert.equal(localValues.get('manualSkills'), '[{"id":"original-skill"}]');
    assert.equal(localValues.has(mainKey), false);
});

test('failed second skill write restores the first and does not save main data', async () => {
    const { store, localValues, failures, writes } = createStore();
    const original = store.data;
    failures.add('manualSkills');

    assert.equal(await store.importFromJSON(JSON.stringify(fullPayload())), false);
    assert.equal(store.data, original);
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
    assert.equal(localValues.get('manualSkills'), '[{"id":"original-skill"}]');
    assert.equal(localValues.has(mainKey), false);
    assert.equal(writes.includes(mainKey), false);
});

test('successful full import commits main data and both skill values', async () => {
    const { store, localValues } = createStore();

    assert.equal(await store.importFromJSON(JSON.stringify(fullPayload())), true);
    assert.equal(store.data.deptData.dept_default.machines[0].id, 'imported-machine');
    assert.equal(JSON.parse(localValues.get(mainKey)).deptData.dept_default.machines[0].id, 'imported-machine');
    assert.equal(JSON.parse(localValues.get('skillEvaluations')).imported.level, 3);
    assert.equal(JSON.parse(localValues.get('manualSkills'))[0].id, 'imported-skill');
});

test('failed department save restores its machines and skill values', async () => {
    const { store, localValues, failures } = createStore();
    const original = store.data;
    const oldDepartment = store.activeData;
    failures.add(mainKey);
    const imported = {
        type: 'single_department_backup',
        departmentName: '工程',
        data: { machines: [{ id: 'imported-machine' }], tasks: [], history: [] },
        skillEvaluations: { imported: { level: 1 } },
        manualSkills: [{ id: 'new-skill' }]
    };

    const result = await store.importToCurrentDeptFromJSON(JSON.stringify(imported));
    assert.equal(result.success, false);
    assert.equal(store.data, original);
    assert.equal(store.activeData, oldDepartment);
    assert.equal(store.activeData.machines[0].id, 'original-machine');
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
    assert.equal(localValues.get('manualSkills'), '[{"id":"original-skill"}]');
});

test('asynchronous IndexedDB save rejection also restores import edits', async () => {
    const { store, localValues } = createStore();
    const original = store.data;
    store.save = async () => { throw new Error('Transaction aborted'); };

    assert.equal(await store.importFromJSON(JSON.stringify(fullPayload())), false);
    assert.equal(store.data, original);
    assert.equal(store.activeData.machines[0].id, 'original-machine');
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
    assert.equal(localValues.get('manualSkills'), '[{"id":"original-skill"}]');
});

test('successful department import replaces only its department and merges skills', async () => {
    const { store, localValues } = createStore();
    const imported = {
        type: 'single_department_backup',
        departmentName: '取込元',
        data: { machines: [{ id: 'imported-machine' }], tasks: [], history: [] },
        skillEvaluations: { imported: { level: 1 } },
        manualSkills: [{ id: 'original-skill' }, { id: 'new-skill' }]
    };

    const result = await store.importToCurrentDeptFromJSON(JSON.stringify(imported));
    assert.equal(result.success, true);
    assert.equal(store.activeData.machines[0].id, 'imported-machine');
    assert.equal(JSON.parse(localValues.get(mainKey)).deptData.dept_default.machines[0].id, 'imported-machine');
    const evaluations = JSON.parse(localValues.get('skillEvaluations'));
    assert.equal(evaluations.original.level, 2);
    assert.equal(evaluations.imported.level, 1);
    assert.deepEqual(JSON.parse(localValues.get('manualSkills')).map(item => item.id), ['original-skill', 'new-skill']);
});

test('department import rejects a missing data payload before changing skills', async () => {
    const { store, localValues, writes } = createStore();
    const result = await store.importToCurrentDeptFromJSON(JSON.stringify({
        type: 'single_department_backup', skillEvaluations: { imported: {} }
    }));
    assert.equal(result.success, false);
    assert.deepEqual(writes, []);
    assert.equal(localValues.get('skillEvaluations'), '{"original":{"level":2}}');
});

test('department import reports a malformed history field without changing data', async () => {
    const { store, writes } = createStore();
    const original = store.data;
    const result = await store.importToCurrentDeptFromJSON(JSON.stringify({
        type: 'single_department_backup',
        data: { machines: [], tasks: [], history: [{ id: 'h1', replacedParts: { bad: true } }] }
    }));
    assert.equal(result.success, false);
    assert.match(result.message, /history\[0\]\.replacedParts/);
    assert.equal(store.data, original);
    assert.deepEqual(writes, []);
});

test('default task and history dates use the local date helper', () => {
    const { store, StoreClass } = createStore();
    StoreClass.toLocalDateString = () => '2026-11-14';
    const task = store.addTask('machine-1', '点検', 7);
    const history = store.addHistoryRecord({ machineId: 'machine-1', scheduledDate: '2026-11-13' });
    assert.equal(task.startDate, '2026-11-14');
    assert.equal(history.date, '2026-11-14');
    assert.equal(history.scheduledDate, '2026-11-13');
});
