const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const boot = fs.readFileSync(path.join(__dirname, '..', 'app-boot.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function createRuntime() {
    const injected = [];
    const invoked = [];
    const delayed = [];
    const documentListeners = new Map();
    let failNotebook = false;
    let failReveal = false;
    let onReady;
    class MaintenanceApp {
        constructor() { this.menuParts = this.loadShiftNotebookRowMenuHiddenParts(); }
        showToast(message) { invoked.push(['toast', message]); }
        renderKanbanLocalTodos() { invoked.push(['todos']); }
        renderHistory() { invoked.push(['history']); }
        renderMachines() { invoked.push(['machines']); }
        renderGuides() { invoked.push(['guides']); }
        renderTips() { invoked.push(['tips']); }
        openHistoryEditForm(id) { invoked.push(['history-edit', id]); }
        openTipsAudioDatabase() { invoked.push(['tips-audio']); }
        openBackupExportModal() { invoked.push(['backup']); }
        runScheduledDataDiagnostics() { invoked.push(['diagnostics']); }
    }
    const document = {
        head: {
            appendChild(script) {
                injected.push(script.src);
                if (script.src.startsWith('app-shift-notebook-core.js')) {
                    if (failNotebook) {
                        failNotebook = false;
                        script.onerror();
                    } else {
                        MaintenanceApp.prototype.openShiftNotebookModal = function (date) { invoked.push(['notebook', date]); };
                        MaintenanceApp.prototype.openShiftNotebookSearchResults = function (query) { invoked.push(['search', query]); };
                        MaintenanceApp.prototype.openShiftMemberTypeManageModal = function () { invoked.push(['member-types']); };
                        MaintenanceApp.prototype.renderFiveSManagement = function () { invoked.push(['fiveS']); };
                        MaintenanceApp.prototype.openShiftPhotoCompare = function () { invoked.push(['compare']); };
                        script.onload();
                    }
                } else if (script.src.startsWith('app-photo-manager.js')) {
                    MaintenanceApp.prototype.renderPhotoManager = function () { invoked.push(['photos']); };
                    MaintenanceApp.prototype.openPhotoManagerEditor = function (id) { invoked.push(['photo-editor', id]); };
                    MaintenanceApp.prototype.downloadPhotoManagerItem = function (id) { invoked.push(['photo-download', id]); };
                    MaintenanceApp.prototype.openImageSourceChoiceTransparencyPreview = function (id) { invoked.push(['alpha-preview', id]); };
                    MaintenanceApp.prototype.openPhotoManagerVideos = function () { invoked.push(['videos']); };
                    MaintenanceApp.prototype.openRegisteredVideoAttachmentPicker = function () { invoked.push(['video-picker']); };
                    MaintenanceApp.prototype.ensureImageSourceChoiceListener = function () {
                        if (this._imageSourceChoiceListener) return;
                        this._imageSourceChoiceListener = () => {};
                        invoked.push(['image-listener']);
                    };
                    MaintenanceApp.prototype.openImageSourceChoice = function (input) { invoked.push(['image-choice', input.id]); };
                    script.onload();
                } else if (script.src.startsWith('app-shift-photo-camera.js')
                    || script.src.startsWith('app-shift-photo-reveal.js')
                    || script.src.startsWith('app-shift-avatar-conversation.js')) {
                    if (failReveal && script.src.startsWith('app-shift-photo-reveal.js')) {
                        failReveal = false;
                        script.onerror();
                    } else script.onload();
                } else throw new Error(`Unexpected script: ${script.src}`);
            }
        },
        createElement() { return { src: '', async: false, remove() {} }; },
        getElementById() { return null; },
        addEventListener(name, callback) { documentListeners.set(name, callback); },
        removeEventListener(name, callback) { if (documentListeners.get(name) === callback) documentListeners.delete(name); }
    };
    const window = {
        location: { href: 'https://example.test/mente/' },
        history: { state: null, replaceState() {} },
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') onReady = callback; },
        setTimeout(callback, delay) { delayed.push({ callback, delay }); }
    };
    const store = { async init() {} };
    const context = vm.createContext({ MaintenanceApp, document, window, store, localStorage: { getItem() { return null; } }, URL, console: { error() {}, warn() {} }, alert() {} });
    vm.runInContext(boot, context, { filename: 'app-boot.js' });
    return { window, injected, invoked, delayed, documentListeners, onReady: () => onReady(),
        failOnce() { failNotebook = true; }, failRevealOnce() { failReveal = true; } };
}

test('heavy scripts are absent from initial HTML and load in dependency order when used', async () => {
    assert.doesNotMatch(html, /<script src="app-shift-notebook-core\.js/);
    assert.doesNotMatch(html, /<script src="app-photo-manager\.js/);
    assert.doesNotMatch(html, /<script src="app-shift-photo-(camera|reveal)\.js/);
    assert.doesNotMatch(html, /<script src="app-shift-avatar-conversation\.js/);
    const runtime = createRuntime();
    await runtime.onReady();
    assert.deepEqual(runtime.injected, []);
    assert.equal(runtime.delayed.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.window.app.menuParts)), { group: false, format: false, actions: false });

    await runtime.window.app.openPhotoManagerVideos();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-shift-notebook-core.js', 'app-photo-manager.js']);
    assert.deepEqual(runtime.invoked, [['image-listener'], ['videos']]);
    assert.equal(runtime.documentListeners.has('click'), false);
    assert.equal(runtime.delayed.length, 1);
    runtime.delayed[0].callback();
    assert.deepEqual(runtime.invoked.at(-1), ['diagnostics']);
    runtime.window.app.renderKanbanLocalTodos();
    assert.deepEqual(runtime.invoked.at(-1), ['todos']);
});

test('failed feature load can retry on the next action', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    runtime.failOnce();
    await runtime.window.app.openShiftMemberTypeManageModal();
    assert.equal(runtime.injected.length, 1);
    assert.equal(runtime.invoked[0][0], 'toast');

    await runtime.window.app.openShiftMemberTypeManageModal();
    assert.equal(runtime.injected.length, 2);
    assert.deepEqual(runtime.invoked.at(-1), ['member-types']);
});

test('photo comparison loads the media module after the notebook module', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    await runtime.window.app.openShiftMemberTypeManageModal();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-shift-notebook-core.js']);
    await runtime.window.app.openShiftPhotoCompare();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), [
        'app-shift-notebook-core.js', 'app-photo-manager.js', 'app-shift-photo-camera.js',
        'app-shift-photo-reveal.js', 'app-shift-avatar-conversation.js'
    ]);
    assert.deepEqual(runtime.invoked.at(-1), ['compare']);
});

test('photo comparison loads its effects even when photos were opened earlier', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    await runtime.window.app.renderPhotoManager();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-photo-manager.js']);
    await runtime.window.app.openPhotoManagerEditor('photo-1');
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-photo-manager.js', 'app-shift-notebook-core.js']);
    assert.deepEqual(runtime.invoked.at(-1), ['photo-editor', 'photo-1']);
    await runtime.window.app.openShiftPhotoCompare();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]).slice(-3), [
        'app-shift-photo-camera.js', 'app-shift-photo-reveal.js', 'app-shift-avatar-conversation.js'
    ]);
    assert.deepEqual(runtime.invoked.at(-1), ['compare']);
});

test('annotated image download and transparency preview load notebook helpers on demand', async () => {
    for (const [method, eventName] of [
        ['downloadPhotoManagerItem', 'photo-download'],
        ['openImageSourceChoiceTransparencyPreview', 'alpha-preview']
    ]) {
        const runtime = createRuntime();
        await runtime.onReady();
        await runtime.window.app.renderPhotoManager();
        assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-photo-manager.js']);
        await runtime.window.app[method]('photo-1');
        assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-photo-manager.js', 'app-shift-notebook-core.js']);
        assert.deepEqual(runtime.invoked.at(-1), [eventName, 'photo-1']);
    }
});

test('opening a notebook with linked photos waits for the media module', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    await runtime.window.app.openShiftNotebookModal('2026-11-14');
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-shift-notebook-core.js', 'app-photo-manager.js']);
    assert.deepEqual(runtime.invoked.at(-1), ['notebook', '2026-11-14']);
});

test('programmatic image choice loads photos and registers the capture listener', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    await runtime.window.app.openImageSourceChoice({ id: 'tip-photo' });
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), ['app-shift-notebook-core.js', 'app-photo-manager.js']);
    assert.deepEqual(runtime.invoked, [['image-listener'], ['image-choice', 'tip-photo']]);
});

test('first file input click opens image choice after loading photos', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    const input = { id: 'calendar-photo', dataset: {}, matches: selector => selector === 'input[type="file"][accept*="image"]' };
    let prevented = false;
    const event = { target: input, preventDefault() { prevented = true; }, stopPropagation() {} };
    const listener = runtime.documentListeners.get('click');
    await listener(event);
    assert.equal(prevented, true);
    assert.deepEqual(runtime.invoked.slice(-2), [['image-listener'], ['image-choice', 'calendar-photo']]);
});

test('history and tips entrances wait for photo references and audio data', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    await runtime.window.app.renderHistory();
    assert.deepEqual(runtime.invoked.slice(-2), [['image-listener'], ['history']]);
    await runtime.window.app.openHistoryEditForm('history-1');
    await runtime.window.app.openTipsAudioDatabase();
    await runtime.window.app.openRegisteredVideoAttachmentPicker();
    assert.deepEqual(runtime.invoked.slice(-3), [['history-edit', 'history-1'], ['tips-audio'], ['video-picker']]);
    assert.equal(runtime.injected.length, 2);
});

test('photo effect failure does not block basic views and can be retried', async () => {
    const runtime = createRuntime();
    await runtime.onReady();
    await runtime.window.app.openShiftMemberTypeManageModal();
    runtime.failRevealOnce();
    await runtime.window.app.openShiftPhotoCompare();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]), [
        'app-shift-notebook-core.js', 'app-photo-manager.js', 'app-shift-photo-camera.js', 'app-shift-photo-reveal.js'
    ]);
    assert.equal(runtime.invoked.at(-1)[0], 'toast');
    await runtime.window.app.renderHistory();
    assert.deepEqual(runtime.invoked.at(-1), ['history']);
    await runtime.window.app.openShiftPhotoCompare();
    assert.deepEqual(runtime.injected.map(src => src.split('?')[0]).slice(-2),
        ['app-shift-photo-reveal.js', 'app-shift-avatar-conversation.js']);
    assert.deepEqual(runtime.invoked.at(-1), ['compare']);
});
