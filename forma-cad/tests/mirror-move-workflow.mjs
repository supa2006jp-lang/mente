import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {mirrorGridLine,mirrorGridPlane} from '../src/mirror-grid-axis.js';
import {mirrorSketchWorkflow,mirrorAxisReference,mirrorAxisDragValue,mirrorAxisDragSnap} from '../src/mirror-workflow.js';
import {sketchSegments} from '../src/sketch-selection.js';

const frame={basis:basisFor({plane:'XY'}),offset:4},project=p=>({x:p.x*10,y:p.y*10});
for(const [point,normal] of [[[20.3,13,4],[1,0,0]],[[13,20.3,4],[0,1,0]]]){
 const line=mirrorGridLine(new THREE.Vector3(...point),frame,10,project),spec=mirrorGridPlane(line,frame.basis.n);assert.ok(Math.abs(new THREE.Vector3(...spec.mirrorNormal).dot(new THREE.Vector3(...normal)))>.999999);assert.equal(spec.mirrorOrigin[2],4);
}
assert.equal(mirrorGridLine(new THREE.Vector3(15,15,4),frame,10,project),null);
const tilted={basis:basisFor({plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}),offset:7},point=tilted.basis.u.clone().multiplyScalar(20.2).addScaledVector(tilted.basis.v,13).addScaledVector(tilted.basis.n,7),oblique=p=>({x:p.x*8+p.y*3,y:p.y*8-p.z*4});
const tiltedLine=mirrorGridLine(point,tilted,10,oblique),tiltedSpec=mirrorGridPlane(tiltedLine,tilted.basis.n);assert.ok(Math.abs(new THREE.Vector3(...tiltedSpec.mirrorNormal).dot(tilted.basis.u))>.999999);assert.ok(Math.abs(new THREE.Vector3(...tiltedSpec.mirrorOrigin).dot(tilted.basis.n)-7)<1e-6);
const source={...defaults,id:'r',kind:'sketch',name:'枠',profile:'rect',width:12,height:8,x:24,y:8,z:0,groupId:'g',groupNumber:1},original=structuredClone(source);
const copy=mirrorSketchWorkflow([source],[source],{plane:'V'});assert.equal(copy.features.length,2);assert.equal(copy.copies.length,1);assert.notEqual(copy.copies[0].id,source.id);
const move=mirrorSketchWorkflow([source],[source],{plane:'V'},{move:true});assert.equal(move.features.length,1);assert.equal(move.features[0].id,'r');assert.equal(move.features[0].name,'枠');assert.equal(move.features[0].x,-24);assert.deepEqual(source,original);
const partial=mirrorSketchWorkflow([source],[],{plane:'V'},{move:true,selection:new Map([['r',new Set([0])]])});assert.equal(partial.copies.length,1);assert.equal(sketchSegments(partial.copies[0]).length,1);assert.equal(partial.retained.reduce((n,f)=>n+sketchSegments(f).length,0),3);assert.equal(new Set(partial.features.map(f=>f.id)).size,partial.features.length);
const ref=mirrorAxisReference(frame,{mirrorNormal:[1,0,0],mirrorOrigin:[20,0,4],offset:2},new THREE.Vector3(24,8,4));assert.deepEqual(ref.base.toArray(),[20,8,4]);assert.deepEqual(ref.base.clone().addScaledVector(ref.direction,2).toArray(),[22,8,4]);
assert.equal(mirrorAxisReference(frame,{mirrorNormal:[0,0,1],mirrorOrigin:[0,0,0]},new THREE.Vector3()),null);assert.equal(mirrorAxisDragValue(0),0);assert.equal(mirrorAxisDragValue(9.8,{snap:true,step:10,pixelsPerMm:10}),10);assert.equal(mirrorAxisDragValue(-20000),-10000);
// Offset starts off-grid; snap the reflected copy every grid step, not every
// twice-grid step. Local coordinates also apply to non-origin tilted planes.
for(const basis of [frame.basis,tilted.basis])for(const step of [1,5,10,20]){
 const origin=basis.u.clone().multiplyScalar(18).addScaledVector(basis.n,4),center=basis.u.clone().multiplyScalar(12).addScaledVector(basis.v,8).addScaledVector(basis.n,4),ref=mirrorAxisReference({basis,offset:4},{mirrorNormal:basis.u.toArray(),mirrorOrigin:origin.toArray(),offset:0},center,{followCopy:true});
 for(const target of [-step,0,step,2*step]){
  const raw=(target-12)/2+.01,result=mirrorAxisDragSnap(raw,{snap:true,step,pixelsPerMm:12,reference:ref,handle:true});assert.equal(result.snapped,true);assert(Math.abs(ref.handleBase.clone().addScaledVector(ref.handleDirection,result.value).dot(basis.u)-target)<1e-7);
 }
 const axis=mirrorAxisDragSnap(2.02,{snap:true,step:10,pixelsPerMm:6,reference:ref});assert.equal(axis.snapped,true);assert.equal(axis.value,2);
 assert.equal(mirrorAxisDragSnap(.25,{snap:false,step,reference:ref,handle:true}).snapped,false);
}
const diagonalRef={base:new THREE.Vector3(3,4,0),direction:new THREE.Vector3(1,1,0).normalize(),snapBasis:[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0)]},diagonal=mirrorAxisDragSnap(6*Math.SQRT2+.01,{snap:true,step:10,pixelsPerMm:10,reference:diagonalRef});assert(diagonal.snapped);assert(Math.abs(diagonalRef.base.clone().addScaledVector(diagonalRef.direction,diagonal.value).y-10)<1e-4);
assert.equal(mirrorAxisDragSnap(3,{snap:true,step:10,pixelsPerMm:10,reference:{base:new THREE.Vector3(),direction:new THREE.Vector3(1,0,0),snapBasis:frame.basis?[frame.basis.u,frame.basis.v]:[]}}).snapped,false);
console.log('PASS mirror grid lines, copy/replace/partial sketch workflow and draggable axis coordinates');
