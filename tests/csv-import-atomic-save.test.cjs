'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-csv.js'), 'utf8');
const csv = '日付,機械名,型式,区分,作業内容\n2026-11-14,ポンプ,P1,突発,漏れ';

function makePage(confirmed, text = csv) {
    class MaintenanceApp {}
    class MaintenanceStore {
        static toHalfWidthLower(value) { return String(value).toLowerCase(); }
        static toFullWidth(value) { return String(value); }
    }
    const alerts = [];
    const confirmations = [];
    let saves = 0;
    let closed = 0;
    let nextId = 0;
    const activeData = { machines: [], history: [], partsMaster: [], historyImportLogs: [] };
    const store = {
        activeData,
        getMachines() { return activeData.machines; },
        generateId() { return `new-${++nextId}`; },
        async runAtomicSaveBatch(mutate) { const value = mutate(); saves++; return value; }
    };
    const file = { name: 'test.csv', text: async () => text };
    const document = { getElementById(id) { return id === 'hist-csv-upload' ? { files: [file] } : null; } };
    const context = vm.createContext({
        MaintenanceApp, MaintenanceStore, store, document,
        confirm: message => { confirmations.push(message); return confirmed; }, alert: message => alerts.push(message),
        requestAnimationFrame: callback => callback(), console, Date
    });
    vm.runInContext(source, context, { filename: 'app-csv.js' });
    const app = new MaintenanceApp();
    app.parseHistoryImportParts = () => [];
    app.closeModal = () => { closed++; };
    app.showToast = () => {};
    app.updateDataLists = () => {};
    app.updateHistoryPeriodOptions = () => {};
    app.switchView = () => {};
    app.renderHistory = () => {};
    app.renderCalendar = () => {};
    return { app, activeData, alerts, confirmations, get saves() { return saves; }, get closed() { return closed; } };
}

test('cancelling CSV import leaves provisional machines and history untouched', async () => {
    const page = makePage(false);
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length, 0);
    assert.equal(page.activeData.history.length, 0);
    assert.equal(page.saves, 0);
    assert.equal(page.closed, 0);
    assert.deepEqual(page.alerts, []);
});

test('confirmed CSV import saves machine, history and log in one batch', async () => {
    const page = makePage(true);
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length, 1);
    assert.equal(page.activeData.history.length, 1);
    assert.equal(page.activeData.history[0].machineId, page.activeData.machines[0].id);
    assert.equal(page.activeData.historyImportLogs[0].addedMachines, 1);
    assert.equal(page.saves, 1);
    assert.equal(page.closed, 1);
    assert.deepEqual(page.alerts, []);
});

test('CSV import preserves decimal and zero minutes without silently rounding', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,作業時間\n2026-11-14,ポンプ,P1,突発,交換,12.5\n2026-11-15,ポンプ,P1,突発,確認,0');
    await page.app.processHistoryImportCSV();
    assert.deepEqual(Array.from(page.activeData.history, h => h.workTime), [12.5, 0]);
    assert.equal(page.saves, 1);
});

test('CSV invalid time reports physical source lines including empty and multiline rows and saves nothing', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,作業時間\r\n\r\n2026-11-14,ポンプ,P1,突発,"交換\r\n確認",12.5\r\n2026-11-15,別の機械,P2,突発,確認,30min\r\n2026-11-16,別の機械,P2,突発,確認,-5');
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length, 0);
    assert.equal(page.activeData.history.length, 0);
    assert.equal(page.saves, 0); assert.equal(page.confirmations.length, 0);
    assert.match(page.alerts[0], /5行目: 「30min」/);
    assert.match(page.alerts[0], /6行目: 「-5」/);
});
