'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-photo-manager.js'), 'utf8');

function photoManagerHarness() {
    const library = [];
    const otherSources = [];
    const choices = new Map();
    const notices = [];
    let nextId = 0;
    let saveCount = 0;
    class MaintenanceApp {}
    const store = { save() { saveCount += 1; } };
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
        requestAnimationFrame(callback) { callback(); },
        console
    });
    vm.runInContext(source, context, { filename: 'app-photo-manager.js' });

    const app = Object.create(MaintenanceApp.prototype);
    app.getPhotoManagerLibrary = () => library;
    app.createPhotoManagerLibraryId = () => `library-${++nextId}`;
    app.getPhotoManagerToday = () => '2026-10-30';
    app.readPhotoManagerFileAsDataUrl = async file => file.src;
    app.preparePhotoManagerNormalSaveSource = async src => ({ src, compressed: false, transparent: false });
    app.detectAndRememberPhotoManagerTransparency = async () => false;
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
        get saveCount() { return saveCount; }
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

    h.app.applySelectedImageSourceChoice();
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

test('selecting an image from another source registers it once in the library', () => {
    const h = photoManagerHarness();
    const sourceItem = {
        id: 'machine-photo-1', source: 'machine',
        src: 'data:image/png;base64,BBBB', defaultName: '機械写真'
    };
    h.otherSources.push(sourceItem);
    h.app.openImageSourceChoice({ id: 'photo-manager-import-input' });
    h.choices.get(sourceItem.id).checked = true;

    h.app.applySelectedImageSourceChoice();
    assert.equal(h.library.length, 1);
    assert.equal(h.library[0].src, sourceItem.src);
    assert.equal(h.saveCount, 1);
});
