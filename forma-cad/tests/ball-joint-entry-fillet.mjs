import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {ballJointDefaults,ballJointSavedDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointEntryFilletDimensions} from '../src/ball-joint-entry-dimensions.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {cleanBinaryStl} from '../src/clean-stl.js';
import {binaryStlReport} from './stl-topology.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const info={radius:12,height:40},source={...defaults,id:'c',kind:'extrusion',name:'円柱',profile:'circle',diameter:24,depth:40},basic={...ballJointDefaults(info),type:'ballJoint',id:'joint',target:'c',pose:'assembled'};
assert.equal(basic.socketEntryFillet,.3);assert.equal(ballJointSavedDefaults(info).socketEntryFillet,0);
const missing={...basic};delete missing.socketEntryFillet;assert.equal(ballJointSettings(info,missing).socketEntryFillet,0,'legacy projects retain their unrounded entrance');
for(const radius of [5,7,12,20]){const i={radius,height:60},d=ballJointDefaults(i),s=ballJointSettings(i,d);assert.ok(d.socketEntryFillet>0&&d.socketEntryFillet<=.3);const e=ballJointEntryFilletDimensions(s);assert.ok(s.core-s.coneDepth-e.entryRadius>=1.2-1e-7);assert.ok(e.entryRadius-e.radius<s.r,'rounded throat still captures the ball');}
for(const value of [-.1,.7,NaN,Infinity])assert.throws(()=>ballJointSettings(info,{...basic,socketEntryFillet:value}),/丸み/);
assert.throws(()=>ballJointSettings(info,{...basic,socketEntryFillet:.6}),/肉厚/);
assert.throws(()=>ballJointSettings(info,{...basic,ballDiameter:6,neckDiameter:2,wall:10,socketEntryFillet:.6}),/抜け止め/);
const volume=shape=>Math.abs(R.measureVolume(shape));
for(const [socketInset,slotCount] of [[0,4],[.2,6]]){
 const beforeSpec={...basic,socketInset,slotCount,socketEntryFillet:0},afterSpec={...beforeSpec,socketEntryFillet:.3},before=runOperation([source],beforeSpec),after=runOperation([source],afterSpec),a=before.outputs.map(o=>R.deserializeShape(o.brep).asShape3D()),b=after.outputs.map(o=>R.deserializeShape(o.brep).asShape3D()),s=ballJointSettings(info,afterSpec),d=ballJointEntryFilletDimensions(s);
 try{
  for(const i of [0,2]){const first=a[i].cut(b[i]),second=b[i].cut(a[i]);try{assert.ok(volume(first)+volume(second)<1e-5,'existing ball and nut are unchanged');}finally{first.delete();second.delete();}}
  const added=b[1].cut(a[1]),removed=a[1].cut(b[1]),above=R.makeBox([-50,-50,d.contact[1]+.001],[50,50,100]),elsewhere=removed.intersect(above);
  try{assert.ok(volume(added)<1e-5,'rounding only removes material');assert.ok(volume(removed)>.1,'entrance has a real geometric fillet');assert.ok(volume(elsewhere)<1e-5,'deep spherical seat, collet and threads are unchanged');}finally{added.delete();removed.delete();above.delete();elsewhere.delete();}
  const faces=b[1].faces;try{assert.ok(faces.some(f=>f.geomType==='TORUS'),'circular fillet produces a true toroidal entrance');}finally{faces.forEach(f=>f.delete());}
  assert.ok(after.analysis.overlap.every(v=>v<1e-5));assert.equal(after.analysis.socketEntryFillet,.3);
  for(const key of ['effectiveBallClearance','contactTravel','clampingTravel','availableTravel','threadPitch','engagedTurns'])assert.equal(after.analysis[key],before.analysis[key],key+' is unchanged');
  for(const shape of b)assert.ok(solidMeshComplete(shape));
  const o=after.outputs[1],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);const mesh=new THREE.Mesh(g);mesh.updateMatrixWorld(true);
  try{const report=binaryStlReport(cleanBinaryStl(new STLExporter().parse(mesh,{binary:true})));for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[k],0,'rounded socket STL '+k);}finally{g.dispose();mesh.material.dispose();}
  if(socketInset===0){const legacySpec={...beforeSpec};delete legacySpec.socketEntryFillet;validateProject({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'joint',name:'ボール接合',spec:legacySpec,...before}]});await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/socket-entry-legacy-project.json',JSON.stringify({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'joint',name:'ボール接合',spec:legacySpec,...before}]}));}
  console.log('PASS mouth R0.3, inset',socketInset,'slots',slotCount,'only entrance is relieved, old ball/nut and deep seat retained, closed STL');
 }finally{[...a,...b].forEach(p=>p.delete());}
}
console.log('PASS entrance radius defaults, legacy preservation, small-joint wall guard and persisted fillet');
