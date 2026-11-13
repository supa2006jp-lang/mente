const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createApp(task, history = []) {
    const elements = new Map();
    const machines = [{ id: 'machine-1', model: 'A' }];
    let saves = 0;
    const store = {
        activeData: { tasks: [task], history },
        getTasks() { return this.activeData.tasks; },
        getMachines() { return machines; },
        isMaintenanceTaskArchived() { return false; },
        save() { saves++; }
    };
    class MaintenanceApp {
        static toHalfWidthLower(value) { return String(value).toLowerCase(); }
    }
    const context = vm.createContext({
        MaintenanceApp,
        store,
        document: { getElementById(id) { return elements.get(id); } },
        confirm: () => true,
        Date
    });
    for (const name of ['app-calendar-support.js', 'app-machines.js']) {
        const source = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
        vm.runInContext(source, context, { filename: name });
    }
    const app = new MaintenanceApp();
    app.getLocalDateString = () => '2026-11-16';
    app.renderCalendar = () => {};
    return { app, store, elements, get saves() { return saves; } };
}

const recurring = () => ({ id: 'task-1', machineId: 'machine-1', content: '点検', startDate: '2026-11-01', periodDays: 7 });
const dates = (app, task, end = '2026-12-01') => Array.from(app.getTaskScheduledDatesBetween(task, '2026-11-01', end));

test('moving a recurring occurrence preserves earlier dates and linked completion', () => {
    const task = recurring();
    const history = [{ taskId: task.id, date: '2026-11-03', scheduledDate: '2026-11-01' }];
    const fixture = createApp(task, history);
    const { app } = fixture;
    app.handleTaskDrop(task.id, '2026-11-08', '2026-11-10');

    assert.deepEqual(dates(app, task, '2026-11-30'), ['2026-11-01', '2026-11-10', '2026-11-17', '2026-11-24']);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-01'), true);
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 0);
    assert.equal(app.getScheduledTasksForDate('2026-11-10').length, 1);
    assert.equal(app.getMachineMaintenanceNextDue(task, '2026-11-11'), '2026-11-10');
    assert.equal(fixture.saves, 1);
    assert.equal(task.scheduleHistory[0].untilDate, '2026-11-08');
});

test('a historical occurrence remains completable but cannot be dragged again', () => {
    const task = recurring();
    const fixture = createApp(task);
    const { app } = fixture;
    app.handleTaskDrop(task.id, '2026-11-15', '2026-11-17');
    assert.equal(app.isScheduledTaskOccurrenceDate(task, '2026-11-08'), true);
    assert.equal(app.isTaskScheduleOccurrenceDraggable(task, '2026-11-08'), false);
    assert.equal(app.isTaskScheduleOccurrenceDraggable(task, '2026-11-17'), true);
    const before = JSON.stringify(task);
    app.handleTaskDrop(task.id, '2026-11-08', '2026-11-10');
    assert.equal(JSON.stringify(task), before);
    assert.equal(fixture.saves, 1);
    assert.equal(app.isScheduledTaskOccurrenceDate(task, '2026-11-17'), true);
    fixture.store.activeData.history.push({ taskId: task.id, date: '2026-11-08', scheduledDate: '2026-11-08' });
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-08'), true);
});

test('large move earlier keeps all prior occurrences and merges overlapping days', () => {
    const task = recurring();
    const { app } = createApp(task);
    app.handleTaskDrop(task.id, '2026-11-15', '2026-11-03');
    assert.deepEqual(dates(app, task, '2026-11-24'), [
        '2026-11-01', '2026-11-03', '2026-11-08', '2026-11-17', '2026-11-24'
    ]);
    assert.equal(app.getScheduledTasksForDate('2026-11-10').length, 0);
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 1);
    assert.equal(app.getScheduledTasksForDate('2026-11-03').length, 1);
    assert.equal(app.isTaskScheduleOccurrenceDraggable(task, '2026-11-03'), false);
    assert.equal(app.isTaskScheduleOccurrenceDraggable(task, '2026-11-17'), true);
    app.handleTaskDrop(task.id, '2026-11-17', '2026-11-08');
    assert.equal(dates(app, task, '2026-11-24').filter(date => date === '2026-11-08').length, 1);
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 1);
});

test('legacy completion without a planned date is loose only for a lone one-off segment', () => {
    const task = {
        id: 'one-off', machineId: 'machine-1', startDate: '2026-11-10', periodDays: 0,
        scheduleEffectiveDate: '2026-11-05',
        scheduleHistory: [{ startDate: '2026-11-01', periodDays: 0, fromDate: '2026-11-01', untilDate: '2026-11-05' }]
    };
    const history = [{ taskId: task.id, date: '2026-11-03' }];
    const { app } = createApp(task, history);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-01'), false);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-10'), false);
    history.push({ taskId: task.id, date: '2026-11-01' });
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-01'), true);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-10'), false);

    app._calendarRenderCache = {
        completionByTaskDate: new Set([JSON.stringify([task.id, '2026-11-01'])]),
        legacyCompletionByTask: new Set([task.id])
    };
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-10'), false);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-01'), true);
    app._calendarRenderCache = null;

    const mixed = {
        ...task,
        scheduleHistory: [{ startDate: '2026-11-01', periodDays: 7, fromDate: '2026-11-01', untilDate: '2026-11-05' }]
    };
    assert.equal(app.isScheduledTaskOccurrenceDone(mixed, '2026-11-10', [{ taskId: task.id, date: '2026-11-03' }]), false);
    const lone = { id: task.id, machineId: task.machineId, startDate: '2026-11-01', periodDays: 0 };
    assert.equal(app.isScheduledTaskOccurrenceDone(lone, '2026-11-01', [{ taskId: task.id, date: '2026-11-03' }]), true);
});

test('old occurrence type follows its own schedule segment', () => {
    const task = {
        id: 'changing-type', machineId: 'machine-1', startDate: '2026-11-20', periodDays: 7,
        scheduleEffectiveDate: '2026-11-16',
        scheduleHistory: [{ startDate: '2026-11-01', periodDays: 0, fromDate: '2026-11-01', untilDate: '2026-11-16' }]
    };
    const { app } = createApp(task);
    assert.equal(app.getScheduledTaskOccurrencePeriodDays(task, '2026-11-01'), 0);
    assert.equal(app.getScheduledTaskOccurrencePeriodDays(task, '2026-11-20'), 7);
    task.scheduleHistory[0].periodDays = 7;
    task.periodDays = 0;
    assert.equal(app.getScheduledTaskOccurrencePeriodDays(task, '2026-11-08'), 7);
    assert.equal(app.getScheduledTaskOccurrencePeriodDays(task, '2026-11-20'), 0);
});

test('multiple moves survive JSON serialization and preserve the completed old cycle', () => {
    const task = recurring();
    const history = [{ taskId: task.id, date: '2026-11-16', scheduledDate: '2026-11-15' }];
    const { app } = createApp(task, history);
    app.handleTaskDrop(task.id, '2026-11-22', '2026-11-25');
    app.handleTaskDrop(task.id, '2026-12-02', '2026-12-05');
    const restored = JSON.parse(JSON.stringify(task));
    assert.deepEqual(Array.from(app.getTaskScheduledDatesBetween(restored, '2026-11-01', '2026-12-20')), [
        '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-25', '2026-12-05', '2026-12-12', '2026-12-19'
    ]);
    assert.equal(app.isScheduledTaskOccurrenceDone(restored, '2026-11-15'), true);
    assert.equal(app.getMachineMaintenanceNextDue(restored, '2026-11-16'), '2026-11-01');
});

test('editing cycle length keeps prior schedule while the new cycle takes effect today', () => {
    const task = recurring();
    const { app } = createApp(task);
    app.updateTaskScheduleFromEditor(task, '2026-11-17', 10);
    assert.deepEqual(dates(app, task, '2026-12-01'), [
        '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-17', '2026-11-27'
    ]);
    assert.equal(task.periodDays, 10);
    assert.equal(task.scheduleEffectiveDate, '2026-11-16');
});

test('clearing an edited start date retains earlier scheduled history', () => {
    const task = recurring();
    const { app } = createApp(task);
    app.updateTaskScheduleFromEditor(task, '', 0);
    assert.equal(task.startDate, '');
    assert.deepEqual(dates(app, task, '2026-11-30'), ['2026-11-01', '2026-11-08', '2026-11-15']);
    assert.equal(app.getNextTaskScheduledDate(task, '2026-11-16'), '');
});

test('reopening an existing task does not fill its intentionally blank start date', () => {
    class MaintenanceApp {}
    const rows = [];
    const document = {
        getElementById(id) { return id === 'f-tasks-container' ? { appendChild(row) { rows.push(row); } } : null; },
        createElement() { return { style: {}, innerHTML: '', querySelector() { return null; } }; }
    };
    const store = { activeData: { history: [] } };
    const context = vm.createContext({ MaintenanceApp, document, store, Date });
    const source = fs.readFileSync(path.join(__dirname, '..', 'app-maintenance-forms.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'app-maintenance-forms.js' });
    const app = new MaintenanceApp();
    app.escapeHtml = value => String(value);
    app.getLocalDateString = () => '2026-11-16';
    app.updateOneOffBadge = () => {};
    app.addTaskRow({ id: 'task-1', content: '点検', startDate: '', periodDays: 0 });
    assert.equal(rows.length, 1);
    assert.match(rows[0].innerHTML, /class="t-start"[^>]*value=""/);
});

test('one-off move and legacy recurring data remain compatible', () => {
    const oneOff = { id: 'one-off', machineId: 'machine-1', content: '単発', startDate: '2026-11-01', periodDays: 0 };
    const { app } = createApp(oneOff);
    app.handleTaskDrop(oneOff.id, '2026-11-01', '2026-11-11');
    assert.equal(oneOff.startDate, '2026-11-11');
    assert.equal(oneOff.scheduleHistory, undefined);
    assert.deepEqual(Array.from(app.getTaskScheduledDatesBetween(oneOff, '2026-11-01', '2026-11-30')), ['2026-11-11']);
    const oldTask = recurring();
    assert.deepEqual(Array.from(app.getTaskScheduledDatesBetween(oldTask, '2026-11-01', '2026-11-15')), [
        '2026-11-01', '2026-11-08', '2026-11-15'
    ]);
});

test('telop and cached calendar access use the moved schedule', () => {
    const task = recurring();
    const { app, store, elements } = createApp(task);
    app.handleTaskDrop(task.id, '2026-11-15', '2026-11-17');
    store.activeData.history.push(
        { taskId: task.id, date: '2026-11-01' },
        { taskId: task.id, date: '2026-11-08', scheduledDate: '2026-11-08' }
    );
    const telop = { innerHTML: '' };
    elements.set('cal-telop-text', telop);
    elements.set('cal-telop-container', { classList: { add() {}, remove() {} } });
    app.updateTelop();
    assert.match(telop.innerHTML, /未完了の定期メンテナンスはありません/);

    const scheduled = [task];
    app._calendarRenderCache = {
        historyByDate: new Map([['2026-11-01', [
            { taskId: task.id, date: '2026-11-01' },
            { date: '2026-11-01', isManualGuide: true }
        ]]]),
        scheduledByDate: new Map([['2026-11-17', scheduled]]),
        completionByTaskDate: new Set([JSON.stringify([task.id, '2026-11-08'])]),
        legacyCompletionByTask: new Set()
    };
    assert.equal(app.getScheduledTasksForDate('2026-11-17'), scheduled);
    assert.equal(app.getHistoryForDate('2026-11-01').length, 1);
    assert.equal(app.isScheduledTaskOccurrenceDone(task, '2026-11-08'), true);
});

test('monthly stats use indexed history and scheduled dates', () => {
    const task = recurring();
    const { app, store, elements } = createApp(task);
    app.currentDate = new Date(2026, 10, 1);
    const scheduledByDate = new Map();
    for (let day = 1; day <= 30; day++) scheduledByDate.set(`2026-11-${String(day).padStart(2, '0')}`, []);
    scheduledByDate.set('2026-11-17', [task]);
    app._calendarRenderCache = {
        historyByDate: new Map([['2026-11-08', [
            { taskId: task.id, date: '2026-11-08' },
            { date: '2026-11-08', isDokatei: true, workTime: '30' }
        ]]]),
        scheduledByDate
    };
    store.activeData.history = new Proxy([], {
        get(target, property) {
            if (property === 'filter') throw new Error('The full history must not be rescanned');
            return Reflect.get(target, property);
        }
    });
    for (const id of ['remaining', 'done', 'sudden-count', 'dokatei-count', 'dokatei-time']) {
        elements.set(`cal-stat-${id}`, { textContent: '' });
    }
    app.updateCalendarStats();
    assert.equal(elements.get('cal-stat-remaining').textContent, 1);
    assert.equal(elements.get('cal-stat-done').textContent, 1);
    assert.equal(elements.get('cal-stat-sudden-count').textContent, 1);
    assert.equal(elements.get('cal-stat-dokatei-count').textContent, 1);
    assert.equal(elements.get('cal-stat-dokatei-time').textContent, 30);
});
