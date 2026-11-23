'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MaintenanceApp {}
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app-shift-notebook-core.js'), 'utf8'), { MaintenanceApp });
const app = new MaintenanceApp();
const svg = (color, gradient) => decodeURIComponent(app.createShiftPhotoCompareBlankBaseSrc(color, gradient).split(',')[1]);

test('old solid backgrounds remain solid and gradient inputs are validated', () => {
    assert.match(svg('#123456'), /fill="#123456"/);
    assert.doesNotMatch(svg('#123456'), /linearGradient/);
    const result = svg('" onload="bad', { enabled: true, color: '<script>', direction: '<script>' });
    assert.doesNotMatch(result, /script|onload/);
    assert.match(result, /stop-color="#ffffff"/);
    assert.match(result, /stop-color="#dbeafe"/);
    assert.match(result, /x1="0" y1="0" x2="0" y2="1"/);
});

test('each gradient direction produces an exportable SVG with both colors', () => {
    for (const [direction, coordinates] of Object.entries({ vertical: [0, 0, 0, 1], horizontal: [0, 0, 1, 0], diagonal: [0, 0, 1, 1], diagonalReverse: [1, 0, 0, 1] })) {
        const result = svg('#112233', { enabled: true, color: '#AABBCC', direction });
        const [x1, y1, x2, y2] = coordinates;
        assert.ok(result.includes(`x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`));
        assert.match(result, /stop-color="#112233"/);
        assert.match(result, /stop-color="#aabbcc"/);
        assert.match(result, /fill="url\(#background\)"/);
    }
});

test('blank edit metadata retains the background without mutating its source', () => {
    const gradient = { enabled: true, color: '#336699', direction: 'diagonal' };
    const photo = app.createShiftPhotoCompareBlankBasePhoto('#ffffff', gradient);
    app.getShiftPhotoComparePhotoByWrap = () => photo;
    app.syncShiftPhotoCompareMarks = () => {};
    app.compactShiftPhotoCompareMarkImages = marks => marks;
    const edit = app.getShiftPhotoCompareBlankEditData({});
    assert.equal(JSON.stringify(edit.blankBaseGradient), JSON.stringify(app.normalizeShiftPhotoCompareBlankGradient(gradient)));
    gradient.color = '#000000';
    assert.equal(photo.blankBaseGradient.color, '#336699');
    edit.blankBaseGradient.color = '#ff0000';
    assert.equal(photo.blankBaseGradient.color, '#336699');
});

test('solid mode hides the gradient fields but preserves the second color', () => {
    const photo = app.createShiftPhotoCompareBlankBasePhoto('#ffffff', { enabled: false, color: '#336699', direction: 'horizontal' });
    const html = app.getShiftPhotoCompareBlankBackgroundControlsHtml(photo);
    assert.match(html, /data-bg-mode="solid" aria-pressed="true"/);
    assert.match(html, /gradient-options" hidden/);
    assert.match(html, /value="#336699"/);
    assert.match(html, /value="horizontal" selected/);
    assert.equal(app.getShiftPhotoCompareBlankBackgroundControlsHtml({ isBlankBase: false }), '');
});

test('radial centers default, clamp and reject invalid values', () => {
    const normalize = value => JSON.parse(JSON.stringify(app.normalizeShiftPhotoCompareBlankGradient(value)));
    assert.deepEqual(normalize(null), { enabled: false, color: '#dbeafe', direction: 'vertical', type: 'linear', centerX: 50, centerY: 50 });
    assert.deepEqual(normalize({ type: 'radial', centerX: -2, centerY: 123 }), { enabled: false, color: '#dbeafe', direction: 'vertical', type: 'radial', centerX: 0, centerY: 100 });
    assert.equal(normalize({ centerX: NaN }).centerX, 50);
    assert.equal(normalize({ centerY: Infinity }).centerY, 50);
    assert.equal(normalize({ centerX: null, centerY: '' }).centerX, 50);
    assert.equal(normalize({ centerX: '25', centerY: 74.6 }).centerY, 75);
});

test('radial SVG uses circular image coordinates with a movable center', () => {
    const result = svg('#ffffff', { enabled: true, color: '#336699', type: 'radial', centerX: 25, centerY: 75 });
    assert.match(result, /radialGradient/);
    assert.match(result, /gradientUnits="userSpaceOnUse" cx="400" cy="750"/);
    assert.match(result, new RegExp(`r="${Math.hypot(1200, 750)}"`));
    assert.doesNotMatch(result, /linearGradient/);
});

test('color swap changes both colors in one operation and keeps radial placement', () => {
    const editor = new MaintenanceApp();
    const gradient = editor.normalizeShiftPhotoCompareBlankGradient({ enabled: true, color: '#336699', type: 'radial', centerX: 25, centerY: 75 });
    editor._shiftPhotoCompareContext = { photos: [{ isBlankBase: true, blankBaseColor: '#ffffff', blankBaseGradient: gradient }] };
    const changes = [];
    editor.setShiftPhotoCompareBlankBackground = change => changes.push(change);
    editor.swapShiftPhotoCompareBlankBackgroundColors();
    assert.equal(changes.length, 1);
    assert.equal(changes[0].color, '#336699');
    assert.equal(changes[0].gradient.color, '#ffffff');
    assert.equal(changes[0].gradient.centerX, 25);
    assert.equal(changes[0].gradient.centerY, 75);
    assert.equal(changes[0].gradient.type, 'radial');
    gradient.enabled = false;
    editor.swapShiftPhotoCompareBlankBackgroundColors();
    assert.equal(changes.length, 1);
});

test('eyedropper routes each background color without changing the other target', () => {
    const editor = new MaintenanceApp();
    const changes = [];
    editor.setShiftPhotoCompareBlankBaseColor = color => changes.push(['start', color]);
    editor.setShiftPhotoCompareBlankGradient = gradient => changes.push(['end', JSON.parse(JSON.stringify(gradient))]);
    editor.setShiftPhotoCompareMarkColor = color => changes.push(['mark', color]);
    editor.applyShiftPhotoComparePickedColor('#AABBCC', 'blankEnd');
    editor.applyShiftPhotoComparePickedColor('#123456', 'blank');
    editor.applyShiftPhotoComparePickedColor('invalid', 'blankEnd');
    assert.deepEqual(changes, [['end', {color:'#aabbcc'}], ['start', '#123456']]);
    editor._shiftPhotoCompareEyedropperTarget = 'blankEnd';
    assert.equal(editor.getShiftPhotoComparePaletteEyedropperLabel(), '背景の終了色');
    editor._shiftPhotoCompareEyedropperTarget = 'blank';
    assert.equal(editor.getShiftPhotoComparePaletteEyedropperLabel(), '背景の開始色');
});

test('foil validates persisted settings and leaves old backgrounds unchanged', () => {
    const normalize = value => JSON.parse(JSON.stringify(app.normalizeShiftPhotoCompareBlankFoil(value)));
    assert.deepEqual(normalize(null), { enabled: false, pattern: 'prism', strength: 80, scale: 80, angle: 30 });
    assert.deepEqual(normalize({ enabled: 1, pattern: '<script>', strength: 1000, scale: -5, angle: Infinity }), { enabled: false, pattern: 'prism', strength: 100, scale: 40, angle: 30 });
    assert.equal(normalize({ strength: '', scale: null, angle: 999 }).angle, 180);
    assert.equal(normalize({ strength: '', scale: null }).scale, 80);
    assert.equal(normalize({ strength: '53.5', angle: -2 }).strength, 54);
    assert.equal(normalize({ angle: -2 }).angle, 0);
    assert.equal('foil' in app.normalizeShiftPhotoCompareBlankGradient(null), false);
    assert.doesNotMatch(svg('#123456'), /foil/);
});

test('foil patterns are deterministic, bounded and exportable without external assets', () => {
    const outputs = [];
    for (const pattern of ['prism', 'diamond', 'crystal']) {
        const gradient = { foil: { enabled: true, pattern, strength: 75, scale: 90, angle: 45 } };
        const output = svg('#123456', gradient);
        assert.equal(output, svg('#123456', gradient));
        assert.match(output, new RegExp(`data-foil-pattern="${pattern}"`));
        assert.match(output, /opacity="0.75"/);
        assert.match(output, /width="288" height="288"/);
        assert.ok(output.length < 20000);
        assert.doesNotMatch(output, /<script|<image|<animate|<foreignObject/);
        outputs.push(output);
    }
    assert.equal(new Set(outputs).size, 3);
    assert.doesNotMatch(svg('#123456', { foil: { enabled: true, strength: 0 } }), /foil-facets/);
    assert.doesNotMatch(svg('#123456', { foil: { enabled: false } }), /foil-facets/);
    assert.doesNotMatch(svg('#123456', { foil: { enabled: true, pattern: '<script>', angle: '" onload="bad' } }), /script|onload/);
});

test('foil mode retains its settings across modes and saves independent metadata', () => {
    const editor = new MaintenanceApp();
    const source = { enabled: true, color: '#abcdef', type: 'radial', foil: { enabled: false, pattern: 'diamond', strength: 65, scale: 120, angle: 75 } };
    const photo = editor.createShiftPhotoCompareBlankBasePhoto('#123456', source);
    editor._shiftPhotoCompareContext = { photos: [photo] };
    editor.setShiftPhotoCompareBlankBackground = ({ gradient }) => { photo.blankBaseGradient = editor.normalizeShiftPhotoCompareBlankGradient(gradient); };
    editor.setShiftPhotoCompareBlankBackgroundMode('foil');
    assert.equal(photo.blankBaseGradient.foil.enabled, true);
    assert.equal(photo.blankBaseGradient.enabled, false);
    editor.setShiftPhotoCompareBlankBackgroundMode('gradient');
    assert.equal(photo.blankBaseGradient.enabled, true);
    assert.equal(photo.blankBaseGradient.foil.enabled, false);
    assert.equal(photo.blankBaseGradient.color, '#abcdef');
    editor.setShiftPhotoCompareBlankBackgroundMode('foil');
    editor.setShiftPhotoCompareBlankFoil({ angle: 35 });
    assert.equal(photo.blankBaseGradient.foil.pattern, 'diamond');
    assert.equal(photo.blankBaseGradient.foil.strength, 65);
    assert.equal(source.foil.angle, 75);
    const html = editor.getShiftPhotoCompareBlankBackgroundControlsHtml(photo);
    assert.match(html, /data-bg-mode="foil" aria-pressed="true"/);
    assert.match(html, /gradient-options" hidden/);
    assert.match(html, /foil-options">/);
    assert.match(html, /data-bg-foil="angle"/);
    editor.getShiftPhotoComparePhotoByWrap = () => photo;
    editor.syncShiftPhotoCompareMarks = () => {};
    editor.compactShiftPhotoCompareMarkImages = marks => marks;
    const edit = editor.getShiftPhotoCompareBlankEditData({});
    assert.equal(edit.blankBaseGradient.foil.angle, 35);
    edit.blankBaseGradient.foil.pattern = 'crystal';
    assert.equal(photo.blankBaseGradient.foil.pattern, 'diamond');
});
