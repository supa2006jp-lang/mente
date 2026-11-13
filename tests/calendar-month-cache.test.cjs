const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-calendar.js'), 'utf8');
const supportSource = fs.readFileSync(path.join(__dirname, '..', 'app-calendar-support.js'), 'utf8');

function makeApp(history, tasks = []) {
    class MaintenanceApp {}
    const store = {
        activeData: { history, tasks },
        getMachines: () => [{ id: 'machine-1' }],
        isMaintenanceTaskArchived: () => false
    };
    const metrics = new Map();
    const document = {
        getElementById(id) {
            if (!metrics.has(id)) metrics.set(id, { textContent: '' });
            return metrics.get(id);
        }
    };
    const context = vm.createContext({ MaintenanceApp, store, document, console });
    vm.runInContext(source, context, { filename: 'app-calendar.js' });
    vm.runInContext(supportSource, context, { filename: 'app-calendar-support.js' });
    return { app: new MaintenanceApp(), store, metrics, document };
}

test('calendar month cache indexes history in one pass and keeps planned completion dates', () => {
    let scanned = 0;
    const records = [
        { id: 'late', taskId: 'task-1', date: '2026-11-10', scheduledDate: '2026-11-08' },
        { id: 'legacy', taskId: 'task-2', date: '2026-11-08' },
        { id: 'guide', date: '2026-11-10', isManualGuide: true }
    ];
    const history = {
        *[Symbol.iterator]() {
            for (const record of records) { scanned += 1; yield record; }
        }
    };
    const { app } = makeApp(history);
    const cache = app.buildCalendarRenderCache();

    assert.equal(scanned, records.length);
    assert.equal(cache.historyByDate.get('2026-11-10').length, 2);
    assert.equal(cache.historyByDate.get('2026-11-08')[0].id, 'legacy');
    assert.equal(cache.completionByTaskDate.has(JSON.stringify(['task-1', '2026-11-08'])), true);
    assert.equal(cache.completionByTaskDate.has(JSON.stringify(['task-1', '2026-11-10'])), false);
    assert.equal(cache.completionByTaskDate.has(JSON.stringify(['task-2', '2026-11-08'])), true);
    assert.equal(cache.legacyCompletionByTask.has('task-2'), true);
    assert.equal(cache.legacyCompletionByTask.has('task-1'), false);
});

test('each calendar render receives a fresh index after history changes', () => {
    const history = [{ id: 'one', date: '2026-11-08' }];
    const { app } = makeApp(history);
    const first = app.buildCalendarRenderCache();
    history.push({ id: 'two', date: '2026-11-09' });
    const second = app.buildCalendarRenderCache();

    assert.equal(first.historyByDate.has('2026-11-09'), false);
    assert.equal(second.historyByDate.get('2026-11-09')[0].id, 'two');
    assert.notEqual(first.scheduledByDate, second.scheduledByDate);
});

test('multiple schedule shifts retain old occurrences and count completions on work dates', () => {
    const task = { id: 'cycle', machineId: 'machine-1', startDate: '2026-11-01', periodDays: 7 };
    const history = [
        { taskId: 'cycle', date: '2026-11-09', scheduledDate: '2026-11-08' },
        { taskId: 'cycle', date: '2026-11-18', scheduledDate: '2026-11-17' }
    ];
    const { app, metrics } = makeApp(history, [task]);
    assert.equal(app.replaceTaskScheduleFromDate(task, '2026-11-15', '2026-11-17', 7), true);
    assert.equal(app.replaceTaskScheduleFromDate(task, '2026-11-24', '2026-11-22', 7), true);

    app.currentDate = new Date(2026, 10, 1);
    app._calendarRenderCache = app.buildCalendarRenderCache();
    app.indexCalendarScheduledTasks(2026, 10);
    const pendingDates = [...app._calendarRenderCache.scheduledByDate]
        .filter(([, tasks]) => tasks.length > 0)
        .map(([date]) => date);
    assert.deepEqual(pendingDates, ['2026-11-01', '2026-11-22', '2026-11-29']);
    assert.equal(app.getScheduledTasksForDate('2026-11-08').length, 0);
    assert.equal(app.getScheduledTasksForDate('2026-11-17').length, 0);
    app.updateCalendarStats();
    assert.equal(metrics.get('cal-stat-remaining').textContent, 3);
    assert.equal(metrics.get('cal-stat-done').textContent, 2);
});

test('monthly task index generates each task once, then serves all days and stats', () => {
    const tasks = Array.from({ length: 25 }, (_, index) => ({
        id: `daily-${index}`, machineId: 'machine-1', startDate: '2026-11-01', periodDays: 1
    }));
    let taskVisits = 0;
    const countedTasks = {
        *[Symbol.iterator]() {
            for (const task of tasks) { taskVisits++; yield task; }
        }
    };
    const { app, metrics } = makeApp([], countedTasks);
    let generated = 0;
    const getDates = app.getTaskScheduledDatesBetween;
    app.getTaskScheduledDatesBetween = function (...args) {
        generated++;
        return getDates.apply(this, args);
    };

    app.currentDate = new Date(2026, 10, 1);
    app._calendarRenderCache = app.buildCalendarRenderCache();
    app.indexCalendarScheduledTasks(2026, 10);
    for (let day = 1; day <= 30; day++) {
        const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
        assert.equal(app.getScheduledTasksForDate(dateStr).length, tasks.length);
    }
    app.updateCalendarStats();

    assert.equal(taskVisits, tasks.length);
    assert.equal(generated, tasks.length);
    assert.equal(metrics.get('cal-stat-remaining').textContent, tasks.length * 30);
});

test('render restores the previous cache even if month indexing fails', () => {
    const { app, document } = makeApp([]);
    const existingCache = { marker: 'outer render' };
    app._calendarRenderCache = existingCache;
    app.currentDate = new Date(2026, 10, 1);
    app.renderCalendarLegend = () => {};
    document.getElementById = id => id === 'calendar-days'
        ? { closest: () => null, innerHTML: '' }
        : null;
    const failure = new Error('index failed');
    app.indexCalendarScheduledTasks = () => {
        assert.notEqual(app._calendarRenderCache, existingCache);
        throw failure;
    };

    assert.throws(() => app.renderCalendar(), error => error === failure);
    assert.equal(app._calendarRenderCache, existingCache);
});
