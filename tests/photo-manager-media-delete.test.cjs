'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

function makeHarness({ audio = [], video = [], save, removeMedia } = {}) {
    class MaintenanceApp {}
    const activeData = { photoManagerAudios: audio, photoManagerVideos: video };
    const events = [];
    const notices = [];
    const store = {
        activeData,
        data: { currentDepartmentId: 'dept-a' },
        save(options) { events.push(['save', options]); return save?.() || Promise.resolve(); },
        deleteMediaBlob(key) { events.push(['media', key]); return removeMedia?.(key) ?? Promise.resolve(true); }
    };
    const context = vm.createContext({ MaintenanceApp, store, confirm: () => true, console: { error() {}, warn() {} } });
    vm.runInContext(source, context, { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    app.getPhotoManagerAudios = () => activeData.photoManagerAudios;
    app.getPhotoManagerAudio = id => activeData.photoManagerAudios.find(item => item.id === id) || null;
    app.getPhotoManagerAudioUsageCount = () => 0;
    app.getPhotoManagerVideos = () => activeData.photoManagerVideos;
    app.getPhotoManagerVideo = id => activeData.photoManagerVideos.find(item => item.id === id) || null;
    app.showPhotoManagerNotice = text => notices.push(text);
    app.openPhotoManagerAudios = () => events.push(['show', 'audio']);
    app.openPhotoManagerVideos = () => events.push(['show', 'video']);
    return { app, activeData, events, notices, store };
}

test('audio Blob is removed only after its catalog save completes', async () => {
    let finishSave;
    const original = [{ id: 'audio-1', mediaKey: 'audio:key', name: '点検音声' }];
    const h = makeHarness({ audio: original, save: () => new Promise(resolve => { finishSave = resolve; }) });
    const operation = h.app.deletePhotoManagerAudio('audio-1');
    assert.equal(h.activeData.photoManagerAudios.length, 0);
    assert.deepEqual(h.events.map(entry => entry[0]), ['save']);
    assert.equal(h.events[0][1].discardQueuedOnFailure, true);
    finishSave();
    await operation;
    assert.deepEqual(h.events.map(entry => entry[0]), ['save', 'media', 'show']);
    assert.equal(h.events[1][1], 'audio:key');
});

test('audio catalog is restored and Blob kept when save fails', async () => {
    const original = [{ id: 'audio-1', mediaKey: 'audio:key', name: '点検音声' }];
    const h = makeHarness({ audio: original, save: () => Promise.reject(new Error('容量不足')) });
    assert.equal(await h.app.deletePhotoManagerAudio('audio-1'), false);
    assert.equal(h.activeData.photoManagerAudios, original);
    assert.deepEqual(h.events.map(entry => entry[0]), ['save']);
    assert.match(h.notices[0], /容量不足/);
});

test('video catalog is restored and Blob kept when save fails', async () => {
    const original = [{ id: 'video-1', name: '設備動画' }];
    const h = makeHarness({ video: original, save: () => Promise.reject(new Error('保存不可')) });
    assert.equal(await h.app.deletePhotoManagerVideo('video-1'), false);
    assert.equal(h.activeData.photoManagerVideos, original);
    assert.deepEqual(h.events.map(entry => entry[0]), ['save']);
    assert.match(h.notices[0], /保存不可/);
});

test('video catalog remains deleted if later Blob cleanup fails', async () => {
    const h = makeHarness({
        video: [{ id: 'video-1', name: '設備動画' }],
        removeMedia: () => Promise.reject(new Error('IndexedDB unavailable'))
    });
    assert.equal(await h.app.deletePhotoManagerVideo('video-1'), true);
    assert.equal(h.activeData.photoManagerVideos.length, 0);
    assert.deepEqual(h.events.map(entry => entry[0]), ['save', 'media', 'show']);
    assert.equal(h.events[1][1], 'video:dept-a:video-1');
    assert.match(h.notices[0], /保存容量が残る/);
});

test('deleting a URL video does not touch local media storage', async () => {
    const h = makeHarness({ video: [{ id: 'video-1', name: '案内動画', sourceType: 'youtube' }] });
    assert.equal(await h.app.deletePhotoManagerVideo('video-1'), true);
    assert.deepEqual(h.events.map(entry => entry[0]), ['save', 'show']);
});

test('video cleanup keeps the original department key across an awaited save', async () => {
    let finishSave;
    const h = makeHarness({
        video: [{ id: 'video-1', name: '設備動画' }],
        save: () => new Promise(resolve => { finishSave = resolve; })
    });
    const operation = h.app.deletePhotoManagerVideo('video-1');
    h.store.data.currentDepartmentId = 'dept-b';
    finishSave();
    await operation;
    assert.equal(h.events.find(entry => entry[0] === 'media')[1], 'video:dept-a:video-1');
});

test('same-kind deletions cannot race while one save is pending', async () => {
    let finishSave;
    const h = makeHarness({
        audio: [
            { id: 'audio-1', mediaKey: 'audio:first', name: '一つ目' },
            { id: 'audio-2', mediaKey: 'audio:second', name: '二つ目' }
        ],
        save: () => new Promise(resolve => { finishSave = resolve; })
    });
    const first = h.app.deletePhotoManagerAudio('audio-1');
    assert.equal(await h.app.deletePhotoManagerAudio('audio-2'), false);
    finishSave();
    await first;
    assert.deepEqual(h.activeData.photoManagerAudios.map(item => item.id), ['audio-2']);
    assert.equal(h.events.filter(entry => entry[0] === 'save').length, 1);
});
