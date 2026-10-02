import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as THREE from 'three';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {defaults} from '../src/geometry.js';import {kernelBodies,runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box={...defaults,id:'b',width:40,height:40,depth:32.6,x:20,y:20},hole={...defaults,id:'h',hole:true,profile:'circle',operation:'cut',target:'b',diameter:10,x:20,y:20,z:Math.fround(32.6),depth:-Math.fround(32.6)-.01};
function intersections(mesh){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld();return new THREE.Raycaster(new THREE.Vector3(20,20,40),new THREE.Vector3(0,0,-1),0,50).intersectObject(m).map(h=>h.point.z);}
assert.equal(intersections(kernelBodies([box,hole]).get('b').mesh()).length,0);
const result=runOperation([box,hole],{type:'thread',target:'b',surfacePoint:[25,20,22],pitch:1.5,profile:'metric60',fullLength:false,offset:3,length:7});
assert.equal(intersections(result.outputs[0]).length,0,'Partial thread must not cap the through hole');
const blind=intersections(kernelBodies([box,{...hole,depth:-10}]).get('b').mesh());
assert.ok(blind.length>0);assert.ok(blind.every(z=>z<32.59),'Entrance remains open');
assert.ok(Math.abs(Math.max(...blind)-(hole.z-10))<.0001,'Blind hole floor depth stays unchanged');
console.log('PASS rounded face entry, offset internal thread opening and preserved blind floor');
