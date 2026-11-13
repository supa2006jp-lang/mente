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
    const localStorage = {
        getItem(key) {
            const value = key === store.STORAGE_KEY ? alternateData
                : key === 'factory_maintenance_next_data' ? legacyAlternateData : null;
            return typeof value === 'string' ? value : value ? JSON.stringify(value) : null;
        }
    };
    const context = vm.createContext({ store, localStorage, console });
    vm.runInContext(`${source}\nglobalThis.TestApp = MaintenanceApp;`, context, { filename: 'app.js' });
    const app = Object.create(context.TestApp.prototype);
    app.updateSaveStatus = () => {};
    return { app, store };
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
