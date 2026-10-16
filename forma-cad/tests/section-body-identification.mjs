import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sectionBodyColors,sectionBodyColor,sectionSelectionVisibility} from '../src/section-body-colors.js';
import {sectionBodyAnchor,sectionRetainedAnchor} from '../src/section-body-labels.js';

const original=new THREE.MeshStandardMaterial({color:0xabcdef,vertexColors:true,transparent:true,opacity:.7}),geometry=new THREE.BoxGeometry(4,4,4),a=new THREE.Mesh(geometry,original),b=new THREE.Mesh(geometry,original),meshes=new Map([['male',a],['female',b]]),sync=sectionBodyColors(),positions=Array.from(geometry.attributes.position.array);
let colors=sync(meshes,true);assert.notEqual(colors.get('male'),colors.get('female'));assert.notEqual(a.material,b.material,'shared source materials must still allow separate body colours');assert.equal(original.color.getHex(),0xabcdef);assert.equal(original.vertexColors,true);assert.equal(a.material.vertexColors,false);assert.equal(a.material.opacity,.7);
const material=a.material;sync(meshes,true);assert.equal(a.material,material,'moving the section must not allocate replacement materials');
let disposed=0;material.addEventListener('dispose',()=>disposed++);a.visible=false;const hiddenColors=sync(meshes,true);assert.equal(a.material,original);assert.equal(disposed,1);assert.equal(hiddenColors.get('female'),colors.get('female'),'visibility changes cannot change another body colour');
sync(meshes,false);assert.equal(b.material,original);assert.equal(original.transparent,true);assert.equal(original.vertexColors,true);assert.deepEqual(Array.from(geometry.attributes.position.array),positions);
a.visible=true;sync(meshes,true);sync(meshes,false);assert.equal(a.material,original);assert.equal(b.material,original);
assert.equal(new Set(Array.from({length:24},(_,i)=>sectionBodyColor(i))).size,24);
const overlay=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()),plane=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());plane.userData.planeId='construction';const group=new THREE.Group();group.add(overlay,plane);const visibility=sectionSelectionVisibility();visibility([group],true);assert.equal(overlay.material.visible,false);assert.equal(plane.material.visible,true);visibility([],true);assert.equal(overlay.material.visible,true);visibility([group],true);visibility([group],false);assert.equal(overlay.material.visible,true);

const ring=new THREE.RingGeometry(4,10,64),matrix=new THREE.Matrix4().makeTranslation(30,20,10),point=sectionBodyAnchor(ring,matrix);assert.ok(point);const radius=Math.hypot(point.x-30,point.y-20);assert.ok(radius>4&&radius<10,'the name leader must point into material rather than the hole');assert.equal(point.z,10);
const empty=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([],3));assert.equal(sectionBodyAnchor(empty,matrix),null);
a.updateWorldMatrix(true,false);assert.ok(sectionRetainedAnchor(a,new THREE.Plane(new THREE.Vector3(1,0,0),0)));assert.equal(sectionRetainedAnchor(a,new THREE.Plane(new THREE.Vector3(1,0,0),-10)),null,'fully clipped bodies must not get an on-screen label');
[geometry,ring,empty].forEach(g=>g.dispose());[original,overlay.material,plane.material].forEach(m=>m.dispose());
console.log('PASS distinct/stable colours, shared and QR material restoration, bounded temporary materials, selection visibility and name anchors on material rather than holes');
