'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-persistence.js'), 'utf8');
const archivesSource = fs.readFileSync(path.join(__dirname, '..', 'app-archives.js'), 'utf8');

function fakeMediaDb(initial = []) {
    const records = new Map(initial);
    let failNextWrite = false;
    const db = {
        transaction(_storeName, mode) {
            const operations = [];
            const requests = [];
            const transaction = {
                error: null,
                objectStore() {
                    return {
                        get(key) {
                            const request = { result: undefined, onsuccess: null };
                            requests.push({ key, request });
                            return request;
                        },
                        put(value, key) { operations.push({ kind: 'put', key, value }); },
                        delete(key) { operations.push({ kind: 'delete', key }); }
                    };
                }
            };
            queueMicrotask(() => {
                if (mode === 'readwrite' && failNextWrite) {
                    failNextWrite = false;
                    transaction.error = new Error('quota exceeded');
                    transaction.onabort?.();
                    return;
                }
                for (const { key, request } of requests) {
                    request.result = records.get(key);
                    request.onsuccess?.();
                }
                for (const operation of operations) {
                    if (operation.kind === 'put') records.set(operation.key, operation.value);
                    else records.delete(operation.key);
                }
                transaction.oncomplete?.();
            });
            return transaction;
        }
    };
    return { db, records, failNextWrite() { failNextWrite = true; } };
}

function harness({ initial = [], importSucceeds = true, data = null, capacity = null } = {}) {
    const media = fakeMediaDb(initial);
    const alerts = [];
    const files = [];
    const button = { disabled: false, innerHTML: '' };
    const choiceButtons = [{ disabled: false }, { disabled: false }];
    let imports = 0;
    let reloads = 0;
    class MaintenanceApp {}
    const store = {
        db: media.db,
        MEDIA_STORE_NAME: 'media',
        data: data || { currentDepartmentId: 'dept_default', departments: [{ id: 'dept_default', name: '初期部署' }], deptData: { dept_default: {} } },
        async listMediaEntries() {
            return [...media.records].map(([key, value]) => ({
                key, size: value?.blob?.size || 0, type: value?.blob?.type || ''
            }));
        },
        async loadMediaBlob(key) { return media.records.get(key)?.blob || null; },
        exportAsJSON() { return JSON.stringify({ mainData: this.data }); },
        async saveMediaFileHandle() {},
        async importFromJSON(jsonText) {
            imports++;
            if (!importSucceeds) return false;
            this.data = JSON.parse(jsonText).mainData;
            return true;
        }
    };
    store.activeData = store.data.deptData?.[store.data.currentDepartmentId] || {};
    const context = vm.createContext({
        MaintenanceApp, store, Blob, Uint8Array, btoa, atob, Date,
        navigator: capacity ? { storage: { estimate: async () => capacity } } : undefined,
        document: { querySelector: () => button, querySelectorAll: () => choiceButtons },
        window: {},
        localStorage: { getItem() { return null; }, setItem() {} },
        location: { reload() { reloads++; } },
        confirm: () => true,
        alert: value => alerts.push(value),
        console: { warn() {}, error() {} }
    });
    vm.runInContext(source, context, { filename: 'app-persistence.js' });
    vm.runInContext(archivesSource, context, { filename: 'app-archives.js' });
    const app = new MaintenanceApp();
    app.requireDangerConfirm = () => true;
    app.downloadJsonText = (name, text) => files.push({ name, text });
    app.confirmDownloadedSafetyBackup = async filename => ({ filename, method: 'test-confirmed' });
    app.recordAdminBackupLog = () => {};
    app.recordAdminOperationLog = () => {};
    app.getLocalDateString = () => '2026-11-14';
    app.renderWorkerMaintenanceModal = () => {};
    app.renderWorkers = () => {};
    app.showToast = () => {};
    app.closeModal = () => {};
    return { app, store, media, alerts, files, button, context, get imports() { return imports; }, get reloads() { return reloads; } };
}

function incomingWithMedia(key, text) {
    const bytes = new Blob([text], { type: 'audio/wav' });
    return {
        mainData: { currentDepartmentId: 'dept_default', deptData: { dept_default: { history: [{ id: 'new' }] } } },
        embeddedMedia: {
            version: 1,
            entries: [{ key, type: 'audio/wav', size: bytes.size, base64: btoa(text) }]
        }
    };
}

function setPreview(app, incoming) {
    app.pendingFullImportPreview = {
        raw: incoming,
        jsonText: JSON.stringify(incoming),
        fileName: 'latest.json',
        typeLabel: '完全バックアップ',
        incomingDeptName: '初期部署',
        incomingCounts: {},
        currentCounts: {}
    };
}

test('complete latest.json embeds separate audio and video blobs and restores their bytes', async () => {
    const audio = new Blob([new Uint8Array([0, 1, 2, 255])], { type: 'audio/wav' });
    const video = new Blob(['video-bytes'], { type: 'video/mp4' });
    const h = harness({ initial: [
        ['photo-manager-audio:dept_default:a', { blob: audio }],
        ['video:dept_default:v', { blob: video }],
        ['maintenance_latest_json_file', { handle: { kind: 'file' } }]
    ] });
    const text = await h.app.buildCompleteBackupJson('{"mainData":{"history":[]}}');
    const backup = JSON.parse(text);
    assert.equal(backup.embeddedMedia.version, 1);
    assert.equal(backup.embeddedMedia.entries.length, 2);
    const restored = h.app.decodeEmbeddedMedia(backup.embeddedMedia);
    assert.deepEqual([...new Uint8Array(await restored[0].value.blob.arrayBuffer())], [0, 1, 2, 255]);
    assert.equal(await restored[1].value.blob.text(), 'video-bytes');
    assert.equal(restored[1].value.blob.type, 'video/mp4');
});

test('complete JSON marks an empty media store explicitly', async () => {
    const h = harness();
    const backup = JSON.parse(await h.app.buildCompleteBackupJson(h.store.exportAsJSON()));
    assert.equal(backup.embeddedMedia.version, 1);
    assert.deepEqual(Array.from(backup.embeddedMedia.entries), []);
});

test('complete backup keeps inline images once and omits their IndexedDB copies', async () => {
    const image = 'data:image/png;base64,AQID';
    const h = harness({ initial: [['image:sha256-example', {
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    }]] });
    h.store.data.deptData.dept_default.photoManagerLibrary = [{ id: 'image-1', src: image }];
    const backup = JSON.parse(await h.app.buildCompleteBackupJson(h.store.exportAsJSON()));
    assert.equal(backup.mainData.deptData.dept_default.photoManagerLibrary[0].src, image);
    assert.equal(backup.embeddedMedia.entries.length, 0);
    assert.throws(() => h.app.inspectEmbeddedMedia({ version: 1, entries: [{
        key: 'image:sha256-example', type: 'image/png', size: 3, base64: 'AQID'
    }] }), /不正な項目/);
});

test('complete export still writes one latest.json containing the media payload', async () => {
    const h = harness({ initial: [['photo-manager-audio:dept_default:a', {
        blob: new Blob(['audio'], { type: 'audio/wav' })
    }]] });
    let savedText = '';
    h.app._latestJsonFileHandle = {
        kind: 'file', name: 'latest.json',
        async queryPermission() { return 'granted'; },
        async createWritable() { return { async write(blob) { savedText = await blob.text(); }, async close() {} }; }
    };
    await h.app.exportOptimizedBackup();
    assert.equal(JSON.parse(savedText).embeddedMedia.entries.length, 1);
    assert.equal(h.files.length, 0);
    assert.equal(h.app._lastLatestJsonExport.kind, 'file');
});

test('full import restores embedded media before committing main data', async () => {
    const h = harness();
    const incoming = incomingWithMedia('photo-manager-audio:dept_default:new', 'new-audio');
    h.app.pendingFullImportPreview = h.app.getImportPreviewInfo(JSON.stringify(incoming), 'latest.json');
    assert.equal(h.app.pendingFullImportPreview.mediaBackup.count, 1);
    assert.equal(Object.hasOwn(h.app.pendingFullImportPreview, 'raw'), false);
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 1);
    assert.equal(h.reloads, 1);
    assert.equal(await h.media.records.get('photo-manager-audio:dept_default:new').blob.text(), 'new-audio');
    assert.equal(h.store.data.deptData.dept_default.history[0].id, 'new');
    assert.equal(h.files.length, 1);
    assert.match(h.files[0].name, /^maintenance_before_import_.*\.json$/);
});

test('pre-import safety backup retains the previous media bytes', async () => {
    const key = 'photo-manager-audio:dept_default:a';
    const h = harness({ initial: [[key, { blob: new Blob(['previous'], { type: 'audio/wav' }) }]] });
    setPreview(h.app, incomingWithMedia(key, 'incoming'));
    await h.app.confirmFullImportFromPreview();
    const safetyCopy = JSON.parse(h.files[0].text);
    assert.equal(atob(safetyCopy.embeddedMedia.entries[0].base64), 'previous');
    assert.equal(await h.media.records.get(key).blob.text(), 'incoming');
});

test('old JSON without embedded media still imports without touching existing media', async () => {
    const oldBlob = new Blob(['keep'], { type: 'audio/wav' });
    const h = harness({ initial: [['photo-manager-audio:dept_default:old', { blob: oldBlob }]] });
    setPreview(h.app, { mainData: { currentDepartmentId: 'dept_default', deptData: { dept_default: { history: [] } } } });
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 1);
    assert.equal(h.reloads, 1);
    assert.equal(await h.media.records.get('photo-manager-audio:dept_default:old').blob.text(), 'keep');
});

test('invalid embedded media is rejected before any saved state changes', async () => {
    const h = harness();
    const incoming = incomingWithMedia('photo-manager-audio:dept_default:a', 'a');
    incoming.embeddedMedia.entries[0].size = 2;
    setPreview(h.app, incoming);
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.files.length, 0);
    assert.equal(h.media.records.size, 0);
    assert.equal(h.reloads, 0);
    assert.match(h.alerts[0], /容量が一致/);
});

test('manifest missing media referenced by its main data is rejected before import', async () => {
    const h = harness();
    const incoming = incomingWithMedia('photo-manager-audio:dept_default:included', 'audio');
    incoming.mainData.deptData.dept_default.photoManagerAudios = [
        { mediaKey: 'photo-manager-audio:dept_default:missing' }
    ];
    assert.throws(() => h.app.getImportPreviewInfo(JSON.stringify(incoming), 'latest.json'), /本体が含まれていません/);
    setPreview(h.app, incoming);
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.files.length, 0);
    assert.equal(h.media.records.size, 0);
    assert.match(h.alerts[0], /本体が含まれていません/);
});

test('manifest validates direct media keys in legacy data without deptData', () => {
    const h = harness();
    const incoming = incomingWithMedia('photo-manager-audio:dept_default:included', 'audio');
    incoming.mainData = { photoManagerAudios: [{ mediaKey: 'photo-manager-audio:dept_default:missing' }] };
    assert.throws(() => h.app.getImportPreviewInfo(JSON.stringify(incoming), 'legacy.json'), /本体が含まれていません/);
});

test('media quota failure aborts before main data import and preserves old media', async () => {
    const oldBlob = new Blob(['old'], { type: 'audio/wav' });
    const h = harness({ initial: [['photo-manager-audio:dept_default:a', { blob: oldBlob }]] });
    h.media.failNextWrite();
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:a', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.reloads, 0);
    assert.equal(await h.media.records.get('photo-manager-audio:dept_default:a').blob.text(), 'old');
    assert.match(h.alerts[0], /quota exceeded/);
});

test('insufficient estimated capacity is reported before writing media or main data', async () => {
    const h = harness({ capacity: { usage: 99, quota: 100 } });
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:a', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.media.records.size, 0);
    assert.equal(h.reloads, 0);
    assert.match(h.alerts[0], /空き容量が不足/);
});

test('failed main data import rolls back a replaced media blob', async () => {
    const oldBlob = new Blob(['old'], { type: 'audio/wav' });
    const h = harness({ importSucceeds: false, initial: [['photo-manager-audio:dept_default:a', { blob: oldBlob }]] });
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:a', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 1);
    assert.equal(h.reloads, 0);
    assert.equal(await h.media.records.get('photo-manager-audio:dept_default:a').blob.text(), 'old');
    assert.match(h.alerts[0], /主データを保存できませんでした/);
});

test('complete backup refuses to claim missing media when IndexedDB is unavailable', async () => {
    const h = harness({ data: {
        currentDepartmentId: 'dept_default',
        deptData: { dept_default: { photoManagerAudios: [{ mediaKey: 'photo-manager-audio:dept_default:a' }] } }
    } });
    h.store.db = null;
    await assert.rejects(h.app.buildCompleteBackupJson(h.store.exportAsJSON()), /別保存の音声・動画領域を開けない/);
});

test('complete backup reports referenced audio and video that are missing from IndexedDB', async () => {
    const h = harness({ data: {
        currentDepartmentId: 'dept_default',
        deptData: { dept_default: {
            photoManagerAudios: [{ mediaKey: 'photo-manager-audio:dept_default:missing' }],
            photoManagerVideos: [{ id: 'missing-video' }],
            shiftPhotoCompareVideoFrames: [{ mediaKey: 'shift-frame-missing' }],
            photoCompareMarks: [{ pages: [{ recordedAudioKey: 'shift-page-audio-missing' }] }]
        } }
    } });
    await assert.rejects(h.app.buildCompleteBackupJson(h.store.exportAsJSON()), /参照中の音声・動画 4件が保存領域に見つかりません/);
});

test('example JSON in ordinary text does not create a false media reference', async () => {
    const h = harness({ data: {
        currentDepartmentId: 'dept_default',
        deptData: { dept_default: {
            memos: { note: '{"mediaKey":"example-only"}' },
            history: [{ text: '例: {"recordedAudioKey":"no-file"}' }]
        } }
    } });
    const backup = JSON.parse(await h.app.buildCompleteBackupJson(h.store.exportAsJSON()));
    assert.deepEqual(Array.from(backup.embeddedMedia.entries), []);
});

test('complete backup checks media references in the serialized snapshot during concurrent edits', async () => {
    const h = harness();
    const snapshot = JSON.stringify({ mainData: {
        currentDepartmentId: 'dept_default',
        deptData: { dept_default: { photoManagerAudios: [{ mediaKey: 'photo-manager-audio:dept_default:at-export' }] } }
    } });
    h.store.data.deptData.dept_default.photoManagerAudios = [
        { mediaKey: 'photo-manager-audio:dept_default:after-export' }
    ];
    h.media.records.set('photo-manager-audio:dept_default:after-export', {
        blob: new Blob(['newer'], { type: 'audio/wav' })
    });
    await assert.rejects(h.app.buildCompleteBackupJson(snapshot), /参照中の音声・動画 1件が保存領域に見つかりません/);
});

test('administration download retains Blob URL until after click and propagates click failures', () => {
    const h = harness();
    const nativeDownload = Object.getPrototypeOf(h.app).downloadJsonText;
    const events = [];
    const timers = [];
    h.context.URL = {
        createObjectURL() { events.push('create'); return 'blob:test'; },
        revokeObjectURL() { events.push('revoke'); }
    };
    h.context.setTimeout = (callback, delay) => timers.push({ callback, delay });
    h.context.document.createElement = () => ({ click() { events.push('click'); } });
    nativeDownload.call(h.app, 'backup.json', '{}');
    assert.deepEqual(events, ['create', 'click']);
    assert.equal(timers[0].delay, 5000);
    timers[0].callback();
    assert.deepEqual(events, ['create', 'click', 'revoke']);

    h.context.document.createElement = () => ({ click() { throw new Error('download blocked'); } });
    assert.throws(() => nativeDownload.call(h.app, 'backup.json', '{}'), /download blocked/);
    assert.deepEqual(events.slice(-2), ['create', 'revoke']);
    assert.equal(timers.length, 1);
});

test('pre-import backup click failure stops before replacing media or main data', async () => {
    const h = harness();
    h.app.downloadJsonText = Object.getPrototypeOf(h.app).downloadJsonText;
    h.app.confirmDownloadedSafetyBackup = Object.getPrototypeOf(h.app).confirmDownloadedSafetyBackup;
    h.context.URL = {
        createObjectURL() { return 'blob:test'; },
        revokeObjectURL() {}
    };
    h.context.document.createElement = () => ({ click() { throw new Error('download blocked'); } });
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:new', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.media.records.size, 0);
    assert.match(h.alerts[0], /バックアップJSONを照合する画面を開けません/);
});

test('manual administration backup also includes separate media', async () => {
    const h = harness({ initial: [['video:dept_default:v', { blob: new Blob(['video'], { type: 'video/mp4' }) }]] });
    await h.app.exportAdminBackupJson();
    assert.equal(h.files.length, 1);
    assert.match(h.files[0].name, /^maintenance_admin_backup_/);
    assert.equal(JSON.parse(h.files[0].text).embeddedMedia.entries[0].key, 'video:dept_default:v');
});

test('repair does not modify references when complete pre-repair backup fails', async () => {
    const h = harness({ data: {
        currentDepartmentId: 'dept_default',
        deptData: { dept_default: { photoManagerAudios: [{ mediaKey: 'photo-manager-audio:dept_default:a' }] } }
    } });
    h.store.db = null;
    const active = { archivedMaintenanceTasks: ['task-1'], archivedGuides: [], archivedTasks: [] };
    h.store.activeData = active;
    h.app.getBrokenDataReport = () => ({
        archivedMaintenanceTasks: ['task-1'], archivedGuides: [], archivedTasks: [], missingMachineHistories: []
    });
    await h.app.cleanupBrokenDataReferences();
    assert.deepEqual(active.archivedMaintenanceTasks, ['task-1']);
    assert.equal(h.files.length, 0);
    assert.match(h.alerts[0], /バックアップ/);
});

test('file picker starts before asynchronous backup work and import waits for close', async () => {
    const h = harness();
    const events = [];
    h.context.window.showSaveFilePicker = () => {
        events.push('picker');
        return Promise.resolve({
            name: 'safety.json',
            async createWritable() {
                events.push('createWritable');
                return {
                    async write(blob) {
                        assert.equal(JSON.parse(await blob.text()).embeddedMedia.version, 1);
                        events.push('write');
                    },
                    async close() { events.push('close'); }
                };
            }
        });
    };
    const originalBuild = h.app.buildCompleteBackupJson;
    h.app.buildCompleteBackupJson = async function (...args) {
        events.push('build');
        return originalBuild.apply(this, args);
    };
    const originalImport = h.store.importFromJSON;
    h.store.importFromJSON = async function (...args) {
        events.push('import');
        return originalImport.apply(this, args);
    };
    setPreview(h.app, { mainData: { currentDepartmentId: 'dept_default', deptData: { dept_default: {} } } });
    await h.app.confirmFullImportFromPreview();
    assert.deepEqual(events, ['picker', 'build', 'createWritable', 'write', 'close', 'import']);
    assert.equal(h.files.length, 0);
    assert.equal(h.imports, 1);
});

test('canceled file picker leaves import preview and saved data intact', async () => {
    const h = harness();
    h.context.window.showSaveFilePicker = () => Promise.reject(Object.assign(new Error('canceled'), { name: 'AbortError' }));
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:new', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.reloads, 0);
    assert.equal(h.media.records.size, 0);
    assert.equal(h.files.length, 0);
    assert.ok(h.app.pendingFullImportPreview);
    assert.equal(h.button.disabled, false);
});

test('failed file close stops import before changing media or main data', async () => {
    const h = harness();
    h.context.window.showSaveFilePicker = () => Promise.resolve({
        async createWritable() { return {
            async write() {},
            async close() { throw new Error('disk full'); },
            async abort() {}
        }; }
    });
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:new', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.reloads, 0);
    assert.equal(h.media.records.size, 0);
    assert.equal(h.files.length, 0);
    assert.match(h.alerts[0], /disk full/);
});

function installSafetyBackupDialogDocument(h, nativeDialog = true) {
    const document = h.context.document;
    const nodes = [];
    const previousFocus = { isConnected: true, count: 0, focus() { this.count++; } };
    document.activeElement = previousFocus;
    document.body = { appendChild(node) { nodes.push(node); } };
    document.createElement = tag => {
        const node = {
            tag,
            style: {},
            listeners: {},
            attrs: {},
            setAttribute(name, value) { this.attrs[name] = value; },
            addEventListener(name, listener) { this.listeners[name] = listener; },
            append(...children) { this.children = children; },
            remove() { this.removed = true; },
            focus() { document.activeElement = this; },
            close() { this.closed = true; }
        };
        if (tag === 'dialog' && nativeDialog) node.showModal = () => { node.opened = true; };
        return node;
    };
    return { document, nodes, previousFocus };
}

test('legacy backup checks saved file bytes before continuing and restores focus', async () => {
    const h = harness();
    const { nodes, previousFocus } = installSafetyBackupDialogDocument(h);
    const confirmDownloadedSafetyBackup = Object.getPrototypeOf(h.app).confirmDownloadedSafetyBackup;
    const confirmation = confirmDownloadedSafetyBackup.call(h.app, 'safety.json', '{"saved":true}');
    const dialog = nodes.find(node => node.tag === 'dialog');
    const input = dialog.children.find(node => node.tag === 'input');
    const status = dialog.children.find(node => node.attrs.role === 'status');
    input.files = [Object.assign(new Blob(['{"saved":truf}']), { name: 'wrong.json' })];
    await input.listeners.change();
    assert.match(status.textContent, /内容がバックアップと一致しません/);
    assert.equal(dialog.removed, undefined);
    input.files = [Object.assign(new Blob(['{"saved":true}']), { name: 'confirmed.json' })];
    await input.listeners.change();
    const result = await confirmation;
    assert.equal(result.filename, 'confirmed.json');
    assert.equal(result.method, 'verified-download');
    assert.equal(dialog.closed, true);
    assert.equal(dialog.removed, true);
    assert.equal(previousFocus.count, 1);
});

test('legacy overlay cancel keeps the backup unconfirmed', async () => {
    const h = harness();
    const { nodes, previousFocus } = installSafetyBackupDialogDocument(h, false);
    const confirmDownloadedSafetyBackup = Object.getPrototypeOf(h.app).confirmDownloadedSafetyBackup;
    const confirmation = confirmDownloadedSafetyBackup.call(h.app, 'safety.json', '{}');
    const dialog = nodes.find(node => node.tag === 'dialog');
    assert.equal(nodes.length, 2);
    assert.equal(dialog.attrs.open, '');
    dialog.children.find(node => node.textContent === '中止').listeners.click();
    assert.equal(await confirmation, null);
    assert.equal(previousFocus.count, 1);
});

test('download blocked after async backup can be retried by a user click', async () => {
    const h = harness();
    const { nodes } = installSafetyBackupDialogDocument(h);
    h.app.confirmDownloadedSafetyBackup = Object.getPrototypeOf(h.app).confirmDownloadedSafetyBackup;
    let downloadAttempts = 0;
    h.app.downloadJsonText = () => {
        downloadAttempts++;
        if (downloadAttempts === 1) throw new Error('gesture expired');
    };
    const saving = h.app.saveVerifiedSafetyBackup('safety.json', '{"saved":true}', { kind: 'download' });
    const dialog = nodes.find(node => node.tag === 'dialog');
    const retry = dialog.children.find(node => node.textContent === 'バックアップをダウンロード');
    retry.listeners.click();
    const input = dialog.children.find(node => node.tag === 'input');
    input.files = [Object.assign(new Blob(['{"saved":true}']), { name: 'safety.json' })];
    await input.listeners.change();
    assert.equal((await saving).method, 'verified-download');
    assert.equal(downloadAttempts, 2);
});

test('a new save request during backup stops import before changing data', async () => {
    const h = harness();
    h.store._saveRequestedRevision = 4;
    h.app.confirmDownloadedSafetyBackup = async filename => {
        h.store._saveRequestedRevision++;
        return { filename, method: 'verified-download' };
    };
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:new', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.files.length, 1);
    assert.equal(h.imports, 0);
    assert.equal(h.media.records.size, 0);
    assert.ok(h.app.pendingFullImportPreview);
    assert.match(h.alerts[0], /現在のデータが変更/);
});

test('repair save failure restores removed IDs while keeping later edits', async () => {
    const h = harness();
    const active = { archivedMaintenanceTasks: ['broken', 'broken'], archivedGuides: [], archivedTasks: [] };
    h.store.activeData = active;
    h.app.getBrokenDataReport = () => ({
        archivedMaintenanceTasks: ['broken', 'broken'], archivedGuides: [], archivedTasks: [], missingMachineHistories: []
    });
    h.store.save = async options => {
        assert.equal(options.discardQueuedOnFailure, true);
        active.archivedMaintenanceTasks.push('later');
        throw new Error('save failed');
    };
    await h.app.cleanupBrokenDataReferences();
    assert.deepEqual(active.archivedMaintenanceTasks, ['broken', 'broken', 'later']);
    assert.match(h.alerts[0], /save failed/);
});
