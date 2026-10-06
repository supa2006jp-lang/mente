'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function element(className = '') {
    const listeners = new Map();
    return {
        className,
        hidden: false,
        textContent: '',
        children: [],
        attributes: {},
        get classList() {
            return {
                contains: name => this.className.split(/\s+/).includes(name),
                toggle: (name, active) => {
                    const names = new Set(this.className.split(/\s+/).filter(Boolean));
                    if (active) names.add(name);
                    else names.delete(name);
                    this.className = [...names].join(' ');
                }
            };
        },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        replaceChildren(...nodes) { this.children = nodes; },
        appendChild(node) { this.children.push(node); },
        addEventListener(type, fn) {
            listeners.set(type, [...(listeners.get(type) || []), fn]);
        },
        async click() {
            for (const fn of listeners.get('click') || []) await fn({ target: this });
        },
        focus() {}
    };
}

function harness({ lastSavedAt = null, backupKey = null, logs = [] } = {}) {
    const ids = [
        'app-save-status', 'app-storage-details', 'app-storage-retry',
        'app-storage-export', 'app-storage-reload', 'app-storage-alert',
        'app-storage-alert-heading', 'app-storage-alert-message',
        'app-storage-last-saved', 'app-storage-last-backup', 'app-storage-page-url'
    ];
    const nodes = Object.fromEntries(ids.map(id => [id, element()]));
    nodes['app-save-status'].className = 'app-save-status ready';
    nodes['app-storage-details'].hidden = true;
    nodes['app-storage-alert'].hidden = true;
    const values = new Map(backupKey ? [['maintenance-last-backup-at', backupKey]] : []);
    const localStorage = {
        getItem(key) { return values.get(key) ?? null; }
    };
    const listeners = new Map();
    const window = {
        location: {
            protocol: 'http:',
            origin: 'http://127.0.0.1:8000',
            pathname: '/index.html',
            href: 'http://127.0.0.1:8000/index.html?view=calendar',
            reload() {}
        },
        addEventListener(type, fn) {
            listeners.set(type, [...(listeners.get(type) || []), fn]);
        },
        dispatchEvent(event) {
            for (const fn of listeners.get(event.type) || []) fn(event);
        }
    };
    const document = {
        getElementById(id) { return nodes[id] || null; },
        querySelectorAll(selector) {
            return selector === '.app-save-status' ? [nodes['app-save-status']] : [];
        },
        createElement() { return element(); },
        addEventListener() {}
    };
    const store = { lastSavedAt, save: async () => {} };
    const context = vm.createContext({ window, document, localStorage, store, console });
    const App = vm.runInContext(appSource + '\nMaintenanceApp', context, { filename: 'app.js' });
    const app = Object.create(App.prototype);
    app.getAdminBackupLogs = () => logs;
    return { app, nodes, store, window };
}

test('unknown save time is not replaced by the current clock', () => {
    const { app, nodes } = harness();
    app.setupSaveStatusIndicator();
    assert.match(nodes['app-save-status'].className, /ready/);
    assert.equal(nodes['app-storage-last-saved'].textContent, '\u8a18\u9332\u306a\u3057');

    app.updateSaveStatus('saved');
    assert.equal(nodes['app-storage-last-saved'].textContent, '\u8a18\u9332\u306a\u3057');
    assert.match(nodes['app-save-status'].className, /saved/);

    app.updateSaveStatus('saved', { at: '2026-10-06T09:15:00' });
    assert.match(nodes['app-storage-last-saved'].textContent, /2026\/10\/06.*09:15/);
});

test('a stale tab retains its conflict alert after later dirty and saved events', () => {
    const { app, nodes } = harness({ lastSavedAt: '2026-10-06T08:00:00' });
    app.setupSaveStatusIndicator();
    const priorTime = nodes['app-storage-last-saved'].textContent;
    app.updateSaveStatus('conflict', { error: new Error('stale revision') });
    app.updateSaveStatus('dirty');
    app.updateSaveStatus('saved', { at: '2026-10-06T10:00:00' });

    assert.match(nodes['app-save-status'].className, /conflict/);
    assert.equal(nodes['app-storage-alert'].hidden, false);
    assert.equal(nodes['app-storage-retry'].hidden, true);
    assert.equal(nodes['app-storage-reload'].hidden, false);
    assert.equal(nodes['app-storage-last-saved'].textContent, priorTime);
});

test('the persistent error alert offers a working save retry', async () => {
    const { app, nodes, store, window } = harness();
    let attempts = 0;
    store.save = async () => {
        attempts += 1;
        window.dispatchEvent({ type: 'maintenance-save-status', detail: { status: 'saving' } });
        window.dispatchEvent({
            type: 'maintenance-save-status',
            detail: { status: 'saved', at: '2026-10-06T11:30:00' }
        });
    };
    app.setupSaveStatusIndicator();
    window.dispatchEvent({
        type: 'maintenance-save-status',
        detail: { status: 'error', error: new Error('quota exceeded') }
    });
    assert.equal(nodes['app-storage-alert'].hidden, false);
    assert.equal(nodes['app-storage-retry'].hidden, false);
    assert.equal(nodes['app-storage-reload'].hidden, true);
    assert.match(nodes['app-storage-alert-message'].textContent, /quota exceeded/);

    await nodes['app-storage-retry'].click();
    assert.equal(attempts, 1);
    assert.equal(nodes['app-storage-alert'].hidden, true);
    assert.match(nodes['app-save-status'].className, /saved/);
    assert.match(nodes['app-storage-last-saved'].textContent, /2026\/10\/06.*11:30/);
});

test('the details show backup history and the active origin, then a newer backup', () => {
    const { app, nodes, window } = harness({
        logs: [{ at: '2026-10-01T09:45:00' }]
    });
    app.setupSaveStatusIndicator();
    assert.match(nodes['app-storage-last-backup'].textContent, /2026\/10\/01.*09:45/);
    assert.equal(nodes['app-storage-page-url'].textContent, 'http://127.0.0.1:8000/index.html');

    window.dispatchEvent({
        type: 'storage',
        key: 'maintenance-last-backup-at',
        newValue: '2026-10-02T14:20:00'
    });
    assert.match(nodes['app-storage-last-backup'].textContent, /2026\/10\/02.*14:20/);
});
