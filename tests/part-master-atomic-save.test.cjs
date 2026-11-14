'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-maintenance-forms.js'), 'utf8');

function makePage({ fail = false } = {}) {
    class MaintenanceApp {}
    class MaintenanceStore {}
    const values = {
        'pm-name': '部品', 'pm-model': 'A', 'pm-price-raw': '100',
        'pm-supplier': '仕入先', 'pm-shelf': '棚1', 'pm-remarks': '',
        'pm-photo-base64': '', 'pm-seeds': '', 'pm-stock': '8',
        'pm-min-stock': '2', 'pm-unit': '個',
        'sub-old-name': '部品', 'sub-old-model': 'A',
        'sub-new-name': '正式名', 'sub-new-model': 'B', 'sub-new-price': '120'
    };
    const document = { getElementById(id) { return id in values ? { value: values[id] } : null; } };
    const updates = [];
    let saves = 0;
    let closed = 0;
    let rendered = 0;
    const store = {
        activeData: { partsMaster: [{ name: '部品', model: 'A', price: 50 }] },
        getPartMaster() { return this.activeData.partsMaster[0]; },
        updatePartMaster(...args) { updates.push(args); },
        async runAtomicSaveBatch(mutate) {
            mutate();
            if (fail) throw new Error('disk full');
            saves++;
        }
    };
    const alerts = [];
    const context = vm.createContext({
        MaintenanceApp, MaintenanceStore, store, document,
        alert: message => alerts.push(message), confirm: () => false,
        console: { error() {} }, Date
    });
    vm.runInContext(source, context, { filename: 'app-maintenance-forms.js' });
    const app = new MaintenanceApp();
    app.getPartAliasMasterDeletionCandidates = () => [];
    app.closeModal = () => { closed++; };
    app.renderAnalysis = () => { rendered++; };
    return { app, updates, alerts, get saves() { return saves; }, get closed() { return closed; }, get rendered() { return rendered; } };
}

test('part master waits for one confirmed save before closing', async () => {
    const page = makePage();
    await page.app.saveModalData('part-master');
    assert.equal(page.saves, 1);
    assert.equal(page.closed, 1);
    assert.equal(page.rendered, 1);
    assert.equal(page.updates.length, 1);
    assert.equal(page.updates[0][2].stock, 8);
    assert.deepEqual(page.alerts, []);
});

test('substitute stays open when its save fails', async () => {
    const page = makePage({ fail: true });
    await page.app.saveModalData('substitute');
    assert.equal(page.closed, 0);
    assert.equal(page.rendered, 0);
    assert.match(page.alerts[0], /disk full/);
});
