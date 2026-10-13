import assert from 'node:assert/strict';import {softRotationSnap,rotationAngleText} from '../src/rotation-snap.js';
const rad=d=>d*Math.PI/180;
for(let target=-720;target<=720;target+=15)for(const delta of [-2,0,2])assert.ok(Math.abs(softRotationSnap(rad(target+delta))-rad(target))<1e-10);
for(const d of [-40,5,10,20,25,40,50,70,100])assert.equal(softRotationSnap(rad(d)),rad(d));
assert.ok(Math.abs(softRotationSnap(rad(30+14))-rad(45))<1e-10);
assert.equal(rotationAngleText(15),'15.0');assert.equal(rotationAngleText(12.345),'12.3');assert.equal(rotationAngleText(-12.36),'-12.4');assert.equal(rotationAngleText(-.00001),'0.0');
console.log('PASS soft snap near all 15-degree multiples, signed/multiturn angles, free angles, one-decimal display and negative-zero formatting');
