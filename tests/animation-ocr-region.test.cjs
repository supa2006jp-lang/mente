'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-shift-notebook-core.js'), 'utf8');

function harness() {
    class MaintenanceApp {}
    const drawCalls = [];
    const crop = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (...args) => drawCalls.push(args) }),
        toDataURL: () => 'data:image/png;base64,CROPPED'
    };
    const document = { createElement: tag => tag === 'canvas' ? crop : null };
    vm.runInNewContext(source, { MaintenanceApp, document, console }, { filename: 'app-shift-notebook-core.js' });
    const app = new MaintenanceApp();
    const state = { grid: {} };
    app._shiftPhotoCompareAnimationState = state;
    app.renderShiftPhotoCompareAnimationContentToCanvas = async () => ({ width: 1200, height: 600 });
    const received = [];
    app.readShiftPhotoCompareImageOcrImmediately = async options => { received.push(options); return true; };
    return { app, state, crop, drawCalls, received };
}

test('selected animation area is cropped in rendered image coordinates before immediate OCR', async () => {
    const h = harness();
    const result = await h.app.readShiftPhotoCompareAnimationOcrRegion({
        x: 100, y: 50, width: 200, height: 80,
        displayedWidth: 600, displayedHeight: 300
    });
    assert.equal(result, true);
    assert.equal(h.crop.width, 400);
    assert.equal(h.crop.height, 160);
    assert.deepEqual(Array.from(h.drawCalls[0].slice(1)), [200, 100, 400, 160, 0, 0, 400, 160]);
    assert.equal(h.received.length, 1);
    assert.equal(h.received[0].src, 'data:image/png;base64,CROPPED');
    assert.equal(h.received[0].label, '選択範囲');
});

test('OCR does not read a crop after the animation page changes during rendering', async () => {
    const h = harness();
    let finish;
    h.app.renderShiftPhotoCompareAnimationContentToCanvas = () => new Promise(resolve => { finish = resolve; });
    const pending = h.app.readShiftPhotoCompareAnimationOcrRegion({
        x: 0, y: 0, width: 100, height: 100,
        displayedWidth: 600, displayedHeight: 300
    });
    h.state.grid = {};
    finish({ width: 1200, height: 600 });
    assert.equal(await pending, false);
    assert.equal(h.received.length, 0);
    assert.equal(h.drawCalls.length, 0);
});

test('dragging a region reads once and consumes the animation click', () => {
    class MaintenanceApp {}
    const callbacks = [];
    const box = { hidden: true, style: {} };
    const listeners = new Map();
    const layer = {
        className: '',
        set innerHTML(_html) {},
        querySelector: () => box,
        addEventListener(type, handler) { listeners.set(type, handler); },
        setPointerCapture() {},
        releasePointerCapture() {},
        remove() { this.removed = true; }
    };
    const stage = {
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        appendChild(child) { this.child = child; }
    };
    const buttonClasses = new Set();
    const button = {
        classList: {
            add: name => buttonClasses.add(name),
            remove: name => buttonClasses.delete(name)
        },
        setAttribute(name, value) { this[name] = value; }
    };
    const overlay = {
        querySelector: selector => selector === '.shift-photo-compare-animation-stage' ? stage : button
    };
    const grid = {
        getBoundingClientRect: () => ({ left: 100, top: 40, right: 700, bottom: 340, width: 600, height: 300 })
    };
    vm.runInNewContext(source, {
        MaintenanceApp,
        document: { createElement: () => layer },
        window: { setTimeout: callback => callbacks.push(callback) },
        console
    }, { filename: 'app-shift-notebook-core.js' });
    const app = new MaintenanceApp();
    const reads = [];
    app.readShiftPhotoCompareAnimationOcrRegion = region => { reads.push(region); return Promise.resolve(true); };
    app._shiftPhotoCompareAnimationState = { overlay, grid, timer: null };
    assert.equal(app.toggleShiftPhotoCompareAnimationOcrRegionSelection(), true);
    assert.equal(stage.child, layer);
    assert.equal(button['aria-pressed'], 'true');
    const pointer = (clientX, clientY) => ({
        pointerId: 7, button: 0, clientX, clientY,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; }
    });
    const down = pointer(120, 60);
    listeners.get('pointerdown')(down);
    assert.equal(down.prevented, true);
    assert.equal(down.stopped, true);
    listeners.get('pointermove')(pointer(420, 180));
    const up = pointer(420, 180);
    listeners.get('pointerup')(up);
    assert.equal(up.prevented, true);
    assert.equal(up.stopped, true);
    assert.equal(reads.length, 1);
    assert.deepEqual(Array.from(['x', 'y', 'width', 'height'], key => reads[0][key]), [20, 20, 300, 120]);
    const click = pointer(420, 180);
    listeners.get('click')(click);
    assert.equal(click.prevented, true);
    assert.equal(click.stopped, true);
    callbacks[0]();
    assert.equal(layer.removed, true);
    assert.equal(button['aria-pressed'], 'false');
});
