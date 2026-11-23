'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app-shift-notebook-core.js'), 'utf8');
function harness(initial = '[]', fail = false) {
    class MaintenanceApp {}
    let saved = initial;
    vm.runInNewContext(source, {MaintenanceApp, document:{querySelector:()=>null}, localStorage:{getItem:()=>saved,setItem:(_,value)=>{if(fail)throw Error('quota');saved=value;}}});
    return {app:new MaintenanceApp(),saved:()=>saved};
}
test('palette remembers ten unique valid colors, most recent first, across reloads', () => {
    const {app,saved} = harness();
    for(let i=0;i<12;i++)app.rememberShiftPhotoComparePaletteColor('#'+i.toString(16).padStart(6,'0'));
    app.rememberShiftPhotoComparePaletteColor('#00000A');
    const colors = JSON.parse(JSON.stringify(app.getShiftPhotoComparePaletteRecentColors()));
    assert.equal(colors.length,10);assert.equal(colors[0],'#00000a');assert.equal(new Set(colors).size,10);
    assert.equal(colors.includes('#000001'),false);
    assert.deepEqual(JSON.parse(JSON.stringify(harness(saved()).app.getShiftPhotoComparePaletteRecentColors())),colors);
});
test('palette ignores malformed stored colors and remains usable when storage fails', () => {
    for(const raw of ['broken','{}','null'])assert.equal(harness(raw).app.getShiftPhotoComparePaletteRecentColors().length,0);
    const {app} = harness('["#AABBCC","#aabbcc","bad",null,12]',true);
    app.rememberShiftPhotoComparePaletteColor('#112233');app.rememberShiftPhotoComparePaletteColor('<script>');
    assert.deepEqual(JSON.parse(JSON.stringify(app.getShiftPhotoComparePaletteRecentColors())),['#112233','#aabbcc']);
});
test('palette background destinations reflect available photos and gradient mode', () => {
    const {app} = harness();
    const enabled = () => app.getShiftPhotoComparePaletteTargets().filter(row=>!row.disabled).map(row=>row.value);
    assert.equal(enabled().includes('blank'),false);
    app._shiftPhotoCompareContext={photos:[{isBlankBase:true,blankBaseGradient:{enabled:false}}]};
    assert.equal(enabled().includes('blank'),true);assert.equal(enabled().includes('blankEnd'),false);
    app._shiftPhotoCompareContext.photos[0].blankBaseGradient.enabled=true;
    assert.equal(enabled().includes('blankEnd'),true);
});
test('palette rejects unavailable targets and changes neither target nor preview while saving or comparing', () => {
    const {app} = harness();const calls=[];
    app.cancelShiftPhotoCompareEyedropper=()=>calls.push('cancel');app.stopShiftPhotoCompareFallbackEyedropper=()=>calls.push('stop');app.pickShiftPhotoCompareScreenColor=value=>calls.push(value);
    app.setShiftPhotoComparePaletteTarget('blank');app.setShiftPhotoComparePaletteTarget('invalid');assert.equal(calls.length,0);
    app._shiftPhotoCompareContext={_saving:true};app.setShiftPhotoComparePaletteTarget('text');assert.equal(calls.length,0);
    app._shiftPhotoCompareContext={_imageComparison:{}};app.setShiftPhotoComparePaletteTarget('text');assert.equal(calls.length,0);
    app._shiftPhotoCompareContext={};app.setShiftPhotoComparePaletteTarget('text');assert.deepEqual(calls,['cancel','stop','text']);
});
