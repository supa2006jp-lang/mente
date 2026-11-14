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
