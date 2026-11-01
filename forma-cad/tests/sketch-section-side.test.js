import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {basisFor} from '../src/frames.js';import {sketchSectionReverse} from '../src/sketch-section-side.js';
test('working section hides the camera side for principal and tilted planes',()=>{
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.4,.5)),tilted={plane:'CUSTOM',frame:Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3().setComponent(i,1).applyQuaternion(q).toArray()]))};
 for(const face of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},tilted])for(const side of [-1,1]){
  const b=basisFor(face),camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,1000),point=new THREE.Vector3(10,20,30);camera.position.copy(point).addScaledVector(b.n,side*100);camera.up.copy(b.v);camera.lookAt(point);camera.updateMatrixWorld(true);
  const reverse=sketchSectionReverse(face,camera),plane=new THREE.Plane(b.n.clone().multiplyScalar(reverse?-1:1));plane.constant=-plane.normal.dot(point);
  assert.ok(plane.distanceToPoint(camera.position)<0);assert.ok(plane.distanceToPoint(point.clone().addScaledVector(b.n,-side*5))>0);assert.ok(Math.abs(plane.distanceToPoint(point))<1e-8);
 }
});
test('edge-on views retain the previous clipping side instead of flickering',()=>{
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,1000);camera.position.set(100,0,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 assert.equal(sketchSectionReverse({plane:'XY'},camera,true),true);assert.equal(sketchSectionReverse({plane:'XY'},camera,false),false);
});
