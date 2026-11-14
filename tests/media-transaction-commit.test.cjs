'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');

function makeStore() {
    const context = vm.createContext({
        window: { dispatchEvent() {} }, Blob,
        console: { error() {}, warn() {} }
    });
    vm.runInContext(`${source}\nglobalThis.StoreClass = MaintenanceStore;`, context);
    const store = new context.StoreClass();
    let transaction;
    let request;
    store.db = {
        transaction(name, mode) {
            assert.equal(name, 'media');
            assert.equal(mode, 'readwrite');
            request = {};
            transaction = {
                objectStore() {
                    return { put() { return request; }, delete() { return request; } };
                }
            };
            return transaction;
        }
    };
    return { store, get transaction() { return transaction; }, get request() { return request; } };
}

const operations = [
    ['blob save', store => store.saveMediaBlob('audio:1', new Blob(['sound'], { type: 'audio/wav' }))],
    ['file handle save', store => store.saveMediaFileHandle('video:1', { kind: 'file', name: 'movie.mp4' })],
    ['blob delete', store => store.deleteMediaBlob('audio:1')]
];

for (const [label, operation] of operations) {
    test(`${label} stays pending until the IndexedDB transaction completes`, async () => {
        const page = makeStore();
        let settled = false;
        const pending = operation(page.store).finally(() => { settled = true; });
        page.request.onsuccess?.();
        await Promise.resolve();
        assert.equal(settled, false);
        page.transaction.oncomplete();
        assert.equal(await pending, true);
        assert.equal(settled, true);
    });

    test(`${label} rejects a transaction abort after the request succeeds`, async () => {
        const page = makeStore();
        const pending = operation(page.store);
        page.request.onsuccess?.();
        page.transaction.error = new Error('late abort');
        page.transaction.onabort();
        await assert.rejects(pending, /late abort/);
    });
}
