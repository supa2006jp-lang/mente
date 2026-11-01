import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {basisFor,worldPoint,validateFrame} from '../src/frames.js';import {perpendicularSketchPlane,perpendicularPlaneDragValue} from '../src/perpendicular-sketch-plane.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
test('both 90-degree orientations pass through each selected face centre, not the world origin',()=>{for(const plane of ['XY','XZ','YZ'])for(const axis of ['u','v']){const face={plane,offset:37,outer:[[90,40],[130,40],[130,70],[90,70]],holes:[]},before=JSON.stringify(face),s=perpendicularSketchPlane(face,{axis}),b=basisFor(face),next=basisFor(s.plane);near(b.n.dot(next.n),0);near(s.center.distanceTo(worldPoint(face,[110,55])),0);near(s.origin.clone().sub(s.center).length(),0);near(next.n.dot(s.origin),s.plane.offset);validateFrame(s.plane.frame);assert.equal(s.plane.kind,undefined);assert.equal(s.plane.workingGrid,true);assert.equal(JSON.stringify(face),before);}});
test('position follows the new normal and reverse changes the viewing side without moving the plane',()=>{const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.7,-.2)),frame=Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3(...[[1,0,0],[0,1,0],[0,0,1]][i]).applyQuaternion(q).toArray()])),face={plane:'CUSTOM',frame,offset:28,outer:[[10,20],[70,20],[70,50],[10,50]],holes:[]};for(const axis of ['u','v'])for(const distance of [-24,0,12.5]){const a=perpendicularSketchPlane(face,{axis,distance}),b=perpendicularSketchPlane(face,{axis,distance,reverse:true});near(a.origin.distanceTo(b.origin),0);near(a.origin.clone().sub(a.center).dot(a.direction),distance);near(basisFor(a.plane).n.dot(basisFor(b.plane).n),-1);for(const p of a.plane.outer)near(worldPoint(a.plane,p).dot(basisFor(a.plane).n),a.plane.offset);validateFrame(b.plane.frame);}});
test('invalid positions and missing or malformed faces fail explicitly',()=>{const face={plane:'XY',offset:0,outer:[[0,0],[20,0],[20,10],[0,10]],holes:[]};for(const distance of [NaN,Infinity,10001,-10001,'0'])assert.throws(()=>perpendicularSketchPlane(face,{distance}),/位置/);assert.throws(()=>perpendicularSketchPlane(null),/平面/);assert.throws(()=>perpendicularSketchPlane(face,{axis:'n'}),/平面/);assert.throws(()=>perpendicularSketchPlane({...face,frame:{u:[1,0,0],v:[1,0,0],n:[0,0,1]}}),/平面/);});
test('drag snapping accepts zero and matches the displayed grid interval while fine adjustment stays free',()=>{assert.deepEqual(perpendicularPlaneDragValue(.05,{snap:true,step:10}),{value:0,snapped:true});assert.deepEqual(perpendicularPlaneDragValue(19.95,{snap:true,step:5}),{value:20,snapped:true});assert.deepEqual(perpendicularPlaneDragValue(-10.05,{snap:true,step:10}),{value:-10,snapped:true});assert.deepEqual(perpendicularPlaneDragValue(7.125,{snap:false,step:10}),{value:7.125,snapped:false});assert.deepEqual(perpendicularPlaneDragValue(10001),{value:10000,snapped:false});});

test('arbitrary angles rotate around the chosen face axis and keep a picked point on the working grid',()=>{
 const face={plane:'XY',offset:17,outer:[[10,20],[50,20],[50,50],[10,50]],holes:[]},before=JSON.stringify(face),anchor=[65,15,15];
 for(const axis of ['u','v'])for(const angle of [-180,-90,-45,0,22.5,45,90,180])for(const reverse of [false,true]){
  const s=perpendicularSketchPlane(face,{axis,angle,anchor,reverse}),b=basisFor(s.plane);validateFrame(s.plane.frame);
  near(s.origin.distanceTo(new THREE.Vector3(...anchor)),0);near(b.n.dot(s.origin),s.plane.offset);near(b.n.z,Math.cos(angle*Math.PI/180)*(reverse?-1:1));near(b[axis].dot(basisFor(face)[axis]),axis==='v'&&reverse?-1:1);
  const moved=perpendicularSketchPlane(face,{axis,angle,anchor,distance:7.5,reverse});near(moved.origin.distanceTo(s.origin.clone().addScaledVector(s.direction,7.5)),0);assert.deepEqual(moved.reference.toArray(),anchor);
 }
 assert.equal(JSON.stringify(face),before);
});
test('invalid angles and reference points cannot create a working grid',()=>{
 const face={plane:'XY',offset:0,outer:[[0,0],[20,0],[20,10],[0,10]],holes:[]};
 for(const angle of [NaN,Infinity,181,-181,'45'])assert.throws(()=>perpendicularSketchPlane(face,{angle}),/角度/);
 for(const anchor of [[1,2],[1,2,NaN],[1,2,100001],{},[1,'2',3]])assert.throws(()=>perpendicularSketchPlane(face,{anchor}),/点/);
});
