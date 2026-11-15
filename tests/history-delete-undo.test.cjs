'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-history.js'), 'utf8');

function makeHarness(save = async () => {}) {
    class MaintenanceApp {}
    const record = {
        id: 'history-1',
        replacedParts: [{ name: 'bolt', model: 'M3', count: 2 }]
    };
    const master = { name: 'bolt', model: 'M3', stock: 5, unit: '個' };
    let active = {
        history: [record],
        partsMaster: [master],
        partStockMovements: []
    };
    const calls = [];
    const alerts = [];
    const button = { disabled: false, isConnected: true };
    const store = {
        data: { currentDepartmentId: 'dept-default' },
        get activeData() { return active; },
        set activeData(value) { active = value; },
        getPartMaster(name, model) {
            return active.partsMaster.find(part => part.name === name && part.model === model) || null;
        },
        recordPartStockMovement(part, delta, before, after, options) {
            const movement = { part, delta, before, after, ...options };
            active.partStockMovements.push(movement);
            return movement;
        },
        save(options) {
            const saveCount = calls.filter(call => call.type === 'save').length + 1;
            calls.push({ type: 'save', options, stock: active.partsMaster[0].stock, count: active.history.length });
            return save(saveCount);
        },
        async runAtomicSaveBatch(mutate) {
            const before = structuredClone(active);
            try {
                mutate();
                await this.save({ discardQueuedOnFailure: true });
            } catch (error) {
                active = before;
                throw error;
            }
        }
    };
    const context = vm.createContext({
        MaintenanceApp, store,
        document: { querySelector: () => button },
        confirm: () => true,
        alert: message => alerts.push(message),
        console: { error() {}, warn() {} }
    });
    vm.runInContext(source, context, { filename: 'app-history.js' });
    const app = new MaintenanceApp();
    app.closeModal = () => calls.push({ type: 'close' });
    app.renderCalendar = () => calls.push({ type: 'calendar' });
    app.renderHistory = () => calls.push({ type: 'history' });
    app.showHistoryDeleteUndoNotice = (deleted, undo) => {
        calls.push({ type: 'undo-notice', deleted });
        app.undoCallback = undo;
    };
    return { app, store, active, record, master, button, calls, alerts };
}

test('history delete saves record and stock together, then undo restores both', async () => {
    const h = makeHarness();
    await h.app.deleteHistoryEntry(h.record.id);

    assert.equal(h.active.history.length, 0);
    assert.equal(h.master.stock, 7);
    assert.equal(h.active.partStockMovements.length, 1);
    assert.equal(h.active.partStockMovements[0].source, 'maintenance-delete');
    assert.equal(h.calls.filter(call => call.type === 'save').length, 1);
    assert.equal(h.calls.find(call => call.type === 'save').options.discardQueuedOnFailure, true);
    assert.ok(h.calls.findIndex(call => call.type === 'save') < h.calls.findIndex(call => call.type === 'close'));
    assert.equal(h.button.disabled, false);

    await h.app.undoCallback();
    assert.equal(h.active.history[0], h.record);
    assert.equal(h.master.stock, 5);
    assert.equal(h.active.partStockMovements.length, 2);
    assert.equal(h.active.partStockMovements[1].source, 'maintenance-delete-undo');
    assert.equal(h.calls.filter(call => call.type === 'save').length, 2);
});

test('failed history deletion rolls back record, stock, and movement without closing the form', async () => {
    const h = makeHarness(async () => { throw new Error('storage failed'); });
    await h.app.deleteHistoryEntry(h.record.id);

    assert.equal(h.active.history[0], h.record);
    assert.equal(h.master.stock, 5);
    assert.equal(h.active.partStockMovements.length, 0);
    assert.equal(h.calls.some(call => call.type === 'close'), false);
    assert.equal(h.calls.some(call => call.type === 'undo-notice'), false);
    assert.match(h.alerts[0], /storage failed/);
    assert.equal(h.button.disabled, false);
});

test('failed undo leaves the successful deletion in place for retry', async () => {
    const h = makeHarness(async count => {
        if (count === 2) throw new Error('undo save failed');
    });
    await h.app.deleteHistoryEntry(h.record.id);
    await assert.rejects(h.app.undoCallback(), /undo save failed/);

    assert.equal(h.store.activeData.history.length, 0);
    assert.equal(h.store.activeData.partsMaster[0].stock, 7);
    assert.equal(h.store.activeData.partStockMovements.length, 1);
    assert.equal(h.calls.filter(call => call.type === 'calendar').length, 1);
});

test('undo reverses only the deletion stock delta after another stock change', async () => {
    const h = makeHarness();
    await h.app.deleteHistoryEntry(h.record.id);
    h.master.stock += 3;
    await h.app.undoCallback();

    assert.equal(h.master.stock, 8);
    assert.equal(h.active.history[0], h.record);
});

test('undo restores current department after another failed batch replaced its objects', async () => {
    const h = makeHarness();
    await h.app.deleteHistoryEntry(h.record.id);
    const staleActive = h.store.activeData;
    h.store.activeData = structuredClone(staleActive);

    await h.app.undoCallback();

    assert.equal(staleActive.history.length, 0);
    assert.equal(h.store.activeData.history[0].id, h.record.id);
    assert.equal(h.store.activeData.partsMaster[0].stock, 5);
    assert.equal(h.store.activeData.partStockMovements[1].source, 'maintenance-delete-undo');
});
