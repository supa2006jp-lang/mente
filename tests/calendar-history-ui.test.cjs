const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeElement() {
    const classes = new Set();
    const element = {
        children: [],
        classList: {
            add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); },
            contains(name) { return classes.has(name); },
            toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
        },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener() {},
        closest() { return null; },
        querySelector(selector) { return selector === '.events-container' ? this.events : makeElement(); },
        querySelectorAll() { return []; },
        set className(value) { this._className = value; classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
        get className() { return this._className || ''; }
    };
    element.events = { children: [], classList: { add() {} }, appendChild(child) { this.children.push(child); return child; } };
    return element;
}

function makeApp(task) {
    class MaintenanceApp {
        static isModelBlank(value) { return !value; }
        static toHalfWidthLower(value) { return String(value).toLowerCase(); }
    }
    const calendarDays = makeElement();
    const modalContent = { innerHTML: '' };
    const stats = new Map();
    const document = {
        createElement() { return makeElement(); },
        getElementById(id) {
            if (id === 'calendar-days') return calendarDays;
            if (id === 'modal-content') return modalContent;
            if (id.startsWith('cal-stat-')) {
                if (!stats.has(id)) stats.set(id, makeElement());
                return stats.get(id);
            }
            return null;
        },
        querySelector() { return null; }
    };
    const store = {
        activeData: { tasks: [task], history: [], memos: {} },
        getMachines() { return [{ id: 'machine-1', model: 'A', name: '機械' }]; },
        isMaintenanceTaskArchived() { return false; }
    };
    const context = vm.createContext({ MaintenanceApp, document, store, Date, console });
    for (const name of ['app-calendar.js', 'app-calendar-support.js', 'app-calendar-details.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context, { filename: name });
    }
    const app = new MaintenanceApp();
    app.currentDate = new Date(2026, 10, 1);
    app.getCalendarBackgroundMode = () => 'anime';
    app.getLineStampLabel = () => '';
    app.escapeHtml = value => String(value);
    app.escapeJs = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    app.getLocalDateString = () => '2026-11-16';
    return { app, calendarDays, modalContent };
}

test('calendar badges block dragging historical dates while retaining completion click', () => {
    const task = { id: 'cycle', machineId: 'machine-1', content: '点検', startDate: '2026-11-17', periodDays: 7,
        scheduleEffectiveDate: '2026-11-17',
        scheduleHistory: [{ startDate: '2026-11-01', periodDays: 7, fromDate: '2026-11-01', untilDate: '2026-11-15' }] };
    const { app, calendarDays } = makeApp(task);
    app.renderCalendar();
    const badgeOn = day => calendarDays.children[day - 1].events.children.find(child => child.classList.contains('event-badge'));
    const oldBadge = badgeOn(8);
    const currentBadge = badgeOn(17);
    assert.equal(oldBadge.draggable, false);
    assert.match(oldBadge.title, /過去の周期の予定は移動できません/);
    assert.equal(typeof oldBadge.onclick, 'function');
    assert.equal(currentBadge.draggable, true);
    assert.equal(typeof currentBadge.ondragstart, 'function');
});

test('calendar and compact view classify old one-off dates by their original segment', () => {
    const task = { id: 'type-change', machineId: 'machine-1', content: '点検', startDate: '2026-11-20', periodDays: 7,
        scheduleEffectiveDate: '2026-11-16',
        scheduleHistory: [{ startDate: '2026-11-01', periodDays: 0, fromDate: '2026-11-01', untilDate: '2026-11-16' }] };
    const { app, calendarDays } = makeApp(task);
    app.renderCalendar();
    const badgeOn = day => calendarDays.children[day - 1].events.children.find(child => child.classList.contains('event-badge'));
    assert.equal(badgeOn(1).classList.contains('one-off-planned'), true);
    assert.equal(badgeOn(20).classList.contains('one-off-planned'), false);

    const oldChips = makeElement();
    const newChips = makeElement();
    const today = new Date(2026, 10, 16);
    app.renderCompactCalendarItems(oldChips, '2026-11-01', [], [task], '', new Date(2026, 10, 1), today);
    app.renderCompactCalendarItems(newChips, '2026-11-20', [], [task], '', new Date(2026, 10, 20), today);
    assert.equal(oldChips.children.some(chip => chip.classList.contains('one-off-planned')), true);
    assert.equal(newChips.children.some(chip => chip.classList.contains('planned')), true);
});

test('calendar detail actions render as keyboard-activatable buttons', () => {
    const task = { id: 'planned', machineId: 'machine-1', content: '予定', periodDays: 7 };
    const history = { id: 'history-1', machineId: 'machine-1', content: '完了記録', workers: [] };
    const { app, modalContent } = makeApp(task);
    app.getHistoryForDate = () => [history];
    app.getScheduledTasksForDate = () => [task];
    app.matchesCalendarLineFilter = () => true;
    app.getHistoryDisplayText = item => item.content;
    app.getScheduledTaskOccurrencePeriodDays = () => 7;
    app.openModal = (_type, _title, render) => render();

    app.openCalendarDayDetails('2026-11-16');
    assert.equal((modalContent.innerHTML.match(/<button type="button" class="compact-detail-card /g) || []).length, 2);
    assert.equal((modalContent.innerHTML.match(/<\/button>/g) || []).length, 2);
    assert.doesNotMatch(modalContent.innerHTML, /<div class="compact-detail-card [^"]+" onclick=/);

    app.openCompactCalendarDetails('2026-11-16', 'sudden');
    assert.match(modalContent.innerHTML, /<button type="button" class="compact-detail-card sudden"/);
    app.openCompactCalendarDetails('2026-11-16', 'planned');
    assert.match(modalContent.innerHTML, /<button type="button" class="compact-detail-card planned"/);
});
