'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function makeApp() {
    const elements = new Map();
    const values = ['tips-group-input', 'tips-branch-input', 'tips-sub-branch-input', 'tips-body-input'];
    values.forEach(id => elements.set(id, { value: '', focus() {} }));
    elements.set('tips-file-input', { value: '', files: [] });
    elements.set('view-title', { textContent: '', innerHTML: '' });
    const panel = { classList: { remove() {} } };
    const document = {
        getElementById(id) { return elements.get(id) || null; },
        querySelector(selector) { return selector === '.tips-compose-panel' ? panel : null; },
        querySelectorAll(selector) {
            return selector.startsWith('#tips-compose-panel')
                ? [...values.map(id => elements.get(id)), elements.get('tips-file-input')]
                : [];
        },
        addEventListener() {}
    };
    const notes = [];
    const store = { activeData: { tipsNotes: notes }, runAtomicSaveBatch: async mutate => mutate() };
    let allowDiscard = false;
    const messages = [];
    const context = vm.createContext({
        document, store, window: {}, localStorage: { getItem() { return null; } },
        confirm: () => allowDiscard, console: { error() {} }
    });
    vm.runInContext(read('app.js'), context, { filename: 'app.js' });
    vm.runInContext(read('app-tips.js'), context, { filename: 'app-tips.js' });
    const app = vm.runInContext('Object.create(MaintenanceApp.prototype)', context);
    app.currentView = 'calendar';
    app.updateViewGuideSlot = () => {};
    app.renderView = () => {};
    app.updateContextualHelp = () => {};
    app.renderTips = () => {};
    app.renderTipsExistingFiles = () => {};
    app.renderTipsSelectedFiles = () => {};
    app.updateTipsEditStateUI = () => {};
    app.showToast = (message, status) => messages.push({ message, status });
    return { app, store, elements, messages, setAllowDiscard(value) { allowDiscard = value; } };
}

test('TIPS text survives navigation and explicit clear asks before discarding', () => {
    const h = makeApp();
    h.elements.get('tips-body-input').value = '途中まで書いた内容';
    h.app.switchView('tips');
    h.app.switchView('history');
    h.app.switchView('tips');
    assert.equal(h.elements.get('tips-body-input').value, '途中まで書いた内容');
    assert.equal(h.app.requestClearTipsForm(), false);
    assert.equal(h.elements.get('tips-body-input').value, '途中まで書いた内容');
    h.setAllowDiscard(true);
    assert.equal(h.app.requestClearTipsForm(), true);
    assert.equal(h.elements.get('tips-body-input').value, '');
});

test('failed TIPS save retains the draft and a successful save clears it afterward', async () => {
    const h = makeApp();
    const body = h.elements.get('tips-body-input');
    body.value = '保存する内容';
    h.store.runAtomicSaveBatch = async mutate => { mutate(); throw new Error('quota'); };
    await h.app.saveTipsNote();
    assert.equal(body.value, '保存する内容');
    assert.equal(h.messages.at(-1).status, 'error');

    let release;
    h.store.runAtomicSaveBatch = mutate => {
        mutate();
        return new Promise(resolve => { release = resolve; });
    };
    const saving = h.app.saveTipsNote();
    await Promise.resolve();
    assert.equal(body.value, '保存する内容');
    assert.equal(body.disabled, true);
    assert.equal(h.app.requestClearTipsForm(), false);
    release();
    await saving;
    assert.equal(body.value, '');
    assert.equal(body.disabled, false);
    assert.equal(h.messages.at(-1).status, 'success');
});
