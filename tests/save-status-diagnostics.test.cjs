'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function makeApp(currentData, alternateData = null, legacyAlternateData = null) {
    const store = {
        data: currentData,
        db: {},
        STORAGE_KEY: 'factory_maintenance_next_data_v2',
        lastSuccessfulSaveAt: currentData.settings?.lastSuccessfulSaveAt || null
    };
    const values = new Map();
    const localStorage = {
        getItem(key) {
            if (values.has(key)) return values.get(key);
            const value = key === store.STORAGE_KEY ? alternateData
                : key === 'factory_maintenance_next_data' ? legacyAlternateData : null;
            return typeof value === 'string' ? value : value ? JSON.stringify(value) : null;
        },
        setItem(key, value) { values.set(key, String(value)); }
    };
    const context = vm.createContext({ store, localStorage, console });
    vm.runInContext(`${source}\nglobalThis.TestApp = MaintenanceApp;`, context, { filename: 'app.js' });
    const app = Object.create(context.TestApp.prototype);
    app.updateSaveStatus = () => {};
    return { app, store, context, localStorage };
}

test('save diagnostics distinguish all departments from the visible department', () => {
    const data = {
        currentDepartmentId: 'a',
        departments: [{ id: 'a', name: 'A工程' }, { id: 'b', name: 'B工程' }],
        deptData: {
            a: { machines: [{}], history: [{}], photoManagerLibrary: [{}], shiftNotebooks: { '2026-11-13': {} } },
            b: { machines: [{}, {}], tasks: [{}] }
        }
    };
    const { app } = makeApp(data);
    const result = app.getSaveStatusCounts(data);
    assert.equal(result.total, 7);
    assert.equal(result.current, 4);
    assert.equal(result.departmentName, 'A工程');
    assert.equal(result.departments, 2);
});

test('a newer localStorage save is flagged even when item counts match', () => {
    const current = {
        currentDepartmentId: 'a', departments: [{ id: 'a', name: 'A工程' }],
        deptData: { a: { machines: [{}] } },
        settings: { lastSuccessfulSaveAt: '2026-11-13T10:00:00.000Z' }
    };
    const alternate = {
        ...current,
        settings: { lastSuccessfulSaveAt: '2026-11-13T10:00:02.000Z' }
    };
    const { app } = makeApp(current, alternate);
    app.refreshSaveStatusAlternateCandidate();
    assert.equal(app._saveStatusAlternateCandidate.significant, true);
});

test('an older empty save remains visible as a switchable candidate', () => {
    const current = {
        currentDepartmentId: 'a', departments: [{ id: 'a', name: 'A工程' }],
        deptData: { a: { machines: [{}] } },
        settings: { lastSuccessfulSaveAt: '2026-11-13T10:00:00.000Z' }
    };
    const alternate = {
        ...current,
        deptData: { a: { machines: [] } },
        settings: { lastSuccessfulSaveAt: '2026-11-12T10:00:00.000Z' }
    };
    const { app, context } = makeApp(current, alternate);
    app.refreshSaveStatusAlternateCandidate();
    assert.equal(app._saveStatusAlternateCandidate.significant, false);
    const status = {
        className: 'app-save-status',
        classList: { contains: () => false },
        querySelector: () => null
    };
    context.document = {
        querySelectorAll: () => [status],
        getElementById: () => null
    };
    app.updateSaveStatus = context.TestApp.prototype.updateSaveStatus;
    app.updateSaveStatus('saved');
    assert.match(status.className, /alternate-candidate/);
    assert.match(status.innerHTML, /別保存候補あり/);
});

test('a corrupt new localStorage key does not hide a valid older candidate', () => {
    const current = {
        currentDepartmentId: 'a', departments: [{ id: 'a', name: 'A工程' }],
        deptData: { a: { machines: [{}] } }
    };
    const legacy = {
        ...current,
        deptData: { a: { machines: Array.from({ length: 8 }, () => ({})) } }
    };
    const { app } = makeApp(current, '{bad', legacy);
    app.refreshSaveStatusAlternateCandidate();
    assert.equal(app._saveStatusAlternateCandidate.total, 8);
    assert.equal(app._saveStatusAlternateCandidate.significant, true);
});

test('a larger localStorage candidate is flagged without changing the active data', () => {
    const current = {
        currentDepartmentId: 'a',
        departments: [{ id: 'a', name: 'A工程' }],
        deptData: { a: { machines: [{}] } },
        settings: { lastSuccessfulSaveAt: '2026-11-12T10:00:00.000Z' }
    };
    const alternate = {
        currentDepartmentId: 'a',
        departments: [{ id: 'a', name: 'A工程' }],
        deptData: { a: { machines: Array.from({ length: 8 }, () => ({})) } },
        settings: { lastSuccessfulSaveAt: '2026-11-13T10:00:00.000Z' }
    };
    const { app, store } = makeApp(current, alternate);
    app.refreshSaveStatusAlternateCandidate();
    assert.equal(app._saveStatusAlternateCandidate.total, 8);
    assert.equal(app._saveStatusAlternateCandidate.significant, true);
    assert.equal(store.data, current);
    assert.equal(store.data.deptData.a.machines.length, 1);
});

test('save failure history keeps only recent metadata across a later successful save and reload', () => {
    const { app, store, context, localStorage } = makeApp({ deptData: { dept_default: {} } });
    for (let revision = 1; revision <= 10; revision++) {
        app.recordSaveFailure({
            backend: revision % 2 ? 'indexeddb' : 'localStorage',
            revision,
            error: new Error(`failure ${revision}\nretry`)
        });
    }
    assert.equal(app._saveFailureHistory.length, 8);
    assert.deepEqual(Array.from(app._saveFailureHistory, entry => entry.revision), [10, 9, 8, 7, 6, 5, 4, 3]);
    assert.equal(app._saveFailureHistory[0].reason, 'failure 10 retry');
    const status = {
        className: 'app-save-status',
        classList: { contains: () => false },
        querySelector: () => null
    };
    context.document = { querySelectorAll: () => [status], getElementById: () => null };
    app.updateSaveStatus = context.TestApp.prototype.updateSaveStatus;
    app.updateSaveStatus('saved');
    assert.equal(app._saveFailureHistory.length, 8);
    assert.equal(JSON.parse(localStorage.getItem('maintenance_save_failure_history_v1')).length, 8);
    const reloaded = Object.create(context.TestApp.prototype);
    assert.deepEqual(Array.from(reloaded.loadSaveFailureHistory(), entry => entry.revision), [10, 9, 8, 7, 6, 5, 4, 3]);
    assert.equal(store.data.deptData.dept_default.machines, undefined);
});

test('persistent storage status can be checked and requested from a user action', async () => {
    const { app, context } = makeApp({ deptData: { dept_default: {} } });
    let requested = 0;
    context.navigator = { storage: {
        async persisted() { return false; },
        async persist() { requested++; return true; }
    } };
    app.renderSaveStatusDiagnostics = () => {};
    assert.equal(await app.refreshPersistentStorageStatus(), 'not-granted');
    await app.requestPersistentStorage();
    assert.equal(requested, 1);
    assert.equal(app._persistentStorageState, 'granted');
});

test('save failure history is copyable without copying saved data contents', async () => {
    const { app, context } = makeApp({ deptData: { dept_default: { machines: [{ id: 'private-machine' }] } } });
    let copied = '';
    context.navigator = { clipboard: { async writeText(value) { copied = value; } } };
    app.recordSaveFailure({ backend: 'indexeddb', revision: 7, error: new Error('QuotaExceededError') });
    app.showToast = () => {};
    await app.copySaveFailureHistory();
    assert.match(copied, /revision 7/);
    assert.match(copied, /QuotaExceededError/);
    assert.doesNotMatch(copied, /private-machine/);
});

test('save diagnostics show persistence request and copyable recent failures', () => {
    const { app, context } = makeApp({ deptData: { dept_default: {} } });
    class Element {
        constructor(tagName) { this.tagName = tagName; this.children = []; this.handlers = {}; this.hidden = false; }
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.children.push(child); return child; }
        replaceChildren(...children) { this.children = [...children]; }
        addEventListener(type, listener) { this.handlers[type] = listener; }
    }
    const panel = new Element('div');
    context.document = {
        getElementById(id) { return id === 'app-save-diagnostics' ? panel : null; },
        createElement(tagName) { return new Element(tagName); }
    };
    context.navigator = { storage: { async persist() { return true; } } };
    app._persistentStorageState = 'not-granted';
    app._saveFailureHistory = [{ at: '2026-11-15T00:00:00.000Z', backend: 'indexeddb', revision: 4, reason: '保存領域エラー' }];
    app.renderSaveStatusDiagnostics();

    const text = panel.children.map(child => child.textContent || child.children.map(item => item.textContent).join(' ')).join('\n');
    assert.match(text, /永続化を要求/);
    assert.match(text, /保存失敗履歴/);
    assert.match(text, /保存領域エラー/);
    assert.ok(panel.children.some(child => child.textContent === '失敗履歴をコピー' && typeof child.handlers.click === 'function'));
});
