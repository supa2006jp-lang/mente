'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const storeSource = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const stateKey = 'factory_maintenance_next_data_v2';
const preferenceKey = 'maintenance_selected_storage_source_v1';

function makeData(ids, savedAt) {
    return {
        currentDepartmentId: 'dept_default',
        departments: [{ id: 'dept_default', name: '初期部署' }],
        deptData: { dept_default: { machines: ids.map(id => ({ id })) } },
        settings: { lastSuccessfulSaveAt: savedAt }
    };
}

function makeEnvironment(idbData, localData, options = {}) {
    const localValues = options.localValues || new Map();
    const sessionValues = options.sessionValues || new Map();
    const idbState = options.idbState || { value: idbData };
    if (localData !== undefined) localValues.set(stateKey, typeof localData === 'string' ? localData : JSON.stringify(localData));
    let reloads = 0;
    const savedBackends = [];
    const idbBackups = new Map();
    const database = {
        close() {},
        transaction(name, mode) {
            assert.equal(name, 'state');
            const pendingWrites = [];
            let completionScheduled = false;
            let aborted = false;
            const transaction = {
                objectStore() {
                    return {
                        get(key) {
                            assert.equal(key, stateKey);
                            const request = {};
                            queueMicrotask(() => {
                                request.result = idbState.value;
                                request.onsuccess();
                            });
                            return request;
                        },
                        put(value, key) {
                            assert.equal(mode, 'readwrite');
                            assert.ok(key === stateKey || key.startsWith(`${stateKey}_invalid_original_`));
                            const request = {};
                            if (key !== stateKey && options.failIdbBackupWrite) {
                                aborted = true;
                                queueMicrotask(() => {
                                    transaction.error = new Error('backup quota');
                                    transaction.onabort();
                                });
                            }
                            pendingWrites.push({ value, key });
                            if (!completionScheduled) {
                                completionScheduled = true;
                                queueMicrotask(() => {
                                    if (aborted) return;
                                    for (const write of pendingWrites) {
                                        if (write.key === stateKey) idbState.value = write.value;
                                        else idbBackups.set(write.key, write.value);
                                    }
                                    savedBackends.push('indexeddb');
                                    transaction.oncomplete();
                                });
                            }
                            return request;
                        }
                    };
                }
            };
            return transaction;
        }
    };
    const window = {
        dispatchEvent() {},
        location: { reload() { reloads++; } }
    };
    const context = vm.createContext({
        window,
        localStorage: {
            getItem(key) { return localValues.get(key) ?? null; },
            setItem(key, value) {
                if (options.failPreferenceWrite && key === preferenceKey) throw new Error('quota');
                if (options.failMalformedBackupWrite && key.startsWith(`${stateKey}_invalid_original_`)) throw new Error('backup quota');
                localValues.set(key, String(value));
                savedBackends.push('localStorage');
            }
        },
        sessionStorage: {
            getItem(key) { return sessionValues.get(key) ?? null; },
            setItem(key, value) { sessionValues.set(key, String(value)); },
            removeItem(key) { sessionValues.delete(key); }
        },
        indexedDB: {
            open() {
                const request = {};
                queueMicrotask(() => {
                    request.result = database;
                    request.onsuccess({ target: request });
                });
                return request;
            }
        },
        CustomEvent: class {},
        console: { error() {}, warn() {} },
        confirm: () => true,
        alert: () => {}
    });
    vm.runInContext(storeSource, context, { filename: 'store.js' });
    const store = window.store;
    return {
        store, context, localValues, sessionValues, idbState, idbBackups, savedBackends,
        get reloads() { return reloads; }
    };
}

test('newer local fallback opens and saves there while the older IndexedDB state stays intact', async () => {
    const older = makeData(['old'], '2026-11-12T10:00:00.000Z');
    const newer = makeData(['new'], '2026-11-13T10:00:00.000Z');
    const page = makeEnvironment(older, newer);
    await page.store.init();

    assert.equal(page.store.startupStateSource, 'localStorage');
    assert.equal(page.store.getActiveSaveBackend(), 'localStorage');
    assert.equal(page.store.data.deptData.dept_default.machines[0].id, 'new');
    assert.equal(page.store.storageCandidates.indexeddb.total, 1);
    page.store.activeData.machines.push({ id: 'latest' });
    await page.store.save();
    assert.equal(JSON.parse(page.localValues.get(stateKey)).deptData.dept_default.machines.length, 2);
    assert.equal(page.idbState.value.deptData.dept_default.machines[0].id, 'old');
    assert.equal(page.store.startupStateSource, 'localStorage');
});

test('newer IndexedDB state remains active and leaves the older local candidate available', async () => {
    const newer = makeData(['new'], '2026-11-13T10:00:00.000Z');
    const older = makeData(['old'], '2026-11-12T10:00:00.000Z');
    const page = makeEnvironment(newer, older);
    await page.store.init();

    assert.equal(page.store.startupStateSource, 'indexeddb');
    assert.equal(page.store.getActiveSaveBackend(), 'indexeddb');
    assert.equal(page.store.storageCandidates.localStorage.total, 1);
    page.store.activeData.machines.push({ id: 'latest' });
    await page.store.save();
    assert.equal(page.idbState.value.deptData.dept_default.machines.length, 2);
    assert.equal(JSON.parse(page.localValues.get(stateKey)).deptData.dept_default.machines[0].id, 'old');
});

test('explicit candidate selection survives reload and can be reversed without overwriting either source', async () => {
    const idbState = { value: makeData(['idb-old'], '2026-11-12T10:00:00.000Z') };
    const localValues = new Map([[stateKey, JSON.stringify(makeData(['local-new'], '2026-11-13T10:00:00.000Z'))]]);
    const first = makeEnvironment(undefined, undefined, { idbState, localValues });
    await first.store.init();
    assert.equal(first.store.startupStateSource, 'localStorage');

    await first.store.selectStorageCandidate('indexeddb');
    const second = makeEnvironment(undefined, undefined, { idbState, localValues });
    await second.store.init();
    assert.equal(second.store.startupStateSource, 'indexeddb');
    assert.equal(second.store.data.deptData.dept_default.machines[0].id, 'idb-old');
    assert.equal(second.store.getActiveSaveBackend(), 'indexeddb');

    await second.store.selectStorageCandidate('localStorage');
    const third = makeEnvironment(undefined, undefined, { idbState, localValues });
    await third.store.init();
    assert.equal(third.store.startupStateSource, 'localStorage');
    assert.equal(third.store.data.deptData.dept_default.machines[0].id, 'local-new');
    assert.equal(idbState.value.deptData.dept_default.machines[0].id, 'idb-old');
});

test('a fallback saved after an explicit choice becomes the active candidate on the next launch', async () => {
    const idbState = { value: makeData(['idb'], '2026-11-12T10:00:00.000Z') };
    const localValues = new Map([[stateKey, JSON.stringify(makeData(['local'], '2026-11-13T10:00:00.000Z'))]]);
    const first = makeEnvironment(undefined, undefined, { idbState, localValues });
    await first.store.init();
    await first.store.selectStorageCandidate('indexeddb');

    localValues.set(stateKey, JSON.stringify(makeData(['newer-fallback'], '2099-11-13T10:00:00.000Z')));
    const second = makeEnvironment(undefined, undefined, { idbState, localValues });
    await second.store.init();
    assert.equal(second.store.startupStateSource, 'localStorage');
    assert.equal(second.store.data.deptData.dept_default.machines[0].id, 'newer-fallback');
});

test('manual selection remains effective when the alternate has a future timestamp already', async () => {
    const idbState = { value: makeData(['idb-old'], '2026-11-12T10:00:00.000Z') };
    const localValues = new Map([[stateKey, JSON.stringify(makeData(['local-future'], '2099-11-13T10:00:00.000Z'))]]);
    const first = makeEnvironment(undefined, undefined, { idbState, localValues });
    await first.store.init();
    assert.equal(first.store.startupStateSource, 'localStorage');
    await first.store.selectStorageCandidate('indexeddb');

    const second = makeEnvironment(undefined, undefined, { idbState, localValues });
    await second.store.init();
    assert.equal(second.store.startupStateSource, 'indexeddb');
    assert.equal(second.store.data.deptData.dept_default.machines[0].id, 'idb-old');
});

test('session preference overrides an old local preference when localStorage cannot write it', async () => {
    const idbState = { value: makeData(['idb'], '2026-11-12T10:00:00.000Z') };
    const localValues = new Map([
        [stateKey, JSON.stringify(makeData(['local'], '2026-11-13T10:00:00.000Z'))],
        [preferenceKey, JSON.stringify({ source: 'localStorage', selectedAt: '2026-11-13T12:00:00.000Z' })]
    ]);
    const sessionValues = new Map();
    const first = makeEnvironment(undefined, undefined, { idbState, localValues, sessionValues, failPreferenceWrite: true });
    await first.store.init();
    await first.store.selectStorageCandidate('indexeddb');
    assert.equal(JSON.parse(sessionValues.get(preferenceKey)).source, 'indexeddb');

    const second = makeEnvironment(undefined, undefined, { idbState, localValues, sessionValues, failPreferenceWrite: true });
    await second.store.init();
    assert.equal(second.store.startupStateSource, 'indexeddb');
});

test('archived records and notebook content count as stored data', async () => {
    const archived = makeData([], '2026-11-12T10:00:00.000Z');
    archived.deptData.dept_default.archivedTasks = ['task-1'];
    archived.deptData.dept_default.tipsNotes = [{}];
    archived.deptData.dept_default.shiftNotebooks = { '2026-11-13': {} };
    const page = makeEnvironment(archived, makeData([], '2026-11-13T10:00:00.000Z'));
    await page.store.init();
    assert.equal(page.store.storageCandidates.indexeddb.total, 3);
    vm.runInContext(`${appSource}\nglobalThis.TestApp = MaintenanceApp;`, page.context, { filename: 'app.js' });
    const app = Object.create(page.context.TestApp.prototype);
    app.updateSaveStatus = () => {};
    app.refreshSaveStatusAlternateCandidate();
    assert.equal(app._saveStatusAlternateCandidate.total, 3);
    assert.equal(app.getSaveStatusCounts(archived).total, 3);
});

test('a newer nearly empty local candidate does not erase a richer IndexedDB candidate', async () => {
    const idb = makeData(['one', 'two', 'three', 'four', 'five'], '2026-11-12T10:00:00.000Z');
    const local = makeData([], '2026-11-13T10:00:00.000Z');
    const page = makeEnvironment(idb, local);
    await page.store.init();

    assert.equal(page.store.startupStateSource, 'localStorage');
    assert.equal(page.store.storageCandidates.indexeddb.total, 5);
    assert.equal(page.idbState.value.deptData.dept_default.machines.length, 5);
    assert.equal(page.savedBackends.length, 0);
});

test('corrupt local candidate is skipped and a valid legacy key remains recoverable', async () => {
    const localValues = new Map([
        [stateKey, '{bad'],
        ['factory_maintenance_next_data', JSON.stringify(makeData(['legacy'], '2026-11-13T10:00:00.000Z'))]
    ]);
    const page = makeEnvironment(makeData(['idb'], '2026-11-12T10:00:00.000Z'), undefined, { localValues });
    await page.store.init();

    assert.equal(page.store.startupStateSource, 'localStorage');
    assert.equal(page.store.data.deptData.dept_default.machines[0].id, 'legacy');
    assert.equal(page.store.storageCandidates.localStorage.key, 'factory_maintenance_next_data');
});

test('malformed department arrays are skipped in favor of a valid other backend', async () => {
    const broken = makeData(['idb'], '2026-11-14T10:00:00.000Z');
    broken.deptData.dept_default.machines = { id: 'not-an-array' };
    const local = makeData(['local'], '2026-11-13T10:00:00.000Z');
    const page = makeEnvironment(broken, local);
    await page.store.init();

    assert.equal(page.store.startupStateSource, 'localStorage');
    assert.equal(page.store.activeData.machines[0].id, 'local');
    assert.equal(page.store.malformedStorageReports[0].source, 'indexeddb');
    assert.match(page.store.storageWarning.message, /machines/);
    assert.deepEqual(page.idbState.value, broken);
    assert.equal(page.savedBackends.length, 0);
});

test('legacy fallback preserves a malformed current local record before the first edit save', async () => {
    const broken = makeData(['bad'], '2026-11-14T10:00:00.000Z');
    broken.deptData.dept_default.machines = { id: 'not-an-array' };
    const raw = JSON.stringify(broken);
    const localValues = new Map([
        [stateKey, raw],
        ['factory_maintenance_next_data', JSON.stringify(makeData(['legacy'], '2026-11-13T10:00:00.000Z'))]
    ]);
    const page = makeEnvironment(undefined, undefined, { localValues });
    await page.store.init();

    assert.equal(page.store.activeData.machines[0].id, 'legacy');
    assert.equal(localValues.get(stateKey), raw);
    page.store.activeData.machines.push({ id: 'new' });
    await page.store.save();
    const backupKey = [...localValues.keys()].find(key => key.startsWith(`${stateKey}_invalid_original_`));
    assert.ok(backupKey);
    assert.equal(localValues.get(backupKey), raw);
    assert.equal(JSON.parse(localValues.get(stateKey)).deptData.dept_default.machines.length, 2);
});

test('a full backup area warns but does not prevent an edit from saving', async () => {
    const broken = makeData(['bad'], '2026-11-14T10:00:00.000Z');
    broken.deptData.dept_default.machines = { id: 'not-an-array' };
    const localValues = new Map([
        [stateKey, JSON.stringify(broken)],
        ['factory_maintenance_next_data', JSON.stringify(makeData(['legacy'], '2026-11-13T10:00:00.000Z'))]
    ]);
    const page = makeEnvironment(undefined, undefined, { localValues, failMalformedBackupWrite: true });
    await page.store.init();
    page.store.activeData.machines.push({ id: 'new' });
    await page.store.save();

    assert.equal(JSON.parse(localValues.get(stateKey)).deptData.dept_default.machines.length, 2);
    assert.match(page.store.storageWarning.message, /退避できませんでした/);
});

test('repairable IndexedDB data opens without a gate and is backed up on the first edit', async () => {
    const broken = makeData(['bad'], '2026-11-14T10:00:00.000Z');
    broken.deptData.dept_default.machines = { id: 'not-an-array' };
    broken.deptData.dept_default.history = [{ id: 'kept', replacedParts: { invalid: true }, photos: { invalid: true } }];
    const page = makeEnvironment(broken, undefined);
    await page.store.init();

    assert.equal(page.store.startupStateSource, 'indexeddb');
    assert.equal(page.store.startupSaveSafe, false);
    assert.equal(page.store.activeData.machines.length, 0);
    assert.equal(page.store.activeData.history[0].id, 'kept');
    assert.equal(page.store.activeData.history[0].replacedParts.length, 0);
    assert.equal(page.store.activeData.history[0].photos.length, 0);
    assert.ok(page.store.malformedStorageReports[0].issues.some(issue => issue.includes('写真')));
    assert.deepEqual(page.idbState.value, broken);
    assert.equal(page.savedBackends.length, 0);

    page.store.activeData.machines.push({ id: 'new' });
    await page.store.save();
    assert.equal(page.idbBackups.size, 1);
    assert.deepEqual([...page.idbBackups.values()][0], broken);
    assert.equal(page.idbState.value.deptData.dept_default.machines[0].id, 'new');
});

test('invalid department-list entries are repaired in a copy and retain department records', async () => {
    const broken = makeData(['kept'], '2026-11-14T10:00:00.000Z');
    broken.departments = [null, 7, { name: 'missing id' }, { id: { invalid: true } }];
    broken.currentDepartmentId = 'missing';
    const page = makeEnvironment(broken, undefined);
    await page.store.init();

    assert.equal(page.store.startupRepairSource, 'indexeddb');
    assert.equal(page.store.data.departments[0].id, 'dept_default');
    assert.equal(page.store.activeData.machines[0].id, 'kept');
    assert.deepEqual(page.idbState.value, broken);
    assert.equal(page.savedBackends.length, 0);
});

test('a failed IndexedDB backup copy retries the user save and reports the limitation', async () => {
    const broken = makeData(['bad'], '2026-11-14T10:00:00.000Z');
    broken.deptData.dept_default.machines = { id: 'not-an-array' };
    const page = makeEnvironment(broken, undefined, { failIdbBackupWrite: true });
    await page.store.init();
    page.store.activeData.machines.push({ id: 'new' });
    await page.store.save();

    assert.equal(page.idbBackups.size, 0);
    assert.equal(page.idbState.value.deptData.dept_default.machines[0].id, 'new');
    assert.match(page.store.storageWarning.message, /退避できませんでした/);
});

test('save diagnostics expose the inactive candidate and the switch reloads the app', async () => {
    const page = makeEnvironment(
        makeData(['idb-one', 'idb-two', 'idb-three', 'idb-four', 'idb-five'], '2026-11-12T10:00:00.000Z'),
        makeData(['local'], '2026-11-13T10:00:00.000Z')
    );
    await page.store.init();
    vm.runInContext(`${appSource}\nglobalThis.TestApp = MaintenanceApp;`, page.context, { filename: 'app.js' });
    const app = Object.create(page.context.TestApp.prototype);
    app.updateSaveStatus = () => {};
    app.refreshSaveStatusAlternateCandidate();
    assert.equal(app._saveStatusAlternateCandidate.source, 'indexeddb');
    assert.equal(app._saveStatusAlternateCandidate.significant, true);
    const panel = {
        children: [],
        replaceChildren() { this.children = []; },
        appendChild(node) { this.children.push(node); }
    };
    page.context.document = {
        getElementById(id) { return id === 'app-save-diagnostics' ? panel : null; },
        createElement(tagName) {
            return {
                tagName, children: [], listeners: {},
                append(...nodes) { this.children.push(...nodes); },
                addEventListener(name, handler) { this.listeners[name] = handler; }
            };
        }
    };
    app.renderSaveStatusDiagnostics();
    const switchButton = panel.children.find(node => node.tagName === 'button');
    assert.match(switchButton.textContent, /IndexedDB 側の内容に切り替える/);
    await app.switchSaveStatusCandidate('indexeddb');
    assert.equal(page.reloads, 1);
    assert.equal(JSON.parse(page.localValues.get(preferenceKey)).source, 'indexeddb');
    assert.equal(page.idbState.value.deptData.dept_default.machines.length, 5);
});
