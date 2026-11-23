'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
    class MaintenanceApp {}
    const controls = new Map();
    const get = key => {
        if (!controls.has(key)) controls.set(key, {});
        return controls.get(key);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app-shift-notebook-core.js'), 'utf8'), {
        MaintenanceApp, document: { querySelector: get, getElementById: get }
    });
    const app = new MaintenanceApp();
    app.getShiftPhotoCompareSelectedMarks = () => [];
    return { app, get };
}

test('first open and invalid scale settings display 100 instead of undefined', () => {
    const { app, get } = harness();
    for (const value of [undefined, null, '', 'undefined', 'NaN', NaN, Infinity, -20, 0]) {
        app._shiftPhotoCompareMarkStretch = value;
        app._shiftPhotoCompareMarkStretchY = value;
        app.updateShiftPhotoCompareSizeControls('move');
        assert.equal(get('shift-photo-compare-stretch-value').textContent, '100');
        assert.equal(get('shift-photo-compare-stretch-y-value').textContent, '100');
        assert.equal(get('.shift-photo-compare-size input[oninput*="MarkStretch"]').value, '100');
        assert.equal(get('.shift-photo-compare-size input[oninput*="MarkStretchY"]').value, '100');
    }
});

test('valid shape, arrow and mosaic scales are preserved when controls refresh', () => {
    const { app, get } = harness();
    for (const [mode, x, y] of [['circle', 150, 225], ['arrow', 1000, 100], ['mosaic', 5, 1200]]) {
        app._shiftPhotoCompareMarkStretch = String(x);
        app._shiftPhotoCompareMarkStretchY = y;
        app.updateShiftPhotoCompareSizeControls(mode);
        assert.equal(get('shift-photo-compare-stretch-value').textContent, String(x));
        assert.equal(get('shift-photo-compare-stretch-y-value').textContent, String(y));
        assert.equal(app._shiftPhotoCompareMarkStretch, x);
        assert.equal(app._shiftPhotoCompareMarkStretchY, y);
    }
});
