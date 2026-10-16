import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sectionFaceView} from '../src/section-face-view.js';
const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,1000);camera.up.set(0,0,1);camera.position.set(140,-180,150);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.zoom=2;
const snapshot=camera.matrixWorld.toArray(),center=new THREE.Vector3(20,30,40),distance=280;
for(const [plane,n] of [['XY',[0,0,1]],['XZ',[0,1,0]],['YZ',[1,0,0]]])for(const sign of [1,-1]){
 const normal=new THREE.Vector3(...n),outward=normal.clone().multiplyScalar(sign),face={plane,cadFace:{normal:outward.toArray()}},offset=center.dot(normal)+2;
 const view=sectionFaceView(face,normal,offset,camera,center,distance);
 assert.ok(Math.abs(view.position.distanceTo(view.target)-distance)<1e-8);
 assert.ok(view.position.clone().sub(view.target).normalize().distanceTo(outward)<1e-8,'selected face side overrides the previous camera');
 assert.ok(Math.abs(view.target.dot(normal)-offset)<1e-8);assert.equal(view.reverse,sign>0);
 assert.ok(Math.abs(view.up.dot(outward))<1e-8);
 const clip=new THREE.Plane(normal.clone().multiplyScalar(view.reverse?-1:1),(view.reverse?1:-1)*offset);
 assert.ok(clip.distanceToPoint(view.position)<0,'the selected face side is removed so the cut is visible');
}
const n=new THREE.Vector3(1,2,3).normalize(),u=new THREE.Vector3(1,0,0).addScaledVector(n,-n.x).normalize(),v=n.clone().cross(u),frame={u:u.toArray(),v:v.toArray(),n:n.toArray()};
const slanted=sectionFaceView({plane:'CUSTOM',frame},n,15,camera,center,distance);assert.ok(slanted.position.clone().sub(slanted.target).normalize().distanceTo(n)<1e-8);assert.equal(slanted.reverse,true);assert.ok(Math.abs(slanted.up.dot(n))<1e-8);
assert.equal(sectionFaceView(null,n,0,camera,center,distance),null);assert.equal(sectionFaceView({plane:'XY',cadFace:{normal:[0,0,0]}},n,0,camera,center,distance),null);
assert.equal(camera.zoom,2);assert.deepEqual(camera.matrixWorld.toArray(),snapshot,'planning a view does not mutate the camera');
console.log('PASS selected positive/negative XYZ and slanted face viewpoints, visible cut side, centered section, stable distance/up and no-face fallback');
