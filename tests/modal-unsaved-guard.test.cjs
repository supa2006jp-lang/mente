'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-maintenance-forms.js'), 'utf8');

function makeHarness() {
    class MaintenanceApp {}
    const visible = new Set(['hidden']);
    const overlay = { classList: {
        contains(name) { return visible.has(name); },
        add(name) { visible.add(name); },
        remove(name) { visible.delete(name); }
    } };
    const fields = [];
    const content = { querySelectorAll() { return fields; } };
    const title = { textContent: '' };
    const handlers = [];
    const document = { activeElement: null };
    const focusable = name => ({ name, isConnected: true, focus() { document.activeElement = this; },
        getClientRects() { return [{}]; }, closest() { return null; } });
    const trigger = focusable('trigger');
    const close = focusable('close');
    const save = focusable('save');
    const container = {
        dataset: {}, className: '', innerHTML: '',
        setAttribute() {},
        querySelector(selector) { return selector === '#modal-title' ? title : (selector === '#modal-content' ? content : null); },
        querySelectorAll() { return [close, save]; },
        addEventListener(type, handler) { if (type === 'keydown') handlers.push(handler); },
        contains(element) { return [this, close, save].includes(element); },
        focus() { document.activeElement = this; }
    };
    document.getElementById = id => ({
        'modal-overlay': overlay, 'modal-container': container, 'modal-save-btn': save,
        'app-settings-btn': trigger
    })[id] || null;
    document.activeElement = trigger;
    let confirmCount = 0;
    let confirmResult = false;
    const context = vm.createContext({ MaintenanceApp, document, console,
        confirm() { confirmCount++; return confirmResult; } });
    vm.runInContext(source, context, { filename: 'app-maintenance-forms.js' });
    const app = new MaintenanceApp();
    app.setupHistoryPhotoInput = () => {};
    app.clearGuidePhotoTokenHighlights = () => {};
    return {
        app, document, overlay, container, fields, handlers, trigger,
        setConfirmResult(value) { confirmResult = value; },
        getConfirmCount() { return confirmCount; }
    };
}

function input(id, value = '', type = 'text') {
    return { tagName: 'INPUT', id, name: '', type, value, checked: false, files: [] };
}

test('editable modal asks only when a persisted field changed and preserves focus on refusal', async () => {
    const h = makeHarness();
    const name = input('machine-name', '機械 A');
    const search = input('template-search', '', 'search');
    h.fields.push(name, search);
    h.app.openModal('machine', '機械の編集');
    await Promise.resolve();
    search.value = '探す';
    assert.equal(h.app.requestCloseModal(), true);
    assert.equal(h.getConfirmCount(), 0);

    h.app.openModal('machine', '機械の編集');
    await Promise.resolve();
    name.value = '機械 B';
    assert.equal(h.app.requestCloseModal(), false);
    assert.equal(h.overlay.classList.contains('hidden'), false);
    assert.equal(h.document.activeElement, h.container);
    assert.equal(h.getConfirmCount(), 1);
    h.setConfirmResult(true);
    assert.equal(h.app.requestCloseModal(), true);
    assert.equal(h.overlay.classList.contains('hidden'), true);
    assert.equal(h.document.activeElement, h.trigger);
});

test('Escape uses discard confirmation while save or programmatic close bypasses it', async () => {
    const h = makeHarness();
    const notes = input('s-notes', '元の内容');
    h.fields.push(notes);
    h.app._tempPhotos = [];
    h.app.openModal('sudden', '記録');
    await Promise.resolve();
    notes.value = '変更内容';
    const escape = { key: 'Escape', defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
    h.handlers[0](escape);
    assert.equal(escape.defaultPrevented, true);
    assert.equal(h.overlay.classList.contains('hidden'), false);
    assert.equal(h.getConfirmCount(), 1);
    h.app.closeModal();
    assert.equal(h.overlay.classList.contains('hidden'), true);
    assert.equal(h.getConfirmCount(), 1);
});

test('new photo and contenteditable edits count as unsaved; auto-save guide does not', async () => {
    const h = makeHarness();
    const editor = { tagName: 'DIV', id: 'rich-editor', name: '', type: '', isContentEditable: true, innerHTML: '元の内容' };
    h.fields.push(editor);
    h.app._tempPhotos = [];
    h.app.openModal('sudden', '記録');
    await Promise.resolve();
    h.app._tempPhotos.push({ src: 'data:image/png;base64,AA', name: '写真' });
    assert.equal(h.app.hasModalUnsavedChanges(), true);
    h.app.closeModal();

    h.app._tempPhotos = [];
    h.app.openModal('sudden', '記録');
    await Promise.resolve();
    editor.innerHTML = '変更内容';
    assert.equal(h.app.hasModalUnsavedChanges(), true);
    h.app.closeModal();

    h.app._tempPhotos = ['data:image/png;base64,AA'];
    h.app.openModal('edit-history', '既存の記録');
    await Promise.resolve();
    assert.equal(h.app.hasModalUnsavedChanges(), false);
    h.app._tempPhotos[0] = 'data:image/png;base64,BB';
    assert.equal(h.app.hasModalUnsavedChanges(), true);
    h.app.closeModal();

    h.app.openModal('guide', '自動保存の手順書');
    await Promise.resolve();
    editor.innerHTML = 'さらに変更';
    assert.equal(h.app.requestCloseModal(), true);
    assert.equal(h.getConfirmCount(), 0);
});

test('bulk history edit warns before discarding changed fields', async () => {
    const h = makeHarness();
    const worker = input('bulk-worker', '田中');
    h.fields.push(worker);
    h.app.openModal('history-bulk-edit', '履歴の一括編集');
    await Promise.resolve();
    worker.value = '佐藤';
    assert.equal(h.app.requestCloseModal(), false);
    assert.equal(h.getConfirmCount(), 1);
    assert.equal(h.overlay.classList.contains('hidden'), false);
});

test('saving an editable modal blocks UI close until the save finishes', async () => {
    const h = makeHarness();
    h.fields.push(input('machine-name', '機械 A'));
    h.app.openModal('machine', '機械の編集');
    await Promise.resolve();
    h.app._modalSaveInProgress = true;
    assert.equal(h.app.requestCloseModal(), false);
    assert.equal(h.overlay.classList.contains('hidden'), false);
    assert.equal(h.getConfirmCount(), 0);
    h.app._modalSaveInProgress = false;
    assert.equal(h.app.requestCloseModal(), true);
});
