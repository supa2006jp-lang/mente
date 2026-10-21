import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {mirrorSketch} from '../src/sketch-mirror.js';
import {mirrorSketchRange,mirrorGapOffset} from '../src/mirror-placement.js';
import {splineCurve} from '../src/spline-curve.js';

const rect={...defaults,kind:'sketch',profile:'rect',id:'rect',width:12,height:8,x:24,y:8},n=new THREE.Vector3(-1,0,0),spec={mirrorNormal:n.toArray(),mirrorOrigin:[18,0,0]},range=mirrorSketchRange([rect],n);
assert.deepEqual(range,[-30,-18]);
for(const side of [-1,1])for(const gap of [0,.2,5]){
 const offset=mirrorGapOffset(range,spec,gap,side),copy=mirrorSketch(rect,{...spec,offset}),after=mirrorSketchRange([copy],n),actual=side>0?after[0]-range[1]:range[0]-after[1];assert(Math.abs(actual-gap)<1e-10);
}
const rotated={...rect,angle:37},diagonal=new THREE.Vector3(1,1,0).normalize(),diagonalRange=mirrorSketchRange([rotated],diagonal);assert(diagonalRange[1]-diagonalRange[0]>12);
for(const plane of ['XY','XZ','YZ']){
 const b=basisFor({plane}),normal=b.u.clone().add(b.v).normalize(),circle={...rect,plane,profile:'circle',diameter:11},r=mirrorSketchRange([circle],normal),center=new THREE.Vector3(circle.x,circle.y,circle.z).dot(normal);assert(Math.abs(r[0]-(center-5.5))<1e-10);assert(Math.abs(r[1]-(center+5.5))<1e-10);
 const s={mirrorNormal:normal.toArray(),mirrorOrigin:[4,2,7]},offset=mirrorGapOffset(r,s,.35),mirrored=mirrorSketch(circle,{...s,offset}),out=mirrorSketchRange([mirrored],normal);assert(Math.abs(out[0]-r[1]-.35)<1e-10);
}
for(const closed of [false,true]){
 const f={...rect,profile:'spline',x:0,y:0,z:0,closed,points:[[0,0],[6,10],[12,0],[18,7]],tangents:{start:170,end:-160},tangentLengths:{start:12,end:10}},normal=new THREE.Vector3(.7,.3,0).normalize(),r=mirrorSketchRange([f],normal),curve=splineCurve(f);let lo=Infinity,hi=-Infinity;
 for(let i=0;i<=30000;i++){const v=curve.getPoint(i/30000).dot(normal);lo=Math.min(lo,v);hi=Math.max(hi,v);}assert(r[0]<=lo+1e-9);assert(r[1]>=hi-1e-9);assert(Math.abs(r[0]-lo)<1e-5);assert(Math.abs(r[1]-hi)<1e-5);
 const s={mirrorNormal:normal.toArray(),mirrorOrigin:[0,0,0]},offset=mirrorGapOffset(r,s,5),copy=mirrorSketch(f,{...s,offset}),after=mirrorSketchRange([copy],normal);assert(Math.abs(after[0]-r[1]-5)<1e-8);
}
assert.deepEqual(mirrorSketchRange([rect,{...rect,x:100}],n),[-106,-18]);
for(const gap of [-1,NaN,Infinity,10001])assert.throws(()=>mirrorGapOffset(range,spec,gap),/すき間/);assert.throws(()=>mirrorSketchRange([],n),/選択/);
console.log('PASS mirror gap placement in both directions; rotated and mixed sources; exact circle and cubic spline extrema on all workplanes; invalid gaps');
