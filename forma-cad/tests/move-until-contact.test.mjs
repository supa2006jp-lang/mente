import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {firstMoveContact} from '../src/move-until-contact.js';

const box=(size=[2,2,2])=>new THREE.Mesh(new THREE.BoxGeometry(...size));
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('first actual contact on all six world directions; nearest target wins',()=>{
 for(let axis=0;axis<3;axis++)for(const direction of [-1,1]){
  const moving=box(),far=box(),target=box(),miss=box();far.position.setComponent(axis,direction*20);target.position.setComponent(axis,direction*7);miss.position.setComponent(axis,direction*4);miss.position.setComponent((axis+1)%3,10);
  const hit=firstMoveContact(moving,[far,miss,target],axis,direction);assert.equal(hit.mesh,target);near(hit.distance,direction*5);
 }
});
test('missing, hidden, transverse and behind targets do not move',()=>{
 const moving=box(),target=box();target.position.set(-5,0,0);assert.equal(firstMoveContact(moving,[],0,1),null);assert.equal(firstMoveContact(moving,[target],0,1),null);target.position.set(5,9,0);assert.equal(firstMoveContact(moving,[target],0,1),null);target.position.y=0;target.visible=false;assert.equal(firstMoveContact(moving,[target],0,1),null);
});
test('existing forward contact stops at zero, while moving away is possible',()=>{
 const moving=box(),touching=box(),ahead=box();touching.position.x=2;ahead.position.x=10;near(firstMoveContact(moving,[ahead,touching],0,1).distance,0);touching.position.x=-2;near(firstMoveContact(moving,[touching,ahead],0,1).distance,8);
});
test('hole passage has no false AABB collision and cavity walls are forward contacts',()=>{
 const shape=new THREE.Shape();shape.moveTo(-3,-3);shape.lineTo(3,-3);shape.lineTo(3,3);shape.lineTo(-3,3);shape.closePath();const hole=new THREE.Path();hole.moveTo(-1,-1);hole.lineTo(-1,1);hole.lineTo(1,1);hole.lineTo(1,-1);hole.closePath();shape.holes.push(hole);
 const ring=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}));ring.position.z=5;const moving=box([.5,.5,.5]);assert.equal(firstMoveContact(moving,[ring],2,1),null);moving.position.set(0,0,5.5);near(firstMoveContact(moving,[ring],0,1).distance,.75);near(firstMoveContact(moving,[ring],0,-1).distance,-.75);
});
test('sloped surfaces, rigid groups, reflected transforms and translation changes',()=>{
 const moving=box([.2,.2,.4]),target=box();moving.position.set(-3,0,1);target.rotation.y=Math.PI/4;near(firstMoveContact(moving,[target],0,1).distance,.8-Math.SQRT2+2.9);
 const group=new THREE.Group(),a=box(),b=box(),wall=box();b.position.y=8;group.add(a,b);wall.position.set(7,8,0);near(firstMoveContact(group,[wall],0,1).distance,5);group.position.x=1;near(firstMoveContact(group,[wall],0,1).distance,4);group.position.y=30;assert.equal(firstMoveContact(group,[wall],0,1),null);
 const reflected=box();reflected.scale.x=-1;const other=box();other.position.x=7;near(firstMoveContact(reflected,[other],0,1).distance,5);
});
