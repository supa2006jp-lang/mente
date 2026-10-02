import assert from 'node:assert/strict';
import {coilPresetFields,validateCoilPreset} from '../src/coil-presets.js';

const legacy={
 wire:2,pitch:4,turns:2,wall:3.3,jointGap:.4,jointSeam:0,
 hand:'右ねじ',autoAdjust:true,alignStop:false,rimSeat:true,jointLatch:true,
 latchFirm:true,latchExtraFirm:true,latchGap:.15,latchEngagement:1.1,
 closeAngle:0
};
assert.ok(coilPresetFields.includes('latchStyle'));
assert.equal(validateCoilPreset(legacy).latchStyle,'claw','old presets retain the original claw');
assert.equal(validateCoilPreset({...legacy,latchStyle:'ridge'}).latchStyle,'ridge');
assert.equal(validateCoilPreset({...legacy,latchStyle:'claw'}).latchStyle,'claw');
assert.throws(()=>validateCoilPreset({...legacy,latchStyle:'unsupported'}),/固定形状/);
assert.ok(coilPresetFields.includes('stopFaceSetback'));
assert.equal(validateCoilPreset(legacy).stopFaceSetback,0,'older presets use the current 0 mm setback');
for(const value of [0,.25,.5,.75,1]) assert.equal(validateCoilPreset({...legacy,stopFaceSetback:value}).stopFaceSetback,value);
for(const value of [-.01,1.01,NaN,Infinity,'0.5',null]) assert.throws(()=>validateCoilPreset({...legacy,stopFaceSetback:value}),/回転止め面の引き込み量/);
assert.equal(validateCoilPreset(validateCoilPreset({...legacy,stopFaceSetback:.75})).stopFaceSetback,.75,'saved setback survives revalidation');
console.log('PASS latch style and stop-face setback preset save and legacy fallback');
