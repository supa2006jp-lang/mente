'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function makeApp(hydrate) {
    const alerts = [];
    const links = [];
    let blob;
    const original = { photo: 'maintenance-idb-image://image:missing', machines: [{ id: 'kept' }] };
    const store = {
        _malformedPrimary: { indexeddb: { data: original, raw: null } },
        hydrateDurableImageReferences: hydrate
    };
    const document = {
        body: { appendChild(link) { links.push(link); } },
        createElement() { return { click() {}, remove() {} }; }
    };
    const context = vm.createContext({
        store, document, Blob, Date,
        URL: { createObjectURL(value) { blob = value; return 'blob:mock'; }, revokeObjectURL() {} },
        setTimeout() {}, alert: message => alerts.push(message), console: { warn() {} }
    });
    vm.runInContext(source, context, { filename: 'app.js' });
    const app = vm.runInContext('Object.create(MaintenanceApp.prototype)', context);
    return { app, original, alerts, links, get blob() { return blob; } };
}

test('malformed IndexedDB original includes image bodies when they can be restored', async () => {
    const h = makeApp(async data => ({ ...data, photo: 'data:image/png;base64,AQID' }));
    await h.app.downloadMalformedStoredOriginal('indexeddb');
    assert.equal(JSON.parse(await h.blob.text()).photo, 'data:image/png;base64,AQID');
    assert.doesNotMatch(h.links[0].download, /unresolved/);
    assert.equal(h.alerts.length, 0);
    assert.equal(h.original.photo, 'maintenance-idb-image://image:missing');
});

test('missing image bodies still allow an explicitly labeled raw original export', async () => {
    const h = makeApp(async () => { throw new Error('missing image'); });
    await h.app.downloadMalformedStoredOriginal('indexeddb');
    const downloaded = JSON.parse(await h.blob.text());
    assert.equal(downloaded.machines[0].id, 'kept');
    assert.equal(downloaded.photo, 'maintenance-idb-image://image:missing');
    assert.match(h.links[0].download, /image_refs_unresolved/);
    assert.match(h.alerts[0], /画像本体を含められなかった/);
});
