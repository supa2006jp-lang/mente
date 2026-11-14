'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function makeApp() {
    class MaintenanceApp {}
    const fields = new Map();
    const alerts = [];
    const counts = { closed: 0, history: 0, calendar: 0, machines: 0 };
    const store = {
        activeData: { history: [], tasks: [] },
        freezeTaskContentInHistory() {},
        getMachines() { return []; }
    };
    const document = { getElementById(id) { return fields.get(id) || null; } };
    const context = vm.createContext({
        MaintenanceApp, store, document, confirm: () => true,
        alert: message => alerts.push(message), console: { error() {} }
    });
    vm.runInContext(read('app-maintenance-forms.js'), context);
    vm.runInContext(read('app-history.js'), context);
    const app = new MaintenanceApp();
    app.closeModal = () => { counts.closed++; };
    app.clearHistorySelection = () => {};
    app.updateDataLists = () => {};
    app.renderHistory = () => { counts.history++; };
    app.renderCalendar = () => { counts.calendar++; };
    app.renderMachines = () => { counts.machines++; };
    return { app, store, fields, alerts, counts };
}

function deferredBatch(store) {
    let resolve;
    let reject;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    store.runAtomicSaveBatch = mutate => { mutate(); return pending; };
    return { resolve, reject };
}

test('bulk history edit closes and reports success only after its save completes', async () => {
    const { app, store, fields, counts } = makeApp();
    const history = { id: 'history-1', lineNo: '1' };
    store.activeData.history.push(history);
    app.getSelectedHistoryRecords = () => [history];
    fields.set('bulk-use-line', { checked: true });
    fields.set('bulk-line-no', { value: '2' });
    const batch = deferredBatch(store);
    const save = app.applyHistoryBulkEdit();
    assert.equal(history.lineNo, '2');
    assert.equal(counts.closed, 0);
    assert.equal(counts.history, 0);
    batch.resolve();
    await save;
    assert.equal(counts.closed, 1);
    assert.equal(counts.history, 1);
});

test('failed single maintenance deletion keeps the form open', async () => {
    const { app, store, counts, alerts } = makeApp();
    store.activeData.tasks = [{ id: 'task-1' }];
    const batch = deferredBatch(store);
    const removal = app.deleteOneOffMaintenanceFromCompletion('task-1', '点検');
    assert.equal(counts.closed, 0);
    batch.reject(new Error('quota full'));
    await removal;
    assert.equal(counts.closed, 0);
    assert.equal(counts.calendar, 0);
    assert.match(alerts[0], /保存できませんでした/);
});
