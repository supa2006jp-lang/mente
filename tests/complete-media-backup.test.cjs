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
    h.context.URL = {
        createObjectURL() { return 'blob:test'; },
        revokeObjectURL() {}
    };
    h.context.document.createElement = () => ({ click() { throw new Error('download blocked'); } });
    setPreview(h.app, incomingWithMedia('photo-manager-audio:dept_default:new', 'new'));
    await h.app.confirmFullImportFromPreview();
    assert.equal(h.imports, 0);
    assert.equal(h.media.records.size, 0);
    assert.match(h.alerts[0], /download blocked/);
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
