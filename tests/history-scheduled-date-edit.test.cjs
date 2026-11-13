const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const periodic = () => ({ id: 'task-1', machineId: 'machine-1', content: '週次点検', startDate: '2026-11-01', periodDays: 7 });

function makeApp(history, tasks = [periodic()]) {
    const alerts = [];
    const elements = new Map();
    const counts = { saves: 0, stock: 0, calendar: 0 };
    const machine = { id: 'machine-1', name: '機械', model: 'A', category: '装置' };
    const store = {
        activeData: { tasks, history },
        getMachines() { return [machine]; },
        getWorkers() { return []; },
        save() { counts.saves++; },
        adjustStock() { counts.stock++; },
        updateMachine() { throw new Error('Machine category must not change'); }
    };
    class MaintenanceApp {}
    const footer = { innerHTML: '' };
    const document = {
        getElementById(id) { return elements.get(id) || null; },
        querySelector(selector) { return selector === '.modal-footer' ? footer : { value: 'first' }; },
        querySelectorAll() { return []; }
    };
    const context = vm.createContext({ MaintenanceApp, MaintenanceStore: {}, store, document, alert: value => alerts.push(value), console, Date });
    for (const name of ['app-calendar-support.js', 'app-maintenance-forms.js', 'app-history.js']) {
        vm.runInContext(read(name), context, { filename: name });
    }
    const app = new MaintenanceApp();
    app.escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    app.escapeJs = value => String(value);
    app.getHistoryNeighborNavHtml = () => '';
    app.generateLineOptionsHTML = () => '';
    app.getMachineCategoryOptions = () => '';
    app.getHistoryDisplayText = h => h.taskContent || h.errorContent || '点検';
    app.getRelatedHistoryLinksHtml = () => '';
    app.openModal = (_type, _title, render) => render();
    app.setupAutoResizeTextareas = () => {};
    app.onSuddenMachineChange = () => {};
    app.confirmPartialMaintenanceTime = () => true;
    app.getCategoryFromModalInput = () => '装置';
    app.getCurrentRecurrenceMeta = () => null;
    app.getHistoryPhotosForSave = () => [];
    app.updateDataLists = () => {};
    app.closeModal = () => {};
    app.renderCalendar = () => { counts.calendar++; };
    app.renderHistory = () => {};
    app.renderDashboard = () => {};
    elements.set('modal-content', { innerHTML: '' });
    elements.set('e-photo-previews', { innerHTML: '' });
    return { app, store, elements, alerts, counts, footer };
}

function fillEditForm(elements, { scheduledDate, date = '2026-11-10' } = {}) {
    const values = {
        'e-h-id': 'history-1', 'e-machine-id': 'machine-1', 'e-line-no': '1',
        'e-date': date, 'e-symptom': '点検', 'e-notes': '完了', 'e-cause': '',
        'e-error-no': '', 'e-work-time': '30', 'e-workers': '担当者', 'e-category': 'other'
    };
    for (const [id, value] of Object.entries(values)) elements.set(id, { value });
    if (scheduledDate !== undefined) elements.set('e-scheduled-date', { value: scheduledDate, focus() {} });
    elements.set('e-is-dokatei', { checked: false });
    elements.set('edit-history-form', { reportValidity: () => true });
}

test('edit form shows the planned date separately from the work date', () => {
    const history = [{ id: 'history-1', taskId: 'task-1', date: '2026-11-10', scheduledDate: '2026-11-08' }];
    const { app, elements } = makeApp(history);
    app.openHistoryEditForm('history-1');
    const html = elements.get('modal-content').innerHTML;
    assert.match(html, /id="e-date" value="2026-11-10"/);
    assert.match(html, /id="e-scheduled-date" value="2026-11-08"/);
    assert.match(html, /対象の予定日/);
});

test('legacy periodic history only infers a planned date when the work date is on cycle', () => {
    const history = [
        { id: 'history-1', taskId: 'task-1', date: '2026-11-10' },
        { id: 'history-2', taskId: 'task-1', date: '2026-11-08' }
    ];
    const { app, elements } = makeApp(history);
    app.openHistoryEditForm('history-1');
    assert.match(elements.get('modal-content').innerHTML, /id="e-scheduled-date" value=""/);
    app.openHistoryEditForm('history-2');
    assert.match(elements.get('modal-content').innerHTML, /id="e-scheduled-date" value="2026-11-08"/);
});

test('valid planned date correction saves without changing the work date and redraws the calendar', () => {
    const history = [{ id: 'history-1', taskId: 'task-1', machineId: 'machine-1', date: '2026-11-10', scheduledDate: '2026-11-08' }];
    const { app, store, elements, alerts, counts } = makeApp(history);
    fillEditForm(elements, { scheduledDate: '2026-11-15' });
    app.saveModalData('edit-history');
    assert.deepEqual(alerts, []);
    assert.equal(store.activeData.history[0].date, '2026-11-10');
    assert.equal(store.activeData.history[0].scheduledDate, '2026-11-15');
    assert.equal(counts.saves, 1);
    assert.equal(counts.calendar, 1);
});

test('off-cycle planned date rejects before history and inventory changes', () => {
    const record = { id: 'history-1', taskId: 'task-1', machineId: 'machine-1', date: '2026-11-10', scheduledDate: '2026-11-08', replacedParts: [{ name: '部品', model: 'A', count: 1 }] };
    const { app, store, elements, alerts, counts } = makeApp([record]);
    fillEditForm(elements, { scheduledDate: '2026-11-12' });
    app.saveModalData('edit-history');
    assert.equal(store.activeData.history[0], record);
    assert.equal(counts.stock, 0);
    assert.equal(counts.saves, 0);
    assert.equal(counts.calendar, 0);
    assert.match(alerts[0], /周期に該当する日付/);
});

test('old delayed history remains editable with an unknown planned date', () => {
    const history = [{ id: 'history-1', taskId: 'task-1', machineId: 'machine-1', date: '2026-11-10' }];
    const { app, store, elements, alerts } = makeApp(history);
    fillEditForm(elements, { scheduledDate: '' });
    app.saveModalData('edit-history');
    assert.deepEqual(alerts, []);
    assert.equal(store.activeData.history[0].scheduledDate, undefined);
});

test('an existing planned date stays editable after the task cycle changes', () => {
    const history = [{ id: 'history-1', taskId: 'task-1', machineId: 'machine-1', date: '2026-11-10', scheduledDate: '2026-11-08' }];
    const task = { ...periodic(), startDate: '2026-11-02' };
    const { app, store, elements, alerts, counts } = makeApp(history, [task]);
    fillEditForm(elements, { scheduledDate: '2026-11-08' });
    app.saveModalData('edit-history');
    assert.deepEqual(alerts, []);
    assert.equal(store.activeData.history[0].scheduledDate, '2026-11-08');
    assert.equal(counts.saves, 1);
});

test('legacy one-off history displays the task start as its planned date', () => {
    const task = { ...periodic(), periodDays: 0 };
    const history = [{ id: 'history-1', taskId: 'task-1', date: '2026-11-10' }];
    const { app, elements } = makeApp(history, [task]);
    app.openHistoryEditForm('history-1');
    assert.match(elements.get('modal-content').innerHTML, /id="e-scheduled-date" value="2026-11-01"/);
});

test('sudden response keeps its edit form and save path free of a planned date', () => {
    const history = [{ id: 'history-1', machineId: 'machine-1', isSudden: true, date: '2026-11-10' }];
    const { app, store, elements, alerts } = makeApp(history);
    app.openHistoryEditForm('history-1');
    assert.doesNotMatch(elements.get('modal-content').innerHTML, /id="e-scheduled-date"/);
    fillEditForm(elements);
    app.saveModalData('edit-history');
    assert.deepEqual(alerts, []);
    assert.equal(store.activeData.history[0].scheduledDate, undefined);
});
