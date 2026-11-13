'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

class FakeElement {
    constructor(tag = 'div') {
        this.tag = tag;
        this.value = '';
        this.dataset = {};
        this.listeners = new Map();
        this.isConnected = false;
        this.controls = {};
    }
    set innerHTML(_html) {
        const make = tag => new FakeElement(tag);
        this.controls = {
            select: make('select'),
            '.shift-photo-compare-image-ocr-preview img': make('img'),
            textarea: make('textarea'),
            '.shift-photo-compare-image-ocr-status': make('status'),
            '[data-ocr-retry]': make('button'),
            '[data-ocr-read-as-is]': make('button'),
            '[data-ocr-read]': make('button'),
            '[data-ocr-stop]': make('button')
        };
        this.closeButtons = [make('button'), make('button')];
    }
    querySelector(selector) { return this.controls[selector] || null; }
    querySelectorAll(selector) { return selector === '[data-ocr-close]' ? this.closeButtons : []; }
    appendChild(child) { child.parent = this; child.isConnected = this.isConnected; return child; }
    addEventListener(type, handler) {
        const list = this.listeners.get(type) || [];
        list.push(handler);
        this.listeners.set(type, list);
    }
    dispatch(type, event = {}) {
        for (const handler of this.listeners.get(type) || []) handler(event);
    }
    focus() {}
    remove() { this.isConnected = false; }
}

function harness(readImage = async () => '画像に書かれた文字') {
    class MaintenanceApp {}
    let dialog = null;
    let editorOpen = true;
    const grid = { isConnected: true };
    const editor = { querySelector: () => grid };
    const body = new FakeElement('body');
    body.isConnected = true;
    body.appendChild = child => { dialog = child; child.isConnected = true; return child; };
    const document = {
        body,
        createElement: tag => new FakeElement(tag),
        getElementById(id) {
            if (id === 'shift-photo-compare-overlay') return editorOpen ? editor : null;
            if (id === 'shift-photo-compare-image-ocr-dialog') return dialog?.isConnected ? dialog : null;
            return null;
        }
    };
    const window = { setInterval: () => 1, clearInterval: () => {} };
    vm.runInNewContext(source, { MaintenanceApp, document, window, console }, { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    const spoken = [];
    app.getShiftPhotoCompareImageOcrSources = () => [{ src: 'data:image/png;base64,AAAA', label: '元写真 1' }];
    app.getPhotoManagerImageText = readImage;
    app.speakShiftPhotoCompareAnimationMarks = marks => { spoken.push(marks[0].dataset.text); return true; };
    app.cancelShiftPhotoCompareSpeech = () => {};
    app.showPhotoManagerNotice = () => {};
    return { app, spoken, get dialog() { return dialog; }, closeEditor() { editorOpen = false; grid.isConnected = false; } };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('recognized image text can be read unchanged or after optional editing', async () => {
    const h = harness();
    h.app.openShiftPhotoCompareImageOcrSpeechDialog();
    await flush();
    const original = h.dialog.querySelector('[data-ocr-read-as-is]');
    const edited = h.dialog.querySelector('[data-ocr-read]');
    const textarea = h.dialog.querySelector('textarea');
    assert.equal(textarea.value, '画像に書かれた文字');
    assert.equal(original.disabled, false);
    original.dispatch('click');
    assert.equal(h.spoken.at(-1), '画像に書かれた文字');

    textarea.value = '修正した読み方';
    textarea.dispatch('input');
    original.dispatch('click');
    edited.dispatch('click');
    assert.deepEqual(h.spoken, ['画像に書かれた文字', '画像に書かれた文字', '修正した読み方']);
    h.app.closeShiftPhotoCompareImageOcrSpeechDialog();
});

test('immediate image read speaks without opening the editing dialog', async () => {
    const readSources = [];
    const h = harness(async item => {
        readSources.push(item.src);
        return '画像に書かれた文字';
    });
    assert.equal(await h.app.readShiftPhotoCompareImageOcrImmediately(), true);
    assert.equal(h.dialog, null);
    assert.deepEqual(readSources, ['data:image/png;base64,AAAA']);
    assert.deepEqual(h.spoken, ['画像に書かれた文字']);

    assert.equal(await h.app.readShiftPhotoCompareImageOcrImmediately({
        src: 'data:image/png;base64,CROPPED', label: '選択範囲'
    }), true);
    assert.deepEqual(readSources, ['data:image/png;base64,AAAA', 'data:image/png;base64,CROPPED']);
    assert.deepEqual(h.spoken, ['画像に書かれた文字', '画像に書かれた文字']);
    assert.equal(h.dialog, null);
});

test('immediate read does not speak after the image editor closes during OCR', async () => {
    let finishRead;
    const h = harness(() => new Promise(resolve => { finishRead = resolve; }));
    const reading = h.app.readShiftPhotoCompareImageOcrImmediately();
    h.closeEditor();
    finishRead('遅れて届いた文字');
    assert.equal(await reading, false);
    assert.deepEqual(h.spoken, []);
});

test('immediate read ignores OCR from an image that is no longer selected', async () => {
    let finishRead;
    const h = harness(() => new Promise(resolve => { finishRead = resolve; }));
    let selected = 'data:image/png;base64,AAAA';
    h.app.getShiftPhotoCompareImageOcrSources = () => [
        { src: 'data:image/png;base64,AAAA', label: '画像 1', preferred: selected.endsWith('AAAA') },
        { src: 'data:image/png;base64,BBBB', label: '画像 2', preferred: selected.endsWith('BBBB') }
    ];
    const reading = h.app.readShiftPhotoCompareImageOcrImmediately();
    selected = 'data:image/png;base64,BBBB';
    finishRead('最初の画像の文字');
    assert.equal(await reading, false);
    assert.deepEqual(h.spoken, []);
});

test('late OCR result is ignored after closing the editor dialog', async () => {
    let finishRead;
    const h = harness(() => new Promise(resolve => { finishRead = resolve; }));
    h.app.openShiftPhotoCompareImageOcrSpeechDialog();
    const textarea = h.dialog.querySelector('textarea');
    h.closeEditor();
    h.app.closeShiftPhotoCompareImageOcrSpeechDialog();
    finishRead('遅れて届いた文字');
    await flush();
    assert.equal(textarea.value, '');
    assert.equal(h.dialog.isConnected, false);
    assert.deepEqual(h.spoken, []);
});

test('current animation page supplies raw base photo and image stamp sources', () => {
    const h = harness();
    delete h.app.getShiftPhotoCompareImageOcrSources;
    const base = {
        querySelector: () => ({ getAttribute: () => 'data:image/png;base64,BASE' }),
        closest: () => ({ querySelector: () => ({ textContent: '点検写真' }) })
    };
    const stamp = {
        dataset: { animationName: '注意表示' },
        title: '',
        classList: { contains: name => name === 'selected' },
        querySelector: () => ({ getAttribute: () => 'data:image/png;base64,STAMP' })
    };
    h.app._shiftPhotoCompareAnimationState = {
        overlay: { isConnected: true },
        grid: {
            querySelectorAll(selector) {
                if (selector === '.shift-photo-compare-item .shift-photo-compare-image-wrap') return [base];
                if (selector === '.shift-photo-compare-mark.image') return [stamp];
                return [];
            }
        }
    };
    const sources = h.app.getShiftPhotoCompareImageOcrSources();
    assert.deepEqual(Array.from(sources, item => item.src), [
        'data:image/png;base64,BASE',
        'data:image/png;base64,STAMP'
    ]);
    assert.equal(sources[1].preferred, true);
});

test('OCR engine load can be retried after a failed download', async () => {
    class MaintenanceApp {}
    const scripts = [];
    const window = {};
    const document = {
        createElement: () => ({ remove() {} }),
        head: { appendChild: script => scripts.push(script) }
    };
    vm.runInNewContext(source, { MaintenanceApp, document, window, console }, { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    const first = app.loadPhotoManagerTesseract();
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, 'assets/ocr/tesseract/tesseract.min.js');
    scripts[0].onerror();
    assert.equal(await first, null);
    const engine = { createWorker() {} };
    const second = app.loadPhotoManagerTesseract();
    assert.equal(scripts.length, 2);
    window.Tesseract = engine;
    scripts[1].onload();
    assert.equal(await second, engine);
});

test('OCR worker assets resolve to this app origin when hosted under a subpath', async () => {
    class MaintenanceApp {}
    const document = { baseURI: 'https://example.test/mente/index.html' };
    vm.runInNewContext(source, { MaintenanceApp, document, URL, console }, { filename: 'app-photo-manager.js' });
    const app = Object.create(MaintenanceApp.prototype);
    let creation = null;
    app.loadPhotoManagerTesseract = async () => ({
        createWorker: (...args) => { creation = args; return {}; }
    });
    await app.createPhotoManagerOcrWorker();
    assert.equal(creation[0], 'jpn+eng');
    assert.equal(creation[2].workerPath, 'https://example.test/mente/assets/ocr/tesseract/worker.min.js');
    assert.equal(creation[2].corePath, 'https://example.test/mente/assets/ocr/tesseract/core/');
    assert.equal(creation[2].langPath, 'https://example.test/mente/assets/ocr/tesseract/lang/');
    assert.equal(creation[2].workerBlobURL, false);
});
