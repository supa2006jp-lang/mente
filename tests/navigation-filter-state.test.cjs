'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function harness(elements = {}) {
    const searchBar = { classList: { toggle() {} } };
    const document = {
        getElementById(id) { return elements[id] || null; },
        querySelector(selector) { return selector === '.search-bar' ? searchBar : null; },
        querySelectorAll() { return []; }
    };
    const context = vm.createContext({ document, store: {}, console, localStorage: { getItem: () => null } });
    vm.runInContext(`${source}\nglobalThis.TestApp = MaintenanceApp;`, context, { filename: 'app.js' });
    const app = Object.create(context.TestApp.prototype);
    app.currentView = 'history';
    app._viewSearchQueries = Object.create(null);
    app.renderView = () => {};
    app.updateViewGuideSlot = () => {};
    app.updateContextualHelp = () => {};
    return { app, context, document };
}

test('each view restores its own search and unsupported views explain their search scope', () => {
    const search = { value: 'pump', disabled: false, setAttribute() {} };
    const clear = { hidden: false };
    const filterClear = { hidden: false };
    const { app } = harness({ 'global-search': search, 'search-clear': clear, 'view-filter-clear': filterClear });

    app.switchView('guides');
    assert.equal(app._viewSearchQueries.history, 'pump');
    assert.equal(search.value, '');
    search.value = 'manual';
    app.switchView('history');
    assert.equal(search.value, 'pump');
    app.switchView('fiveS');
    assert.equal(search.disabled, true);
    assert.match(search.placeholder, /画面内の検索欄/);
    assert.equal(clear.hidden, true);
    app.switchView('guides');
    assert.equal(search.value, 'manual');
});

test('navigation does not clear filters merely because the view changes', () => {
    const nav = { dataset: { view: 'history' }, addEventListener(type, handler) { this[type] = handler; } };
    const home = { addEventListener(type, handler) { this[type] = handler; } };
    const { app, document } = harness({ 'sidebar-home': home });
    document.querySelectorAll = selector => selector === '.nav-btn' ? [nav] : [];
    const visited = [];
    app.switchView = view => visited.push(view);
    app.resetSearchAndFilters = () => { throw new Error('navigation reset filters'); };

    app.setupNavigation();
    nav.click({ currentTarget: nav });
    home.click();
    assert.deepEqual(visited, ['history', 'calendar']);
});

test('the explicit clear action resets only the current view', () => {
    const controls = {
        'global-search': { value: 'pump' },
        'hist-filter-period': { value: 'last_year' },
        'hist-filter-machine': { value: 'machine-1' },
        'hist-filter-line': { value: '2' },
        'hist-filter-type': { value: 'periodic' },
        'hist-filter-parts': { checked: true },
        'hist-filter-photos': { checked: true },
        'hist-filter-guide': { checked: true },
        'fiveS-filter-period': { value: 'this_month' }
    };
    const { app } = harness(controls);
    app._viewSearchQueries.history = 'pump';
    app._viewSearchQueries.guides = 'manual';
    app.modelFilter = 'model-1';
    app.historyMissingDetailFilter = 'cause';
    app.historyRecurrenceFrequencyFilter = { ids: ['h1'] };
    let rendered;
    app.renderView = view => { rendered = view; };
    app.showToast = () => {};

    app.clearCurrentViewSearchAndFilters();
    assert.equal(rendered, 'history');
    assert.equal(app._viewSearchQueries.history, '');
    assert.equal(app._viewSearchQueries.guides, 'manual');
    assert.equal(controls['hist-filter-period'].value, 'last_this_month');
    assert.equal(controls['hist-filter-machine'].value, '');
    assert.equal(controls['fiveS-filter-period'].value, 'this_month');
    assert.equal(app.modelFilter, null);
    assert.equal(app.historyMissingDetailFilter, null);
    assert.equal(app.historyRecurrenceFrequencyFilter, null);
    assert.equal(controls['hist-filter-parts'].checked, false);
    assert.equal(controls['hist-filter-photos'].checked, false);
    assert.equal(controls['hist-filter-guide'].checked, false);
});

test('the explicit clear action covers local TIPS and machine filters', () => {
    const controls = {
        'global-search': { value: '' },
        'tips-search-input': { value: 'needle' },
        'tips-filter-group': { value: 'A' },
        'tips-filter-branch': { value: 'B' },
        'tips-filter-attachment': { value: 'image' },
        'tips-sort-select': { value: 'sizeDesc' }
    };
    const { app } = harness(controls);
    app.currentView = 'tips';
    app.showToast = () => {};
    app.clearCurrentViewSearchAndFilters();
    assert.equal(controls['tips-search-input'].value, '');
    assert.equal(controls['tips-filter-group'].value, '');
    assert.equal(controls['tips-filter-branch'].value, '');
    assert.equal(controls['tips-filter-attachment'].value, 'all');
    assert.equal(controls['tips-sort-select'].value, 'createdDesc');

    app.currentView = 'machines';
    app.machineMaintenanceListFilters = { status: 'overdue', kind: 'periodic', line: '2' };
    app.clearCurrentViewSearchAndFilters();
    assert.deepEqual(JSON.parse(JSON.stringify(app.machineMaintenanceListFilters)), { status: 'all', kind: 'all', line: 'all' });
});

test('views with their own search field disable the header search', () => {
    const search = { value: '', disabled: false, setAttribute() {} };
    const { app } = harness({ 'global-search': search });
    for (const view of ['tips', 'workers', 'worktime']) {
        app.updateGlobalSearchForView(view);
        assert.equal(search.disabled, true);
        assert.match(search.placeholder, /画面内の検索欄/);
    }
});

test('header search and month controls have keyboard focus and readable labels', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const id of ['search-clear', 'view-filter-clear', 'sidebar-toggle', 'cal-prev', 'cal-next']) {
        assert.match(html, new RegExp(`<button[^>]*id="${id}"[^>]*aria-label="[^"]+"`));
    }
});

test('image cleanup previews before deleting and reports reclaimed capacity', async () => {
    const { app, context } = harness();
    const calls = [];
    context.store.cleanupUnusedImageBlobs = async ({ dryRun }) => {
        calls.push(dryRun);
        return { dryRun, eligibleImages: 2, eligibleBytes: 2048, reclaimedImages: dryRun ? 0 : 2,
            reclaimedBytes: dryRun ? 0 : 2048, gracePeriodDays: 30 };
    };
    context.confirm = () => true;
    app.renderSaveStatusDiagnostics = () => {};
    const notices = [];
    app.showToast = message => notices.push(message);
    await app.cleanupUnusedSavedImages();
    assert.deepEqual(calls, [true, false]);
    assert.equal(app._lastImageCleanupResult.reclaimedImages, 2);
    assert.match(notices.at(-1), /2件/);
});
