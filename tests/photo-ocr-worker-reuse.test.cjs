'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

function harness(makeWorker) {
    class MaintenanceApp {}
    const timers = new Map();
    let nextTimer = 1;
    vm.runInNewContext(source, {
        MaintenanceApp,
        window: {},
        console: { warn() {} },
        setTimeout(callback, delay) {
            const id = nextTimer++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); }
    }, { filename: 'app-photo-manager.js' });
    const app = new MaintenanceApp();
    app.createPhotoManagerOcrImageSrc = async (_src, variant) => variant.name;
    app.createPhotoManagerOcrWorker = makeWorker;
    return { app, timers };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('OCR variants include both faint-text contrast and binary correction', () => {
    const { app } = harness(async () => null);
    const variants = Array.from(app.getPhotoManagerOcrVariants());
    assert.equal(variants[0].name, '元画像');
    assert.ok(variants.some(variant => variant.mode === 'contrast' && variant.name === '薄文字強調'));
    assert.ok(variants.some(variant => variant.mode === 'binary'));
    assert.equal(new Set(variants.map(variant => variant.name)).size, variants.length);
});

test('consecutive OCR requests share one worker and run recognition serially', async () => {
    let creations = 0;
    let parameters = 0;
    let recognitions = 0;
    let active = 0;
    let maxActive = 0;
    let finishFirst;
    const worker = {
        async setParameters() { parameters += 1; },
        async recognize() {
            recognitions += 1;
            active += 1;
            maxActive = Math.max(maxActive, active);
            if (recognitions === 1) await new Promise(resolve => { finishFirst = resolve; });
            active -= 1;
            return { data: { text: '安全第一', confidence: 95 } };
        },
        async terminate() {}
    };
    const { app, timers } = harness(async () => { creations += 1; return worker; });
    const first = app.readPhotoManagerImageTextWithTesseract({ src: 'first' });
    const second = app.readPhotoManagerImageTextWithTesseract({ src: 'second' });
    await flush();
    assert.equal(recognitions, 1);
    finishFirst();
    assert.deepEqual(await Promise.all([first, second]), ['安全第一', '安全第一']);
    assert.equal(creations, 1);
    assert.equal(parameters, 1);
    assert.equal(recognitions, 2);
    assert.equal(maxActive, 1);
    assert.equal(Array.from(timers.values())[0].delay, 60000);
});

test('idle worker is released and a failed worker is recreated on the next read', async () => {
    let creations = 0;
    let terminations = 0;
    const { app, timers } = harness(async () => {
        creations += 1;
        const fail = creations === 2;
        return {
            async setParameters() {},
            async recognize() {
                if (fail) throw new Error('worker stopped');
                return { data: { text: '点検済み', confidence: 94 } };
            },
            async terminate() { terminations += 1; }
        };
    });
    assert.equal(await app.readPhotoManagerImageTextWithTesseract({ src: 'first' }), '点検済み');
    const idle = Array.from(timers.values())[0].callback;
    idle();
    await flush();
    assert.equal(terminations, 1);
    assert.equal(await app.readPhotoManagerImageTextWithTesseract({ src: 'second' }), '');
    assert.equal(terminations, 2);
    assert.equal(await app.readPhotoManagerImageTextWithTesseract({ src: 'third' }), '点検済み');
    assert.equal(creations, 3);
});
