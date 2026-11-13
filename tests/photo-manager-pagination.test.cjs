const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

function makeApp(total = 125) {
    class MaintenanceApp {}
    const items = Array.from({ length: total }, (_, index) => ({
        id: `image-${index}`, src: 'data:image/png;base64,AA==', date: '2026-11-14', source: 'library',
        title: `画像 ${index}`, sourceLabel: '取込画像', displayName: `画像 ${index}`
    }));
    const list = { innerHTML: '', scrollIntoView() {} };
    const summary = { innerHTML: '' };
    const pagination = { hidden: true, style: {}, children: [], replaceChildren(...children) { this.children = children; } };
    const filterInputs = new Map();
    const timers = new Map();
    let nextTimerId = 0;
    const document = {
        getElementById(id) {
            return { 'photo-manager-list': list, 'photo-manager-summary': summary,
                'photo-manager-pagination': pagination }[id] || filterInputs.get(id) || null;
        },
        createElement() { return { textContent: '', className: '', style: {}, disabled: false, addEventListener() {}, setAttribute() {} }; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    const store = { activeData: { photoManagerTrash: [] } };
    const context = vm.createContext({ MaintenanceApp, document, store, window: {}, console,
        setTimeout(callback, delay) { const id = ++nextTimerId; timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { timers.delete(id); }
    });
    vm.runInContext(source, context, { filename: 'app-photo-manager.js' });
    const app = new MaintenanceApp();
    const selected = new Set();
    app.applyMediaManagementCardColor = () => {};
    for (const name of ['ensurePhotoManagerPasteImportListener', 'ensureImageSourceChoiceListener',
        'updatePhotoManagerAlphaFilterButton', 'updatePhotoManagerToolbarActiveState',
        'updatePhotoManagerTagFilterOptions', 'prunePhotoManagerSelection',
        'refreshPhotoManagerVideoBlankEditThumbnails', 'updatePhotoManagerTransparencyBadges',
        'updatePhotoManagerBulkBar', 'addPhotoManagerPageOnlyCleanupButton', 'enhancePhotoManagerCards']) {
        app[name] = () => {};
    }
    app.collectPhotoManagerItems = () => items;
    app.getFilteredPhotoManagerItems = all => all;
    app.getPhotoManagerDuplicateGroups = () => [];
    app.getPhotoManagerUsageIndex = () => new Map();
    app.ensurePhotoManagerSelectionStore = () => selected;
    app.getPhotoManagerName = item => item.displayName;
    app.getPhotoManagerSourceLabel = item => item.sourceLabel;
    app.isPhotoManagerSvgSource = () => false;
    app.getPhotoManagerAlphaStatus = () => '';
    app.getPhotoManagerUsageSummary = () => ({ count: 0, label: '未使用' });
    app.isPhotoManagerSourceCompressed = () => false;
    app.isPhotoManagerSourceProtected = () => false;
    app.estimatePhotoManagerImageBytes = () => 1;
    app.formatPhotoManagerBytes = value => `${value} B`;
    app.escapeHtml = value => String(value);
    app.escapeJs = value => String(value);
    return { app, items, list, pagination, selected, filterInputs, timers };
}

test('photo manager renders only one page while bulk selection spans all filtered results', () => {
    const { app, list, pagination, selected } = makeApp();
    app.renderPhotoManager();
    assert.equal((list.innerHTML.match(/<article class="photo-manager-card/g) || []).length, 48);
    assert.equal(pagination.children[1].textContent, '1 / 3 ページ（全125枚）');
    assert.equal(app._photoManagerVisibleIds.length, 125);
    app.selectVisiblePhotoManagerItems();
    assert.equal(selected.size, 125);
    app.setPhotoManagerPage(2);
    assert.equal((list.innerHTML.match(/<article class="photo-manager-card/g) || []).length, 29);
    assert.equal(pagination.children[1].textContent, '3 / 3 ページ（全125枚）');
    app.clearVisiblePhotoManagerSelection();
    assert.equal(selected.size, 0);
});

test('changing photo filters returns to the first page', () => {
    const { app, pagination, filterInputs } = makeApp(100);
    app.renderPhotoManager();
    app.setPhotoManagerPage(1);
    assert.equal(pagination.children[1].textContent, '2 / 3 ページ（全100枚）');
    filterInputs.set('photo-manager-query', { value: '部品' });
    app.renderPhotoManager();
    assert.equal(pagination.children[1].textContent, '1 / 3 ページ（全100枚）');
});

test('rapid photo search input schedules one render after the last keystroke', () => {
    const { app, timers } = makeApp(80);
    let renders = 0;
    app.renderPhotoManager = () => { renders++; };
    app.schedulePhotoManagerSearchRender();
    app.schedulePhotoManagerSearchRender();
    app.schedulePhotoManagerSearchRender();
    assert.equal(timers.size, 1);
    const [{ callback, delay }] = timers.values();
    assert.equal(delay, 180);
    callback();
    assert.equal(renders, 1);
});
