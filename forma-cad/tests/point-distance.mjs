import assert from 'node:assert/strict';
import {distanceBetweenPoints} from '../src/point-distance.js';
import {pointReferenceLabel} from '../src/selected-point.js';
const result=distanceBetweenPoints([0,0,10],[20,0,30]);assert.deepEqual(result.delta,[20,0,20]);assert.ok(Math.abs(result.distance-Math.sqrt(800))<1e-10);
assert.deepEqual(distanceBetweenPoints([1,2,3],[-2,-2,-9]),{distance:13,delta:[-3,-4,-12]});
assert.deepEqual(distanceBetweenPoints([1,2,3],[1,2,3]),{distance:0,delta:[0,0,0]});
assert.throws(()=>distanceBetweenPoints([0,NaN,0],[0,0,0]));assert.throws(()=>distanceBetweenPoints([0,0],[0,0,0]));
const face={bodyId:'bodyA',name:'ソリッド面',kind:'center',normal:[0,0,1]};assert.equal(pointReferenceLabel(face,()=> '本体A'),'本体A · 上面の中心');assert.equal(pointReferenceLabel({...face,normal:[0,0,-1]},()=> '本体A'),'本体A · 底面の中心');assert.equal(pointReferenceLabel({...face,normal:[1,0,0]},()=> '本体A'),'本体A · 側面（X＋）の中心');assert.equal(pointReferenceLabel({...face,kind:'midpoint'},()=> '本体A'),'本体A · 辺の中点');assert.equal(pointReferenceLabel({name:'長方形',kind:'center'}),'長方形の中心');console.log('PASS spatial and zero distance, signed XYZ differences, invalid coordinates, body names and point orientation');
