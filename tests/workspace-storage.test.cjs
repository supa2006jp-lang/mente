const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const workspaceSource = fs.readFileSync(path.join(root, 'workspace-storage.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'store.js'), 'utf8');
const prefix = 'maintenance_workspace_separate_v1::';

function loadWorkspace(search = '') {
    const values = new Map([['example', 'main value']]);
    const calls = [];
    const nativeStorage = {
        getItem(key) {
            calls.push({ operation: 'get', key: String(key) });
            return values.has(String(key)) ? values.get(String(key)) : null;
        },
        setItem(key, value) {
            calls.push({ operation: 'set', key: String(key) });
            values.set(String(key), String(value));
        },
        removeItem(key) {
            calls.push({ operation: 'remove', key: String(key) });
            values.delete(String(key));
        }
    };
    const sandbox = { localStorage: nativeStorage, location: { search }, URLSearchParams, URL, console };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(workspaceSource, context, { filename: 'workspace-storage.js' });
    return { context, sandbox, nativeStorage, values, calls };
}

test('separate workspace namespaces localStorage without touching main keys', () => {
    const { context, sandbox, nativeStorage, values, calls } = loadWorkspace('?workspace=separate');
    assert.equal(vm.runInContext('localStorage.getItem("example")', context), null);
    vm.runInContext('localStorage.setItem("example", "separate value")', context);
    assert.equal(vm.runInContext('localStorage.getItem("example")', context), 'separate value');
    assert.equal(values.get('example'), 'main value');
    assert.equal(values.get(prefix + 'example'), 'separate value');
    vm.runInContext('localStorage.removeItem("example")', context);
    assert.equal(values.has(prefix + 'example'), false);
    assert.equal(values.get('example'), 'main value');
    assert.deepEqual(calls.map(call => call.key), Array(calls.length).fill(prefix + 'example'));
    assert.equal(sandbox.window.localStorage, nativeStorage);
});

test('ordinary workspace keeps native localStorage keys and object', () => {
    const { context, nativeStorage, values, calls } = loadWorkspace('');
    assert.equal(vm.runInContext('localStorage', context), nativeStorage);
    assert.equal(vm.runInContext('localStorage.getItem("example")', context), 'main value');
    vm.runInContext('localStorage.setItem("example", "updated main")', context);
    assert.equal(values.get('example'), 'updated main');
    assert.equal(values.has(prefix + 'example'), false);
    assert.deepEqual(calls.map(call => call.key), ['example', 'example']);
});

test('later classic scripts see the namespaced binding and use the separate IndexedDB', () => {
    const { context, sandbox, values } = loadWorkspace('?workspace=separate');
    vm.runInContext('localStorage.setItem("from-later-script", "isolated")', context, {
        filename: 'later-classic.js'
    });
    assert.equal(values.get(prefix + 'from-later-script'), 'isolated');
    assert.equal(values.has('from-later-script'), false);
    vm.runInContext(storeSource, context, { filename: 'store.js' });
    assert.equal(sandbox.window.store.DB_NAME, 'FactoryMaintenanceDB_Separate_v1');
});

test('workspace wrapper is a classic script loaded before store and application scripts', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const workspaceTag = html.match(/<script\b[^>]*\bsrc="workspace-storage\.js(?:\?[^\"]*)?"[^>]*>/);
    assert.ok(workspaceTag, 'workspace-storage.js script tag is required');
    assert.doesNotMatch(workspaceTag[0], /\btype\s*=\s*["']module["']/);
    const workspacePosition = html.indexOf(workspaceTag[0]);
    for (const file of ['store.js', 'app.js', 'app-boot.js']) {
        const scriptPosition = html.search(new RegExp('<script\\b[^>]*\\bsrc="' + file.replace('.', '\\.') + '(?:\\?[^\\"]*)?"'));
        assert.ok(scriptPosition > workspacePosition, `${file} must load after workspace-storage.js`);
    }
});
const bootSource = fs.readFileSync(path.join(root, 'app-boot.js'), 'utf8');

function bootHarness({ separate = false, wrapperMissing = false, loadStatus = 'empty-unconfirmed', loadError = null, save = async () => {} } = {}) {
    const initialUrl = separate
        ? 'https://example.test/index.html?workspace=separate&view=calendar#today'
        : 'https://example.test/index.html?view=calendar#today';
    let boot = null;
    let appCount = 0;
    let emptyConfirmations = 0;
    let saves = 0;
    const navigation = [];
    function element(tagName) {
        return {
            tagName,
            children: [],
            parent: null,
            listeners: {},
            style: {},
            textContent: '',
            disabled: false,
            appendChild(child) {
                child.parent = this;
                this.children.push(child);
                return child;
            },
            append(...children) { children.forEach(child => this.appendChild(child)); },
            remove() {
                if (!this.parent) return;
                this.parent.children = this.parent.children.filter(child => child !== this);
                this.parent = null;
            },
            addEventListener(type, callback) { this.listeners[type] = callback; },
            focus() {}
        };
    }
    const body = element('body');
    const find = predicate => {
        const visit = node => predicate(node)
            ? node
            : node.children.map(visit).find(Boolean);
        return visit(body);
    };
    const document = {
        body,
        createElement: element,
        getElementById(id) { return find(node => node.id === id) || null; }
    };
    const location = {
        href: initialUrl,
        search: new URL(initialUrl).search,
        assign(url) { navigation.push(url); },
        reload() { navigation.push('reload'); }
    };
    const window = {
        location,
        ...(wrapperMissing ? {} : { maintenanceWorkspace: { separate } }),
        addEventListener(type, callback) {
            if (type === 'DOMContentLoaded') boot = callback;
        },
        setTimeout() {}
    };
    const context = vm.createContext({
        document,
        window,
        URL,
        store: {
            init: async () => {
                if (loadError) throw loadError;
                return loadStatus;
            },
            confirmEmptyStore() { emptyConfirmations += 1; },
            async save() {
                saves += 1;
                return save();
            }
        },
        MaintenanceApp: class { constructor() { appCount += 1; } },
        console: { error() {} },
        alert() {}
    });
    vm.runInContext(bootSource, context, { filename: 'app-boot.js' });
    return {
        boot: () => boot(),
        document,
        find,
        navigation,
        get appCount() { return appCount; },
        get emptyConfirmations() { return emptyConfirmations; },
        get saves() { return saves; }
    };
}

for (const scenario of [
    { title: 'failed', loadError: new Error('main state unreadable') },
    { title: 'empty', loadStatus: 'empty-unconfirmed' }
]) {
    test(`main ${scenario.title} startup can switch to separate workspace without writing main data`, async () => {
        const harness = bootHarness(scenario);
        await harness.boot();
        assert.equal(harness.appCount, 0);
        const switchButton = harness.find(node => node.textContent === '別の作業領域で入力する');
        assert.ok(switchButton);
        await switchButton.listeners.click();
        assert.equal(harness.emptyConfirmations, 0);
        assert.equal(harness.saves, 0);
        assert.deepEqual(harness.navigation, [
            'https://example.test/index.html?view=calendar&workspace=separate'
        ]);
    });
}

test('a fresh separate workspace opens only after explicit start and keeps its badge visible', async () => {
    const harness = bootHarness({ separate: true });
    await harness.boot();
    assert.equal(harness.appCount, 0);
    assert.ok(harness.document.getElementById('maintenance-storage-gate'));
    const start = harness.find(node => node.textContent === '新規データで開始');
    assert.ok(start);
    await start.listeners.click();
    assert.equal(harness.emptyConfirmations, 1);
    assert.equal(harness.appCount, 1);
    assert.equal(harness.document.getElementById('maintenance-storage-gate'), null);
    assert.ok(harness.document.getElementById('maintenance-workspace-badge'));
    assert.ok(harness.find(node => node.textContent.includes('別の作業領域で作業中')));
    assert.deepEqual(harness.navigation, []);
});

test('separate workspace badge saves before navigating back to the original URL', async () => {
    let finishSave;
    const pendingSave = new Promise(resolve => { finishSave = resolve; });
    const harness = bootHarness({ separate: true, save: () => pendingSave });
    await harness.boot();
    harness.find(node => node.textContent === '新規データで開始').listeners.click();
    const badge = harness.document.getElementById('maintenance-workspace-badge');
    const back = badge.children.find(node => node.textContent === '元の保存領域へ戻る');
    assert.ok(back);
    const click = back.listeners.click();
    assert.equal(harness.saves, 1);
    assert.equal(back.disabled, true);
    assert.deepEqual(harness.navigation, []);
    finishSave();
    await click;
    assert.deepEqual(harness.navigation, ['https://example.test/index.html?view=calendar']);
});

test('failed separate workspace save keeps the user in the separate workspace', async () => {
    const harness = bootHarness({ separate: true, save: async () => { throw new Error('disk full'); } });
    await harness.boot();
    harness.find(node => node.textContent === '新規データで開始').listeners.click();
    const badge = harness.document.getElementById('maintenance-workspace-badge');
    const back = badge.children.find(node => node.textContent === '元の保存領域へ戻る');
    await back.listeners.click();
    assert.equal(harness.saves, 1);
    assert.deepEqual(harness.navigation, []);
    assert.equal(back.disabled, false);
    assert.ok(harness.document.getElementById('maintenance-workspace-badge'));
});

test('separate URL fails closed if the storage wrapper did not load', async () => {
    let opened = 0;
    const window = { location: { search: '?workspace=separate' } };
    const context = vm.createContext({
        window,
        indexedDB: { open() { opened += 1; throw new Error('must not open IndexedDB'); } }
    });
    vm.runInContext(storeSource, context, { filename: 'store.js' });
    await assert.rejects(window.store.init(), /保存設定/);
    assert.equal(opened, 0);
});

test('a failed wrapper on the separate URL offers a way back to the original area', async () => {
    const harness = bootHarness({
        separate: true,
        wrapperMissing: true,
        loadError: new Error('別の作業領域の保存設定を読み込めませんでした。')
    });
    await harness.boot();
    const back = harness.find(node => node.textContent === '元の保存領域へ戻る');
    assert.ok(back);
    await back.listeners.click();
    assert.deepEqual(harness.navigation, ['https://example.test/index.html?view=calendar']);
});
