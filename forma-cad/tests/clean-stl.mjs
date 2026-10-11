import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import * as THREE from 'three';import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import * as R from 'replicad';
import {cleanBinaryStl} from '../src/clean-stl.js';import {saveStl} from '../src/save-stl.js';
import {binaryStlReport} from './stl-topology.mjs';import {defaults} from '../src/geometry.js';import {runOperation} from '../src/kernel.js';import {ballJointDefaults} from '../src/ball-joint-settings.js';
function binary(triangles){const v=new DataView(new ArrayBuffer(84+triangles.length*50));v.setUint32(80,triangles.length,true);triangles.forEach((p,i)=>p.flat().forEach((x,j)=>v.setFloat32(96+i*50+j*4,x,true)));return v;}
const triangle=[[0,0,0],[1,0,0],[0,1,0]],collapsed=[[0,0,0],[1,0,0],[0,0,0]],collinear=[[0,0,0],[1,1,1],[2,2,2]];
const raw=binary([triangle,collapsed,collinear]);raw.setUint8(0,42);raw.setUint16(132,17,true);
const fixed=cleanBinaryStl(raw);assert.equal(fixed.getUint32(80,true),1);assert.equal(fixed.getUint8(0),42);assert.equal(fixed.getUint16(132,true),17);assert.deepEqual(new Uint8Array(fixed.buffer,84),new Uint8Array(raw.buffer,84,50));
assert.equal(cleanBinaryStl(fixed),fixed,'valid facets are not copied or modified');
const offsetBuffer=new Uint8Array(raw.byteLength+15);offsetBuffer.set(new Uint8Array(raw.buffer),7);assert.equal(cleanBinaryStl(offsetBuffer.subarray(7,7+raw.byteLength)).getUint32(80,true),1);
assert.throws(()=>cleanBinaryStl(binary([collapsed])),/面がありません/);assert.throws(()=>cleanBinaryStl(new DataView(new ArrayBuffer(20))),/不完全/);
const corrupt=binary([triangle]);corrupt.setFloat32(96,NaN,true);assert.throws(()=>cleanBinaryStl(corrupt),/不正な頂点/);
// Float32 can collapse a facet that was nondegenerate in double precision.
assert.equal(cleanBinaryStl(binary([triangle,[[1,1,1],[1+1e-9,1,1],[1,2,1]]])).getUint32(80,true),1);
// A small but real face must survive; no geometric tolerance or rounding is used.
const tiny=binary([[[0,0,0],[1e-8,0,0],[0,1e-8,0]]]);assert.equal(cleanBinaryStl(tiny),tiny);
let written,downloaded;globalThis.window={showSaveFilePicker:async()=>({createWritable:async()=>({write:async d=>{written=d;},close:async()=>{}})})};await saveStl(()=>raw,()=>assert.fail());assert.equal(written.getUint32(80,true),1);
window={prompt:()=> 'fixed'};await saveStl(async()=>raw,d=>{downloaded=d;});assert.equal(downloaded.getUint32(80,true),1);
console.log('PASS exact facet cleanup, unchanged tiny/valid faces, view offsets, malformed input and both save paths');
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function exportParts(outputs){const group=new THREE.Group();for(const o of outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);group.add(new THREE.Mesh(g));}group.updateMatrixWorld(true);try{return new STLExporter().parse(group,{binary:true});}finally{group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}}
await fs.mkdir('.sites-runtime',{recursive:true});
const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:40},info=runOperation([source],{type:'ballJointInfo',target:'c'}).analysis;
for(const bent of [false,true]){
 const spec={...ballJointDefaults(info),type:'ballJoint',id:'joint',target:'c',pose:'print',neckBend:bent,neckExtension:bent?15:0,neckBaseTilt:bent},result=runOperation([source],spec);
 for(const [i,output]of result.outputs.entries()){
  const raw=exportParts([output]),fixed=cleanBinaryStl(raw),before=binaryStlReport(raw),after=binaryStlReport(fixed);
  if(!i)assert.ok(before.degenerate>0&&before.nonmanifold>0,'reproduce CAD pole seam defect');
  for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(after[k],0,k+' '+result.analysis.roles[i]);
  assert.ok(Math.abs(before.volume-after.volume)<1e-8);console.log('PASS closed STL', {bent,role:result.analysis.roles[i],removed:before.triangles-after.triangles});
 }
 const combined=binaryStlReport(cleanBinaryStl(exportParts(result.outputs)));for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(combined[k],0,'three-part export '+k);
 await fs.writeFile('.sites-runtime/stl-joint-project-'+bent+'.json',JSON.stringify({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'joint',name:'ボールジョイント',spec,...result}]}));
}
