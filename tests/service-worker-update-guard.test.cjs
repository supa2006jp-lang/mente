'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-boot.js'), 'utf8');
const start = source.indexOf('    function setupServiceWorkerUpdates(registration) {');
const end = source.indexOf("    window.addEventListener('DOMContentLoaded'", start);
assert.ok(start >= 0 && end > start);
const setupSource = `${source.slice(start, end)}\nsetupServiceWorkerUpdates(registration);`;

function createHarness() {
    const listeners = new Map();
    const registrationListeners = new Map();
    const posted = [];
    let reloads = 0;
    let confirmations = 0;
    let draft = false;
    let bodyEditorDirty = false;
    let modal = null;
    let modalDirty = false;
    let banner = null;

    function element(tagName) {
        const handlers = new Map();
        return {
            tagName,
            style: {},
            children: [],
            disabled: false,
            textContent: '',
            setAttribute() {},
            addEventListener(type, handler) { handlers.set(type, handler); },
            append(...nodes) { this.children.push(...nodes); },
            remove() {},
            click() { return handlers.get('click')?.(); }
        };
    }

    const app = {
        hasUnsavedTipsDraft: () => draft,
        isTipsBodyEditorDirty: () => bodyEditorDirty,
        hasModalUnsavedChanges: () => modalDirty,
        _saveStatusState: 'saved'
    };
    const document = {
        createElement: element,
        getElementById(id) { return id === 'modal-overlay' ? modal : null; },
        body: { appendChild(node) { banner = node; } }
    };
    const navigator = {
        serviceWorker: {
            controller: {},
            addEventListener(type, handler) { listeners.set(type, handler); }
        }
    };
    const window = { app, location: { reload() { reloads++; } } };
    const store = {
        _saveRequestedRevision: 1,
        _savePersistedRevision: 1,
        async waitForSaveQueueIdle() {}
    };
    const registration = {
        waiting: { postMessage(value) { posted.push(value); } },
        installing: null,
        addEventListener(type, handler) { registrationListeners.set(type, handler); }
    };
    vm.runInNewContext(setupSource, {
        registration, navigator, window, document, store,
        console: { warn() {} },
        confirm() { confirmations++; return true; }
    }, { filename: 'app-boot.js' });

    return {
        app, store, posted,
        setDraft(value) { draft = value; },
        setBodyEditorDirty(value) { bodyEditorDirty = value; },
        setModal(open, dirty = false) {
            modal = open ? { classList: { contains: () => false } } : null;
            modalDirty = dirty;
        },
        clickUpdate() { return banner.children[1].click(); },
        controllerChange() { listeners.get('controllerchange')(); },
        get message() { return banner.children[0].textContent; },
        get updateDisabled() { return banner.children[1].disabled; },
        get reloads() { return reloads; },
        get confirmations() { return confirmations; }
    };
}

test('update refuses to discard a TIPS draft or unsaved body editor', async () => {
    const harness = createHarness();
    harness.setDraft(true);
    await harness.clickUpdate();
    assert.match(harness.message, /未保存のTIPS/);
    assert.equal(harness.confirmations, 0);
    assert.equal(harness.posted.length, 0);
    harness.setDraft(false);
    harness.setBodyEditorDirty(true);
    await harness.clickUpdate();
    assert.match(harness.message, /TIPS本文/);
    assert.equal(harness.posted.length, 0);
});

test('update stops while an edit modal is open', async () => {
    const harness = createHarness();
    harness.setModal(true, true);
    await harness.clickUpdate();
    assert.match(harness.message, /未保存の内容/);
    assert.equal(harness.posted.length, 0);
    harness.setModal(true, false);
    await harness.clickUpdate();
    assert.match(harness.message, /画面を閉じて/);
    assert.equal(harness.posted.length, 0);
});

test('update stops if the unsaved input check fails', async () => {
    const harness = createHarness();
    harness.app.hasUnsavedTipsDraft = () => { throw new Error('editor unavailable'); };
    await harness.clickUpdate();
    assert.match(harness.message, /確認できませんでした/);
    assert.equal(harness.posted.length, 0);
    assert.equal(harness.reloads, 0);
});

test('update rechecks edits after the save queue becomes idle', async () => {
    const harness = createHarness();
    let finishQueue;
    harness.store.waitForSaveQueueIdle = () => new Promise(resolve => { finishQueue = resolve; });
    const updating = harness.clickUpdate();
    assert.match(harness.message, /保存待ちの処理と未保存の入力/);
    harness.setDraft(true);
    finishQueue();
    await updating;
    assert.match(harness.message, /未保存のTIPS/);
    assert.equal(harness.posted.length, 0);
    assert.equal(harness.updateDisabled, false);
});

test('activation only reloads if edits are still clear', async () => {
    const harness = createHarness();
    await harness.clickUpdate();
    assert.equal(harness.posted.length, 1);
    harness.setDraft(true);
    harness.controllerChange();
    assert.equal(harness.reloads, 0);
    assert.match(harness.message, /未保存のTIPS/);
    assert.equal(harness.updateDisabled, false);

    harness.setDraft(false);
    await harness.clickUpdate();
    harness.controllerChange();
    assert.equal(harness.reloads, 1);
});
