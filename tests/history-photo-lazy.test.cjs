'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-maintenance-forms.js'), 'utf8');

test('attaching a history photo loads the shared library before saving its reference', async () => {
    class MaintenanceApp {}
    const calls = [];
    const photoInput = {
        dataset: {},
        disabled: false,
        addEventListener(type, handler) {
            if (type === 'change') this.onChange = handler;
        }
    };
    const preview = { innerHTML: '', appendChild() {} };
    const document = {
        getElementById(id) {
            return { 's-photos': photoInput, 's-photo-previews': preview }[id] || null;
        }
    };
    let app;
    const window = {
        maintenanceLazyFeatures: {
            async loadPhotos() {
                calls.push('load');
                app.collectPhotoManagerItems = () => [];
                app.addPhotoManagerLibraryImage = src => {
                    calls.push('add');
                    return { id: 'shared-1', src };
                };
            }
        }
    };
    const store = { save() { calls.push('save'); } };
    const MaintenanceStore = { async readImageAsDataUrl() { calls.push('read'); return 'data:image/png;base64,AA=='; } };
    const context = vm.createContext({ MaintenanceApp, MaintenanceStore, document, window, store, console, alert() {} });
    vm.runInContext(source, context, { filename: 'app-maintenance-forms.js' });
    app = new MaintenanceApp();
    app.createHistoryPhotoReference = item => ({ source: 'photoManager', id: item.id });
    app.appendHistoryPhotoPreview = () => {};
    app.setupHistoryPhotoInput('sudden');
    const event = { target: { files: [{ type: 'image/png', name: 'example.png' }], value: 'example.png' } };
    await photoInput.onChange(event);

    assert.deepEqual(calls, ['load', 'read', 'add', 'save']);
    assert.equal(app._tempPhotos.length, 1);
    assert.equal(app._tempPhotos[0].source, 'photoManager');
    assert.equal(app._tempPhotos[0].id, 'shared-1');
    assert.equal(photoInput.disabled, false);
    assert.equal(event.target.value, '');
});
