import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {faceMoveContact} from '../src/face-move-contact.js';
const box=()=>new THREE.Mesh(new THREE.BoxGeometry(2,2,2));
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('all six face normals find nearest surface and preserve original objects',()=>{
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const source=box(),wall=box(),far=box(),n=[0,0,0];n[axis]=sign;wall.position.setComponent(axis,sign*8);far.position.setComponent(axis,sign*12);
  const hit=faceMoveContact(source,[source,far,wall],n);assert.equal(hit.mesh,wall);near(hit.distance,6);hit.translation.forEach((v,i)=>near(v,i===axis?sign*6:0));assert.deepEqual(source.position.toArray(),[0,0,0]);assert.equal(source.geometry.attributes.position.count,24);
 }
});
test('arbitrary face normals and parent transforms',()=>{
 const source=box(),wall=box(),parent=new THREE.Group(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/6);parent.quaternion.copy(q);parent.position.set(11,6,3);parent.add(source,wall);wall.position.x=8;
 const n=new THREE.Vector3(1,0,0).applyQuaternion(q),hit=faceMoveContact(source,[wall],n.toArray());near(hit.distance,6);hit.translation.forEach((v,i)=>near(v,n.getComponent(i)*6));
});
test('no forward obstacle, hidden, transverse, already touching and invalid directions hide action',()=>{
 const source=box(),wall=box();wall.position.x=-8;assert.equal(faceMoveContact(source,[wall],[1,0,0]),null);wall.position.set(8,8,0);assert.equal(faceMoveContact(source,[wall],[1,0,0]),null);wall.position.y=0;wall.visible=false;assert.equal(faceMoveContact(source,[wall],[1,0,0]),null);wall.visible=true;wall.position.x=2;assert.equal(faceMoveContact(source,[wall],[1,0,0]),null);assert.equal(faceMoveContact(source,[wall],[0,0,0]),null);assert.equal(faceMoveContact(source,[wall],[NaN,0,0]),null);
});
test('real hollow surface and oblique approach',()=>{
 const shape=new THREE.Shape();shape.moveTo(-3,-3);shape.lineTo(3,-3);shape.lineTo(3,3);shape.lineTo(-3,3);shape.closePath();const hole=new THREE.Path();hole.moveTo(-1,-1);hole.lineTo(-1,1);hole.lineTo(1,1);hole.lineTo(1,-1);hole.closePath();shape.holes.push(hole);
 const wall=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}));wall.position.z=5;const source=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5));assert.equal(faceMoveContact(source,[wall],[0,0,1]),null);
 source.position.set(0,0,5.5);near(faceMoveContact(source,[wall],[1,0,0]).distance,.75);
});
