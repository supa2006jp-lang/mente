import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {contactTranslation} from '../src/move-contact-geometry.js';

const box=(size=[2,2,2])=>new THREE.Mesh(new THREE.BoxGeometry(...size));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} ≠ ${expected}`);

test('contacts the leading face in both world-axis directions',()=>{
 const moving=box(),target=box();target.position.x=5;
 near(contactTranslation(moving,target,0,1),3);
 target.position.x=-5;
 near(contactTranslation(moving,target,0,-1),-3);
 assert.equal(contactTranslation(moving,target,0,1),null);
});

test('contact follows axis dragging without a stale cached position',()=>{
 const moving=new THREE.Group();moving.add(box());
 const target=box();target.position.z=5;
 near(contactTranslation(moving,target,2,1),3);
 moving.position.z=1.25;
 near(contactTranslation(moving,target,2,1),1.75);
 moving.position.x=6;
 assert.equal(contactTranslation(moving,target,2,1),null);
});

test('a hole and transverse misses do not snap to outer bounding box',()=>{
 const shape=new THREE.Shape();
 shape.moveTo(-3,-3);shape.lineTo(3,-3);shape.lineTo(3,3);shape.lineTo(-3,3);shape.closePath();
 const hole=new THREE.Path();
 hole.moveTo(-1,-1);hole.lineTo(-1,1);hole.lineTo(1,1);hole.lineTo(1,-1);hole.closePath();
 shape.holes.push(hole);
 const target=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}));target.position.z=5;
 const moving=box([.5,.5,1]);
 assert.equal(contactTranslation(moving,target,2,1),null);
 moving.position.x=2;
 near(contactTranslation(moving,target,2,1),4.5);
 moving.position.x=8;
 assert.equal(contactTranslation(moving,target,2,1),null);
});

test('contact on a sloping face uses its local height rather than AABB front',()=>{
 const moving=box([.2,.2,.4]);moving.position.set(-3,0,1);
 const target=box();target.rotation.y=Math.PI/4;
 // At z=0.8, the rotated cube's first surface is x=z-sqrt(2).
 const expected=(.8-Math.SQRT2)-(-2.9);
 near(contactTranslation(moving,target,0,1),expected);
});
