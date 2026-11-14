'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const key = 'factory_maintenance_next_data_v2';
const image = 'data:image/png;base64,AQID';

function makePage({ state = null, local = null } = {}) {
    const stateEntries = new Map(state ? [[key, state]] : []);
    const mediaEntries = new Map();
    const localEntries = new Map(local ? [[key, JSON.stringify(local)]] : []);
    let failWrites = 0;
    let mediaAvailable = true;
    let mediaWrites = 0;
    const stateWrites = [];
    const transactionStores = [];
    const db = {
        objectStoreNames: { contains(name) { return name === 'state' || (name === 'media' && mediaAvailable); } },
        close() {},
        transaction(storeNames, mode) {
            transactionStores.push(storeNames);
            const operations = [];
            const transaction = {
                objectStore(name) {
                    assert.ok(['state', 'media'].includes(name));
                    return {
                        get(itemKey) {
                            const request = {};
                            operations.push({ type: 'get', name, key: itemKey, request });
                            schedule();
                            return request;
                        },
                        put(value, itemKey) {
                            const request = {};
                            operations.push({ type: 'put', name, key: itemKey, value, request });
                            schedule();
                            return request;
                        }
                    };
                }
            };
            let scheduled = false;
            function schedule() {
                if (scheduled) return;
                scheduled = true;
                queueMicrotask(() => {
                    const writes = operations.filter(operation => operation.type === 'put');
                    if (writes.length && failWrites > 0) {
                        failWrites--;
                        transaction.error = new Error('quota full');
                        transaction.onabort?.();
                        return;
                    }
                    for (const operation of operations) {
                        if (operation.type !== 'get') continue;
                        operation.request.result = (operation.name === 'state' ? stateEntries : mediaEntries).get(operation.key);
                        operation.request.onsuccess?.();
                    }
                    for (const operation of writes) {
                        (operation.name === 'state' ? stateEntries : mediaEntries).set(operation.key, operation.value);
                        if (operation.name === 'state' && operation.key === key) stateWrites.push(operation.value);
                        if (operation.name === 'media') mediaWrites++;
                        operation.request.onsuccess?.();
                    }
                    transaction.oncomplete?.();
                });
            }
            return transaction;
        }
    };
    const indexedDB = {
        open() {
            const request = {};
            queueMicrotask(() => request.onsuccess?.({ target: { result: db } }));
            return request;
        }
    };
    class FileReader {
        readAsDataURL(blob) {
            blob.arrayBuffer().then(bytes => {
                this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
                this.onload?.();
            }, error => { this.error = error; this.onerror?.(); });
        }
    }
    function newStore() {
        const window = { dispatchEvent() {} };
        const context = vm.createContext({
            window, indexedDB, Blob, FileReader, crypto: webcrypto, TextEncoder, atob, btoa, structuredClone,
            localStorage: {
                getItem(itemKey) { return localEntries.get(itemKey) ?? null; },
                setItem(itemKey, value) { localEntries.set(itemKey, String(value)); },
                removeItem(itemKey) { localEntries.delete(itemKey); }
            },
            sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
            CustomEvent: class {},
            console: { error() {}, warn() {} }
        });
        vm.runInContext(source, context, { filename: 'store.js' });
        return window.store;
    }
    return {
        newStore, stateEntries, stateWrites, mediaEntries, localEntries, transactionStores,
        get mediaWrites() { return mediaWrites; },
        failNextWrite(count = 1) { failWrites += count; },
        setMediaStoreAvailable(value) { mediaAvailable = value; }
    };
}

test('first IndexedDB save moves duplicate images to one Blob and keeps runtime URLs', async () => {
    const page = makePage();
    const store = page.newStore();
    // init supplies the same in-memory IndexedDB instance as a normal browser boot.
    await store.init();
    store.activeData.photoManagerLibrary = [{ id: 'one', src: image }, { id: 'two', src: image }];
    await store.save();

    const persisted = page.stateEntries.get(key);
    const [one, two] = persisted.deptData.dept_default.photoManagerLibrary;
    assert.match(one.src, /^maintenance-idb-image:\/\/image:/);
    assert.equal(two.src, one.src);
    assert.equal(page.mediaEntries.size, 1);
    assert.equal(page.mediaWrites, 1);
    assert.equal(store.activeData.photoManagerLibrary[0].src, image);
    assert.ok(page.transactionStores.some(names => Array.isArray(names) && names.includes('media')));

    store.activeData.machines.push({ id: 'machine-1' });
    await store.save();
    assert.equal(page.mediaWrites, 1);
    assert.equal(page.stateEntries.get(key).deptData.dept_default.machines.length, 1);

    store.activeData.photoManagerLibrary = [];
    await store.save();
    assert.equal(store._durableImageRefBySource.size, 0);
    assert.equal(page.mediaEntries.size, 1); // Cleanup is deliberately deferred.
});

test('restart hydrates durable refs and exported data remains inline-compatible', async () => {
    const page = makePage();
    const first = page.newStore();
    await first.init();
    first.activeData.photoManagerLibrary = [{ id: 'one', src: image }];
    await first.save();

    const reopened = page.newStore();
    await reopened.init();
    assert.equal(reopened.activeData.photoManagerLibrary[0].src, image);
    const backup = reopened.createOptimizedExport(reopened.data);
    assert.match(JSON.stringify(backup), /AQID/);
    reopened.activeData.machines.push({ id: 'after-reload' });
    await reopened.save();
    assert.equal(page.mediaWrites, 1);
});

test('noncanonical image Data URLs preserve photo IDs across reload', async () => {
    const page = makePage();
    const first = page.newStore();
    await first.init();
    const unusual = 'data:IMAGE/PNG;base64,AQID';
    first.activeData.photoManagerLibrary = [{ id: 'one', src: unusual }];
    await first.save();
    assert.equal([...page.mediaEntries.values()][0].encoding, 'data-url');

    const reopened = page.newStore();
    await reopened.init();
    assert.equal(reopened.activeData.photoManagerLibrary[0].src, unusual);
});

test('image migration advances in bounded batches over later saves', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.activeData.photoManagerLibrary = Array.from({ length: 31 }, (_, index) => ({
        id: String(index), src: `data:image/png;base64,${Buffer.from([index]).toString('base64')}`
    }));
    await store.save();
    assert.equal(page.mediaEntries.size, 30);
    assert.match(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary[30].src, /^data:image/);
    await store.save();
    assert.equal(page.mediaEntries.size, 31);
    assert.match(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary[30].src,
        /^maintenance-idb-image:\/\//);
});

test('image migration also observes the per-save byte budget', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.estimateDataUrlBytes = () => 15 * 1024 * 1024;
    store.activeData.photoManagerLibrary = [
        { id: 'one', src: image }, { id: 'two', src: 'data:image/png;base64,BAUG' }
    ];
    await store.save();
    assert.equal(page.mediaEntries.size, 1);
    await store.save();
    assert.equal(page.mediaEntries.size, 2);
});

test('Blob quota failure retries the untouched inline state before reporting success', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.activeData.photoManagerLibrary = [{ id: 'one', src: image }];
    page.failNextWrite();
    await store.save();
    assert.equal(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary[0].src, image);
    assert.equal(page.mediaEntries.size, 0);
    assert.match(store.storageWarning.message, /従来形式で保存/);
    assert.equal(store.activeData.photoManagerLibrary[0].src, image);
});

test('Blob quota retry keeps previously migrated images as references', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.activeData.photoManagerLibrary = [{ id: 'old', src: image }];
    await store.save();
    store.activeData.photoManagerLibrary.push({ id: 'new', src: 'data:image/png;base64,BAUG' });
    page.failNextWrite();
    await store.save();

    const [oldPhoto, newPhoto] = page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary;
    assert.match(oldPhoto.src, /^maintenance-idb-image:\/\//);
    assert.match(newPhoto.src, /^data:image/);
    assert.equal(page.mediaEntries.size, 1);
});

test('malformed image data remains inline without blocking another edit', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.activeData.photoManagerLibrary = [
        { id: 'broken', src: 'data:image/png;base64,!!!' },
        { id: 'valid', src: image }
    ];
    store.activeData.machines.push({ id: 'edited' });
    await store.save();
    const saved = page.stateEntries.get(key).deptData.dept_default;
    assert.equal(saved.photoManagerLibrary[0].src, 'data:image/png;base64,!!!');
    assert.match(saved.photoManagerLibrary[1].src, /^maintenance-idb-image:\/\//);
    assert.equal(saved.machines[0].id, 'edited');
    assert.match(store.storageWarning.message, /形式が正しくない画像/);
});

test('queued image saves retain their own revision snapshots', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.activeData.photoManagerLibrary = [{ id: 'first', src: image }];
    const first = store.save();
    store.activeData.photoManagerLibrary.push({ id: 'second', src: 'data:image/png;base64,BAUG' });
    const second = store.save();
    await Promise.all([first, second]);

    assert.equal(page.stateWrites.length, 2);
    assert.equal(page.stateWrites[0].deptData.dept_default.photoManagerLibrary.length, 1);
    assert.equal(page.stateWrites[1].deptData.dept_default.photoManagerLibrary.length, 2);
});

test('failed image transaction leaves previous state and media unchanged', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    store.activeData.machines.push({ id: 'kept' });
    await store.save();
    store.activeData.photoManagerLibrary = [{ id: 'one', src: image }];
    page.failNextWrite(2);
    await assert.rejects(store.save(), /quota full/);
    assert.equal(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary, undefined);
    assert.equal(page.mediaEntries.size, 0);
    assert.equal(store.activeData.photoManagerLibrary[0].src, image);
});

test('missing image Blob uses a valid alternate candidate with an explicit warning', async () => {
    const page = makePage();
    const first = page.newStore();
    await first.init();
    first.activeData.photoManagerLibrary = [{ id: 'idb', src: image }];
    await first.save();
    const fallback = structuredClone(first.data);
    fallback.deptData.dept_default.photoManagerLibrary = [{ id: 'local', src: image }];
    fallback.settings.lastSuccessfulSaveAt = '2020-01-01T00:00:00.000Z';
    page.localEntries.set(key, JSON.stringify(fallback));
    page.mediaEntries.clear();

    const reopened = page.newStore();
    await reopened.init();
    assert.equal(reopened.startupStateSource, 'localStorage');
    assert.equal(reopened.activeData.photoManagerLibrary[0].id, 'local');
    assert.match(reopened.storageWarning.message, /画像本体/);
    assert.match(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary[0].src,
        /^maintenance-idb-image:\/\//);
});

test('localStorage candidate with refs is used only after its image Blob hydrates', async () => {
    const page = makePage();
    const first = page.newStore();
    await first.init();
    first.activeData.photoManagerLibrary = [{ id: 'local', src: image }];
    await first.save();
    const local = structuredClone(page.stateEntries.get(key));
    local.settings.lastSuccessfulSaveAt = '2030-01-01T00:00:00.000Z';
    page.localEntries.set(key, JSON.stringify(local));

    const reopened = page.newStore();
    await reopened.init();
    assert.equal(reopened.startupStateSource, 'localStorage');
    assert.equal(reopened.activeData.photoManagerLibrary[0].src, image);
    assert.equal(reopened.unresolvedDurableImageReferences.length, 0);

    const inlineIndexed = structuredClone(page.stateEntries.get(key));
    inlineIndexed.deptData.dept_default.photoManagerLibrary[0].src = image;
    page.stateEntries.set(key, inlineIndexed);
    page.mediaEntries.clear();
    const fallback = page.newStore();
    await fallback.init();
    assert.equal(fallback.startupStateSource, 'indexeddb');
    assert.match(fallback.storageWarning.message, /画像本体/);
});

test('missing image Blob without an alternate keeps records and reports the error', async () => {
    const page = makePage();
    const first = page.newStore();
    await first.init();
    first.activeData.photoManagerLibrary = [{ id: 'kept', src: image }];
    await first.save();
    page.mediaEntries.clear();

    const reopened = page.newStore();
    await reopened.init();
    assert.equal(reopened.startupStateSource, 'indexeddb');
    assert.equal(reopened.activeData.photoManagerLibrary[0].id, 'kept');
    assert.match(reopened.storageWarning.message, /画像本体/);
    assert.equal(reopened.startupSaveSafe, false);
    assert.equal(reopened.unresolvedDurableImageReferences.length, 1);
    assert.throws(() => reopened.exportAsJSON(), /未復元/);
    assert.throws(() => reopened.exportCurrentDeptAsJSON(), /未復元/);
    await reopened.save();
    assert.equal(reopened.startupSaveSafe, false);
    assert.match(reopened.storageWarning.message, /画像本体/);
    assert.equal(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary[0].id, 'kept');
});

test('database without a media store writes images inline', async () => {
    const page = makePage();
    page.setMediaStoreAvailable(false);
    const store = page.newStore();
    await store.init();
    store.activeData.photoManagerLibrary = [{ id: 'one', src: image }];
    await store.save();
    assert.equal(page.stateEntries.get(key).deptData.dept_default.photoManagerLibrary[0].src, image);
    assert.equal(page.mediaEntries.size, 0);
    assert.match(store.storageWarning.message, /別保存領域/);
});

test('localStorage fallback keeps image data inline', async () => {
    const page = makePage();
    const store = page.newStore();
    store.saveTarget = 'localStorage';
    store.activeData.photoManagerLibrary = [{ id: 'one', src: image }];
    await store.save();
    assert.equal(JSON.parse(page.localEntries.get(key)).deptData.dept_default.photoManagerLibrary[0].src, image);
    assert.equal(page.mediaEntries.size, 0);
});

test('external JSON with internal image references is rejected before replacing data', async () => {
    const page = makePage();
    const store = page.newStore();
    await store.init();
    const before = store.data;
    const candidate = structuredClone(before);
    candidate.deptData.dept_default.photoManagerLibrary = [
        { id: 'bad', src: 'maintenance-idb-image://image:missing' }
    ];
    await assert.rejects(store.commitImportedState(candidate), /画像の内部参照/);
    assert.equal(store.data, before);
    assert.equal(page.stateEntries.has(key), false);
});
