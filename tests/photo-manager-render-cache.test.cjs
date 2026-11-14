'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

test('photo manager reuses unchanged all-item aggregates while filters and saves invalidate the right layer', () => {
    class MaintenanceApp {}
    const list = { innerHTML: '' };
    const summary = { innerHTML: '' };
    const query = { value: '' };
    const document = {
        getElementById(id) {
            return { 'photo-manager-list': list, 'photo-manager-summary': summary, 'photo-manager-query': query }[id] || null;
        }
    };
    const store = { data: {}, activeData: { photoManagerTrash: [] }, _saveRequestedRevision: 1 };
    const context = vm.createContext({ MaintenanceApp, store, document, console });
    vm.runInContext(source, context, { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    const calls = { collect: 0, duplicate: 0, usage: 0, filter: 0 };
    for (const method of ['applyMediaManagementCardColor', 'ensurePhotoManagerPasteImportListener',
        'ensureImageSourceChoiceListener', 'updatePhotoManagerAlphaFilterButton',
        'updatePhotoManagerToolbarActiveState', 'updatePhotoManagerTagFilterOptions',
        'renderPhotoManagerPagination', 'prunePhotoManagerSelection',
        'updatePhotoManagerBulkBar', 'addPhotoManagerPageOnlyCleanupButton']) app[method] = () => {};
    app.ensurePhotoManagerSelectionStore = () => new Set();
    app.getLocalDateString = () => '2026-11-15';
    app.formatPhotoManagerBytes = bytes => `${bytes}B`;
    app.collectPhotoManagerItems = () => { calls.collect++; return []; };
    app.getPhotoManagerDuplicateGroups = () => { calls.duplicate++; return []; };
    app.getPhotoManagerUsageIndex = () => { calls.usage++; return new Map(); };
    app.getFilteredPhotoManagerItems = () => { calls.filter++; return []; };

    app.renderPhotoManager();
    app.renderPhotoManager();
    assert.deepEqual(calls, { collect: 1, duplicate: 1, usage: 1, filter: 1 });
    query.value = 'pump';
    app.renderPhotoManager();
    assert.deepEqual(calls, { collect: 1, duplicate: 1, usage: 1, filter: 2 });
    store._saveRequestedRevision++;
    app.renderPhotoManager();
    assert.deepEqual(calls, { collect: 2, duplicate: 2, usage: 2, filter: 3 });
});

test('image byte estimate uses the data payload length', () => {
    class MaintenanceApp {}
    vm.runInContext(source, vm.createContext({ MaintenanceApp }), { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    assert.equal(app.estimatePhotoManagerImageBytes('data:image/png;base64,AAAA'), 3);
    assert.equal(app.estimatePhotoManagerImageBytes('https://example.test/image.png'), 0);
});

test('transparency badge reuses an image already decoded on a previous render', async () => {
    class MaintenanceApp {}
    const classes = new Set();
    const badge = {
        classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
        innerHTML: ''
    };
    const card = { querySelector() { return badge; } };
    const document = { querySelector() { return card; } };
    const window = { CSS: { escape(value) { return value; } } };
    vm.runInContext(source, vm.createContext({ MaintenanceApp, document, window, CSS: window.CSS, console }), { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    let decoded = 0;
    app.canImageSourceHaveAlpha = () => true;
    app.imageHasTransparentPixels = async () => { decoded++; return true; };
    const item = { id: 'photo-1', src: 'data:image/png;base64,AA' };
    app.updatePhotoManagerTransparencyBadges([item]);
    await new Promise(resolve => setImmediate(resolve));
    app.updatePhotoManagerTransparencyBadges([item]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(decoded, 1);
    assert.equal(classes.has('transparent'), true);
});
