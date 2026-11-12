'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-shift-notebook-core.js'), 'utf8');
class MaintenanceApp {}
vm.runInNewContext(source, { MaintenanceApp }, { filename: 'app-shift-notebook-core.js' });

function makeMark(order = 0) {
    const classes = new Set();
    return {
        dataset: { mode: 'circle', animationOrder: String(order), animationGhost: '0' },
        style: {},
        querySelectorAll: () => [],
        classList: {
            toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
            contains(name) { return classes.has(name); }
        }
    };
}

function preparePage(marks) {
    const grid = {
        querySelectorAll(selector) {
            return selector === '.shift-photo-compare-mark' ? marks : [];
        }
    };
    const app = new MaintenanceApp();
    app.cleanShiftPhotoCompareAnimationPlaybackChrome = () => {};
    app.restoreShiftPhotoCompareAnimationTimelineBackup = () => {};
    app.getShiftPhotoCompareAnimationOrderValue = value => Number(value) || 0;
    app.normalizeShiftPhotoCompareAnimationEffect = () => '';
    app.normalizeShiftPhotoCompareAnimationRoundTripCount = () => 0;
    app.getShiftPhotoCompareAnimationStartState = () => ({ x: 0, y: 0 });
    app.getShiftPhotoCompareAnimationEndState = () => ({ x: 0, y: 0 });
    app.isShiftPhotoCompareAnimationSyncControlledPhoto = () => false;
    app.supportsShiftPhotoComparePages = () => false;
    app.prepareShiftPhotoCompareAnimationMark = () => {};
    app.getShiftPhotoCompareAnimationTimelinePageEntries = () => [];
    app.getShiftPhotoCompareAnimationTimelineStorageKey = () => 'test-page';
    app.getShiftPhotoCompareAnimationTimelineActions = () => [];
    app.getShiftPhotoCompareAnimationTimelineMarkKey = () => 'mark';
    app.getShiftPhotoCompareAnimationPhotoSyncTargetKey = () => '';
    app.getShiftPhotoCompareAnimationTimelineStepKey = () => 'symbol';
    app.normalizeShiftPhotoCompareAnimationTimelineActions = () => [];
    return app.prepareShiftPhotoCompareAnimationPlaybackPage(grid, null, { page: 1 });
}

test('animation page opens with no ordered marks and leaves the photo visible', () => {
    const mark = makeMark();
    const page = preparePage([mark]);
    assert.ok(page);
    assert.equal(page.allItems.length, 1);
    assert.equal(page.marks.length, 0);
    assert.equal(page.steps.length, 0);
    assert.equal(mark.classList.contains('shift-photo-compare-animation-visible'), true);
    assert.equal(mark.classList.contains('shift-photo-compare-animation-hidden'), false);
    assert.ok(preparePage([]));
});

test('ordered marks still create an animation step', () => {
    const mark = makeMark(1);
    const page = preparePage([mark]);
    assert.ok(page);
    assert.equal(page.marks.length, 1);
    assert.equal(page.steps.length, 1);
    assert.equal(page.steps[0].type, 'symbol');
    assert.equal(page.steps[0].order, 1);
    assert.equal(mark.classList.contains('shift-photo-compare-animation-hidden'), true);
});

test('OCR image text is passed to the animation speech pipeline', () => {
    const app = new MaintenanceApp();
    const text = app.getShiftPhotoCompareSpeechText({ dataset: { mode: 'imageOcr', text: '安全第一\n指差し確認' } });
    assert.equal(text, '安全第一 指差し確認');
});
