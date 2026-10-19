import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {headedThreadSeed} from './continuous-thread-fixture.mjs';
import {runOperation} from '../src/kernel.js';
import {rebuild} from '../src/geometry.js';
import {sectionSegments,sectionCap} from '../src/section-view.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const seed=headedThreadSeed(),spec={type:'thread',target:'bolt',surfacePoint:[5,0,30],profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,leftHand:false,designation:'M10 × 1.5'},result=runOperation([seed],spec);
const features=[seed,{kind:'cadop',id:'thread',name:'M10ねじ',spec,...result}],before=JSON.stringify(features),shape=R.deserializeShape(result.outputs[0].brep).asShape3D(),valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
assert.ok(valid.IsValid());assert.equal(shape.solids.length,1);valid.delete();
const core=R.makeCylinder(3.5,39.8,[0,0,10.1]),inside=shape.intersect(core),expected=Math.PI*3.5**2*39.8;assert.ok(Math.abs(R.measureVolume(inside)-expected)<1e-4,'the actual CAD thread contains its complete solid core');inside.delete();core.delete();shape.delete();
const bodies=rebuild(features),mesh=bodies.get('bolt'),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});let sections=0;
for(const normal of [[1,0,0],[0,1,0],[.61,.79,0]])for(const offset of [0,.013]){
 const n=new THREE.Vector3(...normal).normalize(),plane=new THREE.Plane(n,-offset),cap=sectionCap(sectionSegments(mesh.geometry,plane),plane),fill=new THREE.Mesh(cap,material);fill.updateMatrixWorld();assert.ok(cap.attributes.position.count>0);
 const tangent=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,0,1)).normalize();
 for(let z=.25;z<50;z+=.5)for(const x of [-3,0,3]){const point=tangent.clone().multiplyScalar(x).addScaledVector(n,offset);point.z=z;const hits=new THREE.Raycaster(point.clone().addScaledVector(n,10),n.clone().negate()).intersectObject(fill);assert.ok(hits.length,'solid core missing at '+JSON.stringify({normal,offset,x,z}));}
 cap.dispose();sections++;
}
for(const body of bodies.values())body.geometry.dispose();material.dispose();assert.equal(JSON.stringify(features),before,'section calculation never modifies CAD or saved mesh data');
await fs.writeFile('.sites-runtime/section-thread-cap-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));
const proof={diameter:10,length:40,pitch:1.5,validSolid:true,completeSolidCore:true,coreVolume:expected,displaySections:sections,coreSamples:sections*100*3,sourceUnchanged:true};console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/section-thread-cap-native-proof.json',JSON.stringify(proof,null,2));
