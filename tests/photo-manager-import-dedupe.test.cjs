'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

function photoManagerHarness({ failSave = false, deferSave = false } = {}) {
    const library = [];
    const otherSources = [];
    const choices = new Map();
    const notices = [];
    let nextId = 0;
    let saveCount = 0;
    let startSaving;
    let releaseSave;
    const savingStarted = new Promise(resolve => { startSaving = resolve; });
    const saveGate = new Promise(resolve => { releaseSave = resolve; });
    class MaintenanceApp {}
    const store = {
        activeData: { photoManagerLibrary: library, photoManagerTags: {} },
        save() { saveCount += 1; },
        async runAtomicSaveBatch(mutate) {
            const before = library.slice();
            mutate();
            startSaving();
            try {
                if (deferSave) await saveGate;
                if (failSave) throw new Error('quota full');
                saveCount += 1;
            } catch (error) {
                library.splice(0, library.length, ...before);
                throw error;
            }
        }
    };
    const document = {
        getElementById() { return null; },
        querySelector(selector) {
            const id = selector.match(/data-image-choice-id="([^"]+)"/)?.[1];
            return id ? choices.get(id) || null : null;
        },
        querySelectorAll(selector) {
            assert.equal(selector, '#image-source-choice-list input:checked');
            return Array.from(choices.values()).filter(choice => choice.checked);
        }
    };
    const context = vm.createContext({
        MaintenanceApp, store, document, window: {},
        navigator: { clipboard: { async read() { return [{ types: ['image/png'], async getType() { return imageFile(); } }]; } } },
        requestAnimationFrame(callback) { callback(); },
        console: { ...console, error() {} }
    });
    vm.runInContext(source, context, { filename: 'app-photo-manager.js' });

    const app = Object.create(MaintenanceApp.prototype);
    app.getPhotoManagerLibrary = () => library;
    app.createPhotoManagerLibraryId = () => `library-${++nextId}`;
    app.getPhotoManagerToday = () => '2026-10-30';
    app.readPhotoManagerFileAsDataUrl = async file => file.src;
    app.preparePhotoManagerNormalSaveSource = async src => ({ src, compressed: false, transparent: false });
    app.detectAndRememberPhotoManagerTransparency = async () => false;
    app.imageHasTransparentPixels = async () => false;
    app.rememberPhotoManagerTransparentSource = () => {};
    app.rememberPhotoManagerCompressedSource = () => {};
    app.summarizePhotoManagerNormalSaveResults = () => '';
    app.getPhotoManagerName = item => item.name || item.defaultName || '';
    app.collectPhotoManagerItems = () => [
        ...library.map(item => ({ ...item, source: 'library' })),
        ...otherSources
    ];
    app.rememberImageSourceChoiceUse = () => {};
    app.renderPhotoManager = () => {};
    app.updateImageSourceChoicePreview = () => {};
    app.openImageSourceChoiceTransparencyPreview = () => {};
    app.showPhotoManagerNotice = message => notices.push(message);
    app.openImageSourceChoice = input => {
        app._imageSourceChoiceInput = input;
        choices.clear();
        app.collectPhotoManagerItems().forEach(item => {
            choices.set(item.id, { value: item.id, checked: false });
        });
    };
    app.closeImageSourceChoice = () => { app._imageSourceChoiceInput = null; };

    return {
        app, library, otherSources, choices, notices,
        get saveCount() { return saveCount; },
        savingStarted,
        releaseSave
    };
}

const imageFile = (src = 'data:image/png;base64,AAAA') => ({
    type: 'image/png', name: 'photo.png', src
});

test('direct file import followed by Use selection keeps one library image', async () => {
    const h = photoManagerHarness();
    const input = { id: 'photo-manager-import-input', value: 'selected' };

    await h.app.importImageSourceDirectFilesForReview(input, [imageFile()]);
    assert.equal(h.library.length, 1);
    assert.equal(h.choices.get(h.library[0].id).checked, true);

    await h.app.applySelectedImageSourceChoice();
    assert.equal(h.library.length, 1);
    assert.equal(h.saveCount, 1);
});

test('importing the same image content again does not add another library image', async () => {
    const h = photoManagerHarness();
    const input = { id: 'photo-manager-import-input', value: 'selected' };

    await h.app.importImageSourceDirectFilesForReview(input, [imageFile()]);
    const originalId = h.library[0].id;
    await h.app.importImageSourceDirectFilesForReview(input, [imageFile()]);
    assert.equal(h.library.length, 1);
    assert.equal(h.library[0].id, originalId);

    await h.app.importPhotoManagerFiles([imageFile()]);
    assert.equal(h.library.length, 1);
    assert.equal(h.library[0].id, originalId);
});

test('selecting an image from another source registers it once in the library', async () => {
    const h = photoManagerHarness();
    const sourceItem = {
        id: 'machine-photo-1', source: 'machine',
        src: 'data:image/png;base64,BBBB', defaultName: '機械写真'
    };
    h.otherSources.push(sourceItem);
    h.app.openImageSourceChoice({ id: 'photo-manager-import-input' });
    h.choices.get(sourceItem.id).checked = true;

    await h.app.applySelectedImageSourceChoice();
    assert.equal(h.library.length, 1);
    assert.equal(h.library[0].src, sourceItem.src);
    assert.equal(h.saveCount, 1);
});

test('photo import reports success only after storage confirms the save', async () => {
    const h = photoManagerHarness({ deferSave: true });
    const importing = h.app.importPhotoManagerFiles([imageFile()]);
    await h.savingStarted;
    assert.equal(h.notices.some(message => message.includes('登録しました')), false);
    h.releaseSave();
    await importing;
    assert.equal(h.library.length, 1);
    assert.equal(h.saveCount, 1);
    assert.equal(h.notices.some(message => message.includes('登録しました')), true);
});

test('failed photo import restores the library and does not report success', async () => {
    const h = photoManagerHarness({ failSave: true });
    await h.app.importPhotoManagerFiles([imageFile()]);
    assert.equal(h.library.length, 0);
    assert.equal(h.notices.some(message => message.includes('登録しました')), false);
    assert.equal(h.notices.some(message => message.includes('保存できませんでした')), true);
});

test('failed selected-image registration keeps the chooser open', async () => {
    const h = photoManagerHarness({ failSave: true });
    h.otherSources.push({ id: 'machine-photo', source: 'machine', src: 'data:image/png;base64,BBBB' });
    const input = { id: 'photo-manager-import-input' };
    h.app.openImageSourceChoice(input);
    h.choices.get('machine-photo').checked = true;
    await h.app.applySelectedImageSourceChoice();
    assert.equal(h.library.length, 0);
    assert.equal(h.app._imageSourceChoiceInput, input);
    assert.equal(h.notices.some(message => message.includes('登録しました')), false);
});

test('clipboard import does not preview or report an image if saving fails', async () => {
    const h = photoManagerHarness({ failSave: true });
    await h.app.importPhotoManagerImageFromClipboard();
    assert.equal(h.library.length, 0);
    assert.equal(h.app._imageSourceInitialImportIds?.size || 0, 0);
    assert.equal(h.notices.some(message => message.includes('登録しました')), false);
});

test('failed stamp sheet import retains the confirmation dialog for retry', async () => {
    const h = photoManagerHarness({ failSave: true });
    h.app._photoManagerStampSheetPending = {
        baseName: '印', pieces: [{ src: 'data:image/png;base64,AAAA' }, { src: 'data:image/png;base64,BBBB' }]
    };
    h.app.createCompressedPhotoManagerSource = async () => ({ changed: false });
    let closed = false;
    h.app.closePhotoManagerReviewDialog = () => { closed = true; };
    await h.app.applyPhotoManagerStampSheetImport();
    assert.equal(h.library.length, 0);
    assert.equal(closed, false);
    assert.equal(h.app._photoManagerStampSheetPending.pieces.length, 2);
});

test('failed blank image duplication leaves the original as the only image', async () => {
    const h = photoManagerHarness({ failSave: true });
    const original = {
        id: 'blank-1', source: 'library', src: 'data:image/png;base64,AAAA',
        name: '白紙編集', photoCompareBlankEdit: { type: 'blank', marks: [] }
    };
    h.library.push(original);
    h.app.findPhotoManagerItem = () => original;
    await h.app.duplicatePhotoManagerBlankEdit(original.id);
    assert.equal(h.library.length, 1);
    assert.equal(h.library[0], original);
    assert.equal(h.notices.some(message => message.includes('複製しました')), false);
});
