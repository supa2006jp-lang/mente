import assert from 'node:assert/strict';import {softRotationSnap} from '../src/rotation-snap.js';
const rad=d=>d*Math.PI/180;
for(const d of [-182,-137,-92,-47,-2,2,43,47,88,92,133,178,362])assert.ok(Math.abs(softRotationSnap(rad(d))-rad(Math.round(d/45)*45))<1e-10);
for(const d of [-40,10,30,40,50,70,100])assert.equal(softRotationSnap(rad(d)),rad(d));
assert.ok(Math.abs(softRotationSnap(rad(30+14))-rad(45))<1e-10);console.log('PASS weak rotation snap near 45-degree multiples; free angles remain unchanged');
