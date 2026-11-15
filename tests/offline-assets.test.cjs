'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const workerSource = read('service-worker.js');

function localPath(reference) {
    const url = new URL(reference, 'https://example.test/mente/');
    assert.equal(url.origin, 'https://example.test');
    assert.ok(url.pathname.startsWith('/mente/'));
    return decodeURIComponent(url.pathname.slice('/mente/'.length)) || 'index.html';
}

test('every startup script, stylesheet and referenced font is bundled locally', () => {
    const startup = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
        .map(match => match[1]);
    assert.ok(startup.length > 30);
    for (const reference of startup) {
        assert.ok(fs.existsSync(path.join(root, localPath(reference))), `Missing ${reference}`);
    }
    for (const packageName of ['inter', 'noto-sans-jp']) {
        const cssPath = `assets/vendor/fontsource/${packageName}/5.2.6/index.css`;
        const css = read(cssPath);
        const fontFiles = [...css.matchAll(/url\(\.\/files\/([^\)]+)\)/g)].map(match => match[1]);
        assert.ok(fontFiles.length >= 7);
        for (const font of fontFiles) {
            assert.ok(fs.existsSync(path.join(root, path.dirname(cssPath), 'files', font)), `Missing ${font}`);
        }
    }
});

test('all runtime codecs, OCR dictionaries and transcription modules use local files', () => {
    for (const name of ['index.html', 'app-photo-manager.js', 'app-shift-notebook-core.js', 'audio-transcriber-worker.js']) {
        assert.doesNotMatch(read(name), /https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com)/);
    }
    for (const reference of [
        'assets/vendor/ffmpeg/0.11.6/046d0074eee1d99a674a.js',
        'assets/vendor/ffmpeg-core-st/0.11.1/ffmpeg-core.js',
        'assets/vendor/ffmpeg-core-st/0.11.1/ffmpeg-core.wasm',
        'assets/vendor/transformers/3.8.1/transformers.web.min.js',
        'assets/vendor/transformers/3.8.1/ort-wasm-simd-threaded.jsep.mjs',
        'assets/vendor/transformers/3.8.1/ort-wasm-simd-threaded.jsep.wasm'
    ]) assert.ok(fs.existsSync(path.join(root, reference)), `Missing ${reference}`);
    const dict = path.join(root, 'assets/vendor/kuromoji/0.1.2/dict');
    assert.equal(fs.readdirSync(dict).filter(name => name.endsWith('.dat.gz')).length, 12);
});

test('service worker pre-caches every startup script and stylesheet', () => {
    const list = workerSource.match(/const SHELL_FILES = (\[[\s\S]*?\]);/);
    assert.ok(list);
    const files = vm.runInNewContext(list[1]);
    const startup = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
        .map(match => match[1]);
    for (const reference of startup) assert.ok(files.includes(`./${reference}`), `Not precached: ${reference}`);
    for (const reference of files) {
        assert.ok(fs.existsSync(path.join(root, localPath(reference))), `Missing shell file ${reference}`);
    }
    assert.match(read('app-boot.js'), /serviceWorker\.register\('\.\/service-worker\.js'/);
});

test('service worker pre-caches every lazy photo and notebook script', () => {
    const list = workerSource.match(/const SHELL_FILES = (\[[\s\S]*?\]);/);
    const sources = read('app-boot.js').match(/const featureSources = (\{[\s\S]*?\});/);
    assert.ok(list && sources);
    const files = vm.runInNewContext(list[1]);
    const features = vm.runInNewContext(`(${sources[1]})`);
    for (const [name, reference] of Object.entries(features)) {
        assert.ok(files.includes(`./${reference}`), `Lazy feature is not precached: ${name}`);
    }
});

test('service worker waits for consent to activate and protects another open tab', async () => {
    const listeners = {};
    let skipCount = 0;
    let windowCount = 2;
    let sent;
    const context = vm.createContext({
        self: {
            registration: { scope: 'https://example.test/mente/' },
            clients: { matchAll: async () => Array.from({ length: windowCount }, () => ({})) },
            skipWaiting: async () => { skipCount++; },
            addEventListener(type, listener) { listeners[type] = listener; }
        },
        caches: { open: async () => ({ addAll: async () => {} }) },
        Request, Response, URL
    });
    vm.runInContext(workerSource, context, { filename: 'service-worker.js' });
    let pending;
    listeners.install({ waitUntil(value) { pending = value; } });
    await pending;
    assert.equal(skipCount, 0, 'install must not activate over an existing page');

    listeners.message({
        data: { type: 'MAINTENANCE_ACTIVATE_UPDATE' },
        source: { postMessage(value) { sent = value; } },
        waitUntil(value) { pending = value; }
    });
    await pending;
    assert.equal(skipCount, 0);
    assert.equal(sent.type, 'MAINTENANCE_UPDATE_OTHER_TABS');

    windowCount = 1;
    listeners.message({
        data: { type: 'MAINTENANCE_ACTIVATE_UPDATE' },
        waitUntil(value) { pending = value; }
    });
    await pending;
    assert.equal(skipCount, 1);
    assert.match(read('app-boot.js'), /waitForSaveQueueIdle/);
    assert.match(read('app-boot.js'), /controllerchange/);
});

test('service worker reports other open app tabs before image garbage collection', async () => {
    const listeners = {};
    const replies = [];
    const context = vm.createContext({
        self: {
            registration: { scope: 'https://example.test/mente/' },
            clients: { matchAll: async () => [{ id: 'current' }, { id: 'other' }] },
            addEventListener(type, listener) { listeners[type] = listener; }
        },
        caches: {}, Request, Response, URL
    });
    vm.runInContext(workerSource, context, { filename: 'service-worker.js' });
    let pending;
    listeners.message({
        data: { type: 'maintenance-image-gc-clients-v1' },
        source: { id: 'current' },
        ports: [{ postMessage(value) { replies.push(value); } }],
        waitUntil(value) { pending = value; }
    });
    await pending;
    assert.deepEqual(JSON.parse(JSON.stringify(replies[0])), {
        type: 'maintenance-image-gc-clients-v1', sourceFound: true, otherCount: 1
    });
});

test('versioned lazy scripts come from a prior cache before the network', async () => {
    const listeners = {};
    let fetchCount = 0;
    const oldCode = new Response('matching old code');
    const context = vm.createContext({
        self: {
            registration: { scope: 'https://example.test/mente/' },
            addEventListener(type, listener) { listeners[type] = listener; }
        },
        caches: {
            open: async () => ({ match: async () => null }),
            match: async request => request.url.includes('app-photo-manager.js') ? oldCode : null
        },
        fetch: async () => { fetchCount++; return new Response('new code'); },
        Request, Response, URL
    });
    vm.runInContext(workerSource, context, { filename: 'service-worker.js' });
    let response;
    const request = new Request('https://example.test/mente/app-photo-manager.js?v=old-version');
    listeners.fetch({ request, respondWith(value) { response = value; }, waitUntil() {} });
    assert.equal(await (await response).text(), 'matching old code');
    assert.equal(fetchCount, 0);
});

test('activation keeps one earlier shell for already open pages', async () => {
    const listeners = {};
    const deleted = [];
    const context = vm.createContext({
        self: {
            registration: { scope: 'https://example.test/mente/' },
            clients: { claim: async () => {} },
            addEventListener(type, listener) { listeners[type] = listener; }
        },
        caches: {
            keys: async () => [
                'maintenance-next-static-20261113-old',
                'maintenance-next-static-20261115-five1',
                'maintenance-next-static-20261115-save-shape1'
            ],
            delete: async key => { deleted.push(key); }
        },
        Request, Response, URL
    });
    vm.runInContext(workerSource, context, { filename: 'service-worker.js' });
    let pending;
    listeners.activate({ waitUntil(value) { pending = value; } });
    await pending;
    assert.deepEqual(deleted, ['maintenance-next-static-20261113-old']);
});

test('service worker serves a cached script offline and ignores user JSON', async () => {
    const listeners = {};
    const scope = 'https://example.test/mente/';
    const records = new Map();
    const cache = {
        match: async request => records.get(String(request.url || request)) || null,
        put: async (request, response) => records.set(request.url, response)
    };
    const context = vm.createContext({
        self: {
            registration: { scope },
            addEventListener(type, listener) { listeners[type] = listener; }
        },
        caches: { open: async () => cache },
        fetch: async () => { throw new Error('offline'); },
        Request, Response, URL
    });
    vm.runInContext(workerSource, context, { filename: 'service-worker.js' });

    const script = new Request(`${scope}store.js?v=20261114-save12`);
    records.set(script.url, new Response('cached script'));
    let result;
    listeners.fetch({ request: script, respondWith(promise) { result = promise; }, waitUntil() {} });
    assert.equal(await (await result).text(), 'cached script');

    let intercepted = false;
    const json = new Request(`${scope}latest.json`);
    listeners.fetch({ request: json, respondWith() { intercepted = true; }, waitUntil() {} });
    assert.equal(intercepted, false);
});
