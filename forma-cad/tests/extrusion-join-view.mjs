import assert from 'node:assert/strict';
import * as THREE from 'three';
import {extrusionJoinBodies,joinDisplayMaterials} from '../src/extrusion-join-view.js';

const plan={bodyIds:['a','b','c'],entries:[{index:0,sourceId:'a',destinationId:'c'}]},entries=extrusionJoinBodies(plan,id=>'<'+id+'>');
assert.deepEqual(entries.map(e=>e.role),['押し出し元','途中・側面の接触','押し出し先']);assert.equal(new Set(entries.map(e=>e.color)).size,3);assert.equal(extrusionJoinBodies(plan,id=>id,{0:'b'})[1].role,'押し出し先');
const original=new THREE.MeshStandardMaterial({color:0xabcdef,vertexColors:true,transparent:true,opacity:.4}),a=new THREE.Mesh(undefined,original),b=new THREE.Mesh(undefined,[original,original]),sweep=new THREE.Mesh(undefined,original),view=joinDisplayMaterials();
const before=original.toJSON();view.paint(a,entries[0].color,{bodyId:'a'});view.paint(b,entries[1].color,{bodyId:'b'});view.paint(sweep,'#20bfc6',{sweep:true});assert.notEqual(a.material,b.material[0]);assert.equal(a.material.vertexColors,false);assert.equal(a.material.opacity,1);assert.equal(sweep.material.opacity,.4);assert.deepEqual(original.toJSON(),before);
view.focus('b');assert.equal(a.material.emissiveIntensity,0);assert.equal(b.material[0].emissiveIntensity,.5);view.focus(null);assert.equal(b.material[0].emissiveIntensity,0);
view.selection(new Set(['a']));assert.equal(b.material[0].opacity,.18);assert.equal(b.material[0].transparent,true);assert.equal(a.material.opacity,1);assert.equal(sweep.material.opacity,.4);view.selection(new Set(['a','b']));assert.equal(b.material[0].opacity,1);assert.equal(b.material[0].transparent,false);
let disposed=0;for(const material of [a.material,...b.material,sweep.material])material.addEventListener('dispose',()=>disposed++);view.restore();assert.equal(a.material,original);assert.deepEqual(b.material,[original,original]);assert.equal(sweep.material,original);assert.deepEqual(original.toJSON(),before);assert.equal(disposed,4);view.restore();assert.equal(disposed,4);original.dispose();
console.log('PASS join roles/destinations, distinct body colours, shared/QR material isolation, linked focus, sweep opacity and exact restoration without leaks');
