const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function makeApp(tasks, history = []) {
    const alerts = [];
    const elements = new Map();
    const machine = { id: 'machine-1', name: '機械', model: 'A', lineNo: '1', category: '装置' };
    const store = {
        activeData: { tasks, history },
        getMachines() { return [machine]; },
        getTasks() { return tasks; },
        isMaintenanceTaskArchived() { return false; },
        addHistoryRecord(record) {
            const saved = { id: `history-${history.length + 1}`, ...record };
            history.push(saved);
            return saved;
        },
        async runAtomicSaveBatch(mutate) { return mutate(); },
        updateMachine() { throw new Error('Machine should not change'); },
        adjustStock() { throw new Error('Stock should not change'); }
    };
    class MaintenanceApp {
        static toHalfWidthLower(value) { return String(value).toLowerCase(); }
    }
    const document = {
        getElementById(id) { return elements.get(id) || null; },
        querySelectorAll() { return []; },
        querySelector() { return { value: 'first' }; }
    };
    const context = vm.createContext({ MaintenanceApp, store, document, alert: value => alerts.push(value), console, Date });
    for (const name of ['app-calendar-support.js', 'app-machines.js', 'app-maintenance-forms.js']) {
        vm.runInContext(read(name), context, { filename: name });
    }
    const app = new MaintenanceApp();
    app.escapeHtml = value => String(value);
    app.generateLineOptionsHTML = () => '';
    app.getMachineCategoryOptions = () => '';
    app.getCategoryFromModalInput = () => '装置';
    app.openModal = (_type, _title, render) => render();
    app.closeModal = () => {};
    app.renderCalendar = () => {};
    app.renderHistory = () => {};
    app.renderDashboard = () => {};
    return { app, store, alerts, elements, machine };
}

const periodic = () => ({ id: 'task-1', machineId: 'machine-1', content: '点検', startDate: '2026-11-01', periodDays: 7 });

test('a delayed completion clears only its explicitly linked periodic occurrence', () => {
    const task = periodic();
    const history = [{ taskId: task.id, date: '2026-11-10', scheduledDate: '2026-11-08' }];
    const { app } = makeApp([task], history);
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 0);
    assert.equal(app.getScheduledTasksForDate('2026-11-01').length, 1);
    assert.equal(app.getScheduledTasksForDate('2026-11-15').length, 1);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-10'), false);
});

test('legacy records retain same-day periodic matching and one-off completion', () => {
    const task = periodic();
    const oneOff = { id: 'one-off', machineId: 'machine-1', startDate: '2026-11-01', periodDays: 0 };
    const { app } = makeApp([task, oneOff], [
        { taskId: task.id, date: '2026-11-08' },
        { taskId: oneOff.id, date: '2026-11-03' },
        { taskId: 'other-task', date: '2026-11-15', scheduledDate: '2026-11-15' }
    ]);
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 0);
    assert.equal(app.getScheduledTasksForDate('2026-11-01').map(t => t.id).join(','), task.id);
    assert.equal(app.getScheduledTasksForDate('2026-11-15').length, 1);
});

test('machine next due uses the linked schedule date, including a completed due today', () => {
    const task = periodic();
    const { app } = makeApp([task], [
        { taskId: task.id, date: '2026-11-01', scheduledDate: '2026-11-01' },
        { taskId: task.id, date: '2026-11-10', scheduledDate: '2026-11-08' }
    ]);
    assert.equal(app.getMachineMaintenanceNextDue(task, '2026-11-10'), '2026-11-15');
    assert.equal(app.getMachineMaintenanceNextDue(task, '2026-11-15'), '2026-11-15');
    app.openCompletionForm = () => {};
    assert.equal(app.isScheduledTaskOccurrenceDate(task, '2026-11-10'), false);
    assert.equal(app.isScheduledTaskOccurrenceDate(task, '2026-11-15'), true);
});

test('completion form records actual and planned dates separately', async () => {
    const task = periodic();
    const { app, store, elements, alerts } = makeApp([task]);
    const content = { innerHTML: '' };
    elements.set('modal-content', content);
    app.openCompletionForm(task.id, '2026-11-08');
    assert.match(content.innerHTML, /id="c-scheduled-date" value="2026-11-08"/);
    assert.match(content.innerHTML, /id="c-date" value="2026-11-08"/);
    const values = {
        'c-task-id': task.id, 'c-machine-id': task.machineId, 'c-line-no': '1',
        'c-date': '2026-11-10', 'c-scheduled-date': '2026-11-08',
        'c-notes': '完了', 'c-work-time': '30', 'c-workers': '担当者', 'c-category': 'planned'
    };
    for (const [id, value] of Object.entries(values)) elements.set(id, { value, focus() {} });
    elements.set('complete-form', { reportValidity: () => true });
    await app.saveModalData('complete');
    assert.deepEqual(alerts, []);
    assert.equal(store.activeData.history.length, 1);
    assert.equal(store.activeData.history[0].date, '2026-11-10');
    assert.equal(store.activeData.history[0].scheduledDate, '2026-11-08');
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 0);
});

test('completion form refuses a date outside the task cycle', async () => {
    const task = periodic();
    const { app, store, elements, alerts } = makeApp([task]);
    const values = {
        'c-task-id': task.id, 'c-machine-id': task.machineId, 'c-line-no': '1',
        'c-date': '2026-11-10', 'c-scheduled-date': '2026-11-10',
        'c-notes': '完了', 'c-work-time': '30', 'c-workers': '担当者', 'c-category': 'planned'
    };
    for (const [id, value] of Object.entries(values)) elements.set(id, { value, focus() {} });
    elements.set('complete-form', { reportValidity: () => true });
    await app.saveModalData('complete');
    assert.equal(store.activeData.history.length, 0);
    assert.match(alerts[0], /周期に該当する日付/);
});

test('late work removes the overdue telop entry for its planned day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const due = localDate(yesterday);
    const task = { id: 'one-off', machineId: 'machine-1', content: '点検', startDate: due, periodDays: 0 };
    const recurring = { id: 'recurring', machineId: 'machine-1', content: '巡回', startDate: due, periodDays: 100 };
    const { app, store, elements } = makeApp([task, recurring]);
    const telop = { classList: { add() {}, remove() {} } };
    elements.set('cal-telop-text', telop);
    elements.set('cal-telop-container', { classList: { add() {}, remove() {} } });
    store.activeData.history.push({ taskId: task.id, date: localDate(new Date()), scheduledDate: due });
    store.activeData.history.push({ taskId: recurring.id, date: localDate(new Date()), scheduledDate: due });
    app.updateTelop();
    assert.match(telop.innerHTML, /未完了の定期メンテナンスはありません/);
});
