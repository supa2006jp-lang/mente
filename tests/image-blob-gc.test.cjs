'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const primaryKey = 'factory_maintenance_next_data_v2';
const ref = key => `maintenance-idb-image://${key}`;
const old = Date.now() - 31 * 86400000;
const recent = Date.now() - 2 * 86400000;
const entry = updatedAt => ({ blob: new Blob(['1234'], { type: 'image/png' }), size: 4, updatedAt });

function makeStore({ state = new Map(), media = new Map(), local = new Map() } = {}) {
    const transactionModes = [];
    const clients = { controllerAvailable: true, sourceFound: true, otherCount: 0, respond: true };
    const db = {
        objectStoreNames: { contains: name => name === 'state' || name === 'media' },
        transaction(names, mode) {
            transactionModes.push(mode);
            let aborted = false;
            let cursorsCompleted = 0;
            let pendingDeletes = 0;
            const transaction = {
                objectStore(name) {
                    const values = name === 'state' ? state : media;
                    return {
                        openCursor() {
                            const request = {};
                            const snapshot = [...values.entries()];
                            let index = 0;
                            const advance = () => queueMicrotask(() => {
                                if (aborted) return;
                                const pair = snapshot[index];
                                request.result = pair ? {
                                    key: pair[0],
                                    value: pair[1],
                                    continue() { index++; advance(); },
                                    delete() {
                                        const deleteRequest = {};
                                        pendingDeletes++;
                                        queueMicrotask(() => {
                                            values.delete(pair[0]);
                                            deleteRequest.onsuccess?.();
                                            pendingDeletes--;
                                            maybeComplete();
                                        });
                                        return deleteRequest;
                                    }
                                } : null;
                                if (!pair) cursorsCompleted++;
                                request.onsuccess?.();
                                maybeComplete();
                            });
                            advance();
                            return request;
                        }
                    };
                },
                abort() {
                    aborted = true;
                    queueMicrotask(() => transaction.onabort?.());
                }
            };
            const maybeComplete = () => {
                if (!aborted && cursorsCompleted === 2 && pendingDeletes === 0) {
                    queueMicrotask(() => transaction.oncomplete?.());
                }
            };
            return transaction;
        }
    };
    const localStorage = {
        get length() { return local.size; },
        key(index) { return [...local.keys()][index] || null; },
        getItem(key) { return local.get(key) ?? null; }
    };
    class MessageChannel {
        constructor() {
            this.port1 = { onmessage: null, close() {} };
            this.port2 = { receive: this.port1 };
        }
    }
    const controller = {
        postMessage(message, ports) {
            assert.equal(message.type, 'maintenance-image-gc-clients-v1');
            if (!clients.respond) return;
            queueMicrotask(() => ports[0].receive.onmessage?.({ data: {
                type: message.type,
                sourceFound: clients.sourceFound,
                otherCount: clients.otherCount
            } }));
        }
    };
    const navigator = { serviceWorker: { get controller() { return clients.controllerAvailable ? controller : null; } } };
    const context = vm.createContext({ window: {}, localStorage, Blob, console,
        MessageChannel, navigator, setTimeout, clearTimeout });
    vm.runInContext(source, context, { filename: 'store.js' });
    const store = context.window.store;
    store.db = db;
    return { store, state, media, local, transactionModes, clients };
}

test('dry run and sweep keep every referenced or recent image and leave other media untouched', async () => {
    const state = new Map([
        [primaryKey, { photo: ref('image:primary') }],
        [`${primaryKey}_invalid_original_old`, { photo: ref('image:backup') }]
    ]);
    const media = new Map([
        ['image:primary', entry(old)],
        ['image:backup', entry(old)],
        ['image:local', entry(old)],
        ['image:runtime', entry(old)],
        ['image:orphan', entry(old)],
        ['image:new', entry(recent)],
        ['image:undated', entry(0)],
        ['video:keep', entry(old)]
    ]);
    const local = new Map([[primaryKey, JSON.stringify({ photo: ref('image:local') })]]);
    const harness = makeStore({ state, media, local });
    harness.store.data = { photo: 'data:image/png;base64,AQID' };
    harness.store._durableImageRefBySource.set('data:image/png;base64,AQID', ref('image:runtime'));

    const preview = await harness.store.cleanupUnusedImageBlobs();
    assert.equal(preview.dryRun, true);
    assert.equal(preview.totalImages, 7);
    assert.equal(preview.unreferencedImages, 3);
    assert.equal(preview.eligibleImages, 1);
    assert.equal(preview.eligibleBytes, 4);
    assert.equal(preview.reclaimedImages, 0);
    assert.equal(preview.gracePeriodDays, 30);
    assert.equal(media.size, 8);

    const result = await harness.store.cleanupUnusedImageBlobs({ dryRun: false });
    assert.equal(result.reclaimedImages, 1);
    assert.equal(result.reclaimedBytes, 4);
    assert.equal(media.has('image:orphan'), false);
    for (const key of ['image:primary', 'image:backup', 'image:local', 'image:runtime',
        'image:new', 'image:undated', 'video:keep']) assert.equal(media.has(key), true, key);
    assert.deepEqual(harness.transactionModes, ['readonly', 'readwrite']);
});

test('malformed saved record with an uninspectable reference stops image cleanup', async () => {
    const harness = makeStore({
        state: new Map([[primaryKey, 'broken-prefix ' + ref('image:maybe')]]),
        media: new Map([['image:orphan', entry(old)]])
    });
    await assert.rejects(harness.store.cleanupUnusedImageBlobs({ dryRun: false }), /解析できない画像参照/);
    assert.equal(harness.media.has('image:orphan'), true);
});

test('cleanup waits for queued saves before scanning image references', async () => {
    const harness = makeStore({ media: new Map([['image:orphan', entry(old)]]) });
    harness.store._saveQueueRunning = true;
    const pending = harness.store.cleanupUnusedImageBlobs({ dryRun: false });
    await Promise.resolve();
    assert.equal(harness.transactionModes.length, 0);
    harness.store._saveQueueRunning = false;
    harness.store._saveIdleWaiters.splice(0).forEach(resolve => resolve());
    const result = await pending;
    assert.equal(result.reclaimedImages, 1);
});

test('another open app tab prevents deletion even when its old image is not in saved state', async () => {
    const harness = makeStore({ media: new Map([['image:old-tab-only', entry(old)]]) });
    harness.clients.otherCount = 1;
    await assert.rejects(harness.store.cleanupUnusedImageBlobs({ dryRun: false }), /別のタブ/);
    assert.equal(harness.media.has('image:old-tab-only'), true);
    assert.equal(harness.transactionModes.length, 0);
});

test('deletion is denied if the service worker cannot confirm tab ownership', async () => {
    const harness = makeStore({ media: new Map([['image:orphan', entry(old)]]) });
    harness.clients.controllerAvailable = false;
    const preview = await harness.store.cleanupUnusedImageBlobs();
    assert.equal(preview.eligibleImages, 1);
    await assert.rejects(harness.store.cleanupUnusedImageBlobs({ dryRun: false }), /他のタブを確認できません/);
    assert.equal(harness.media.has('image:orphan'), true);
});
