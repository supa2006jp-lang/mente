import assert from 'node:assert/strict';
import {rotationSnapTarget,rotationAngleText} from '../src/rotation-snap.js';

const rad=degrees=>degrees*Math.PI/180;
for(let target=-720;target<=720;target+=15){
 for(const delta of [-4.5,0,4.5]){
  const snapped=rotationSnapTarget(rad(target+delta));
  assert.notEqual(snapped,null);
  assert(Math.abs(snapped-rad(target))<1e-10);
 }
}
for(const degrees of [-40,5,10,20,25,40,50,70,100])assert.equal(rotationSnapTarget(rad(degrees)),null);
assert.equal(rotationSnapTarget(rad(21),rad(15)),rad(15));
assert.equal(rotationSnapTarget(rad(21.1),rad(15)),null);
assert.equal(rotationSnapTarget(rad(-6),0),0);
assert.equal(rotationSnapTarget(rad(-6.1),0),null);
assert(Math.abs(rotationSnapTarget(rad(29),rad(15))-rad(30))<1e-10);
assert.equal(rotationAngleText(15),'15.0');
assert.equal(rotationAngleText(12.345),'12.3');
assert.equal(rotationAngleText(-12.36),'-12.4');
assert.equal(rotationAngleText(-.00001),'0.0');
console.log('PASS stronger capture, steady release, free angles, signed/multiturn angles and formatting');
