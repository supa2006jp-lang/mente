import assert from 'node:assert/strict';
import * as THREE from 'three';
import {basisFor} from '../src/frames.js';
import {mirrorGridPlane,snapMirrorGridPoint} from '../src/mirror-grid-axis.js';
const vector=a=>new THREE.Vector3(...a);
for(const plane of ['XY','XZ','YZ']){
 const basis=basisFor({plane}),offset=12,at=(u,v)=>basis.u.clone().multiplyScalar(u).addScaledVector(basis.v,v).addScaledVector(basis.n,offset),project=p=>({x:p.dot(basis.u)*10,y:p.dot(basis.v)*10});
 const points=[at(10,0),at(10,30)],spec=mirrorGridPlane(points,basis.n),normal=vector(spec.mirrorNormal);
 assert.ok(Math.abs(normal.dot(basis.u))>.999999);assert.deepEqual(spec.mirrorOrigin,points[0].toArray());
 assert.ok(snapMirrorGridPoint(at(10.3,20.2),{basis,offset},10,project,true).distanceTo(at(10,20))<1e-8);
 assert.ok(snapMirrorGridPoint(at(10.3,23),{basis,offset},10,project,true).distanceTo(at(10,23))<1e-8,'snap along a grid line');
 assert.ok(snapMirrorGridPoint(at(13,23),{basis,offset},10,project,true).distanceTo(at(13,23))<1e-8,'free away from lines');
 assert.ok(snapMirrorGridPoint(at(10.3,20.2),{basis,offset},10,project,false).distanceTo(at(10.3,20.2))<1e-8);
 const diagonal=mirrorGridPlane([at(0,0),at(10,10)],basis.n);assert.ok(Math.abs(vector(diagonal.mirrorNormal).dot(at(10,10).sub(at(0,0))))<1e-8);
}
assert.throws(()=>mirrorGridPlane([],vector([0,0,1])),/2点/);
assert.throws(()=>mirrorGridPlane([vector([0,0,0]),vector([0,0,0])],vector([0,0,1])),/異なる/);
assert.throws(()=>mirrorGridPlane([vector([0,0,0]),vector([0,0,3])],vector([0,0,1])),/異なる/);
console.log('PASS two-point mirror planes, nonzero offsets, diagonal axes, grid intersection/line/free snapping and degenerate rejection');
