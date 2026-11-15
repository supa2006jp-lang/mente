'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function makeData() {
    return {
        departments: [{ id: 'dept-a', name: 'A' }, { id: 'dept-b', name: 'B' }],
        currentDepartmentId: 'dept-a',
        deptData: {
            'dept-a': {
                machines: [{ id: 'machine-1' }], archivedMachineCategories: ['old'],
                tipsNotes: [{ id: 'tips-1', body: '手順', attachments: [{ name: 'photo.png' }] }]
            },
            'dept-b': { machines: [], tipsNotes: [] }
        }
    };
}

function makeStore(data, save = async () => {}) {
    return {
        data,
        get activeData() { return data.deptData[data.currentDepartmentId]; },
        async runAtomicSaveBatch(mutate) {
            const before = structuredClone(data);
            try {
                mutate();
                await save();
            } catch (error) {
                for (const key of Object.keys(data)) delete data[key];
                Object.assign(data, before);
                throw error;
            }
        },
        hardDeleteMachine(id) {
            this.activeData.machines = this.activeData.machines.filter(item => item.id !== id);
        }
    };
}

function loadApp(source, store) {
    class MaintenanceApp {}
    const calls = [];
    const context = vm.createContext({
        MaintenanceApp, store,
        document: { addEventListener() {} },
        window: {}, localStorage: { getItem() { return null; } },
        confirm: () => true,
        alert: message => calls.push(['alert', message]),
        location: { reload: () => calls.push(['reload']) },
        console: { error() {}, warn() {} }
    });
    vm.runInContext(read(source), context, { filename: source });
    const app = new MaintenanceApp();
    app.showToast = (message, kind) => calls.push(['toast', kind, message]);
    app.renderTips = () => calls.push(['renderTips']);
    app.renderTipsExistingFiles = () => calls.push(['renderTipsExistingFiles']);
    app.renderWorkerMaintenanceModal = () => calls.push(['renderArchive']);
    app.renderMachines = () => calls.push(['renderMachines']);
    app.renderCalendar = () => calls.push(['renderCalendar']);
    app.recordAdminOperationLog = () => calls.push(['log']);
    app.openDepartmentModal = () => calls.push(['openDepartmentModal']);
    app.closeTipsBodyEditor = () => calls.push(['closeEditor']);
    app.clearTipsForm = () => calls.push(['clearForm']);
    app.showTipsDeleteUndoNotice = (message, undo) => {
        calls.push(['undoNotice', message]);
        app.undoDelete = undo;
    };
    return { app, calls };
}

test('department deletion keeps the original data and dialog when durable save fails', async () => {
    const data = makeData();
    const store = makeStore(data, async () => { throw new Error('disk full'); });
    const { app, calls } = loadApp('app-departments.js', store);
    await app.deleteDepartment('dept-b');
    assert.equal(data.departments.length, 2);
    assert.ok(data.deptData['dept-b']);
    assert.equal(data.currentDepartmentId, 'dept-a');
    assert.equal(calls.some(call => call[0] === 'openDepartmentModal'), false);
    assert.match(calls.find(call => call[0] === 'alert')?.[1] || '', /disk full/);
});

test('current department switches only after its deletion is persisted', async () => {
    const data = makeData();
    let finishSave;
    const store = makeStore(data, () => new Promise(resolve => { finishSave = resolve; }));
    const { app, calls } = loadApp('app-departments.js', store);
    const deleting = app.deleteDepartment('dept-a');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls.some(call => call[0] === 'reload'), false);
    finishSave();
    await deleting;
    assert.equal(data.currentDepartmentId, 'dept-b');
    assert.equal(calls.filter(call => call[0] === 'reload').length, 1);
});

test('hard deletion waits for durable save and rolls back without success UI', async () => {
    const data = makeData();
    let rejectSave;
    const store = makeStore(data, () => new Promise((resolve, reject) => { rejectSave = reject; }));
    const { app, calls } = loadApp('app-hard-delete.js', store);
    const deleting = app.hardDeleteMachine('machine-1', '装置1');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls.some(call => call[0] === 'renderMachines'), false);
    rejectSave(new Error('write failed'));
    assert.equal(await deleting, false);
    assert.equal(data.deptData['dept-a'].machines.length, 1);
    assert.equal(calls.some(call => call[0] === 'log'), false);
    assert.equal(calls.some(call => call[0] === 'renderMachines'), false);
    assert.equal(calls.find(call => call[0] === 'toast')?.[1], 'error');
});

test('TIPS note deletion is saved before the undo notice and undo restores it', async () => {
    const data = makeData();
    const store = makeStore(data);
    const { app, calls } = loadApp('app-tips.js', store);
    assert.equal(await app.deleteTipsNote('tips-1'), true);
    assert.equal(data.deptData['dept-a'].tipsNotes.length, 0);
    assert.ok(calls.some(call => call[0] === 'undoNotice'));
    await app.undoDelete();
    assert.equal(data.deptData['dept-a'].tipsNotes[0].id, 'tips-1');
});

test('failed TIPS note deletion keeps the note and does not offer undo', async () => {
    const data = makeData();
    const store = makeStore(data, async () => { throw new Error('quota'); });
    const { app, calls } = loadApp('app-tips.js', store);
    assert.equal(await app.deleteTipsNote('tips-1'), false);
    assert.equal(data.deptData['dept-a'].tipsNotes[0].id, 'tips-1');
    assert.equal(calls.some(call => call[0] === 'undoNotice'), false);
    assert.equal(calls.find(call => call[0] === 'toast')?.[1], 'error');
});

test('failed TIPS attachment deletion preserves the file and does not offer undo', async () => {
    const data = makeData();
    const store = makeStore(data, async () => { throw new Error('storage failed'); });
    const { app, calls } = loadApp('app-tips.js', store);
    assert.equal(await app.deleteTipsAttachment('tips-1', 0), false);
    assert.equal(data.deptData['dept-a'].tipsNotes[0].attachments[0].name, 'photo.png');
    assert.equal(calls.some(call => call[0] === 'undoNotice'), false);
    assert.equal(calls.find(call => call[0] === 'toast')?.[1], 'error');
});

test('TIPS attachment undo returns the file to its original position', async () => {
    const data = makeData();
    data.deptData['dept-a'].tipsNotes[0].attachments.push({ name: 'manual.pdf' });
    const store = makeStore(data);
    const { app } = loadApp('app-tips.js', store);
    assert.equal(await app.deleteTipsAttachment('tips-1', 0), true);
    assert.deepEqual(data.deptData['dept-a'].tipsNotes[0].attachments.map(file => file.name), ['manual.pdf']);
    await app.undoDelete();
    assert.deepEqual(data.deptData['dept-a'].tipsNotes[0].attachments.map(file => file.name), ['photo.png', 'manual.pdf']);
});
