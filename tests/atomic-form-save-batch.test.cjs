'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const storageKey = 'factory_maintenance_next_data_v2';

function makeStore({ failSave = false } = {}) {
    const values = new Map();
    let writes = 0;
    const window = { dispatchEvent() {} };
    const context = vm.createContext({
        window,
        localStorage: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) {
                if (key === storageKey) {
                    writes++;
                    if (failSave) throw new Error('quota full');
                }
                values.set(key, String(value));
            }
        },
        CustomEvent: class {},
        console: { error() {}, warn() {} }
    });
    vm.runInContext(source, context, { filename: 'store.js' });
    const store = window.store;
    store.activeData.partsMaster = [{ name: '部品', model: 'A', stock: 5, unit: '個' }];
    return { store, values, get writes() { return writes; } };
}

test('a machine and stock update commit as one save with one movement record', async () => {
    const page = makeStore();
    const machine = await page.store.runAtomicSaveBatch(() => {
        const created = page.store.addMachine('機械', '型式');
        page.store.adjustStock('部品', 'A', -2, { source: 'maintenance' });
        return created;
    });

    assert.equal(page.writes, 1);
    assert.equal(page.store.activeData.machines[0].id, machine.id);
    assert.equal(page.store.activeData.partsMaster[0].stock, 3);
    assert.equal(page.store.activeData.partStockMovements.length, 1);
    const saved = JSON.parse(page.values.get(storageKey));
    assert.equal(saved.deptData.dept_default.machines.length, 1);
    assert.equal(saved.deptData.dept_default.partsMaster[0].stock, 3);
});

test('failed final save restores machine, stock and movement data in memory', async () => {
    const page = makeStore({ failSave: true });
    const originalData = page.store.data;
    await assert.rejects(page.store.runAtomicSaveBatch(() => {
        page.store.addMachine('機械', '型式');
        page.store.adjustStock('部品', 'A', -2, { source: 'maintenance' });
    }), /quota full/);

    assert.equal(page.writes, 1);
    assert.equal(page.store.data, originalData);
    assert.equal(page.store.activeData.machines.length, 0);
    assert.equal(page.store.activeData.partsMaster[0].stock, 5);
    assert.equal(page.store.activeData.partStockMovements, undefined);
    assert.equal(page.values.has(storageKey), false);
});

test('exception during a batch restores the old data without attempting a save', async () => {
    const page = makeStore();
    await assert.rejects(page.store.runAtomicSaveBatch(() => {
        page.store.addMachine('機械', '型式');
        throw new Error('invalid row');
    }), /invalid row/);
    assert.equal(page.store.activeData.machines.length, 0);
    assert.equal(page.writes, 0);
});
