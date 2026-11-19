import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {defaults,makeGeometry,rebuild,validateProject,volume} from '../src/geometry.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {containedUnion} from '../src/solid-contained-union.js';
import {extrusionIntersections} from '../src/extrusion-auto-cut.js';
import {extrusionProbeBodies,meshExtrusionProbe} from '../src/extrusion-mesh-probe.js';
import {combinePreviewMeshes,meshCombinePreview} from '../src/combine-mesh-preview.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));

function assertNear(actual,expected,tolerance=1e-6){
 assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
}

test('join preview and commit accept a thin rotated solid far from the origin',()=>{
 const position=[99972.11,99923.457,99977.883];
 const placedBox=(min,max)=>R.makeBox(min,max).rotate(23,[0,0,0],[1,2,3]).translate(position);
 const boxes=[placedBox([-.1,-.2,0],[10,.24,.1166]),placedBox([9,-.2,0],[22.031,.24,.1166])];
 try{
  const outputs=boxes.map((shape,i)=>({id:i?'tool':'target',...cadMesh(shape),brep:serializeCadShape(shape)}));
  const features=[{id:'seed',name:'Translated bodies',kind:'cadop',outputs,remove:[]}];
  const snapshot=JSON.stringify(features);
  const spec={type:'join',id:'joined',target:'target',other:'tool',combineMode:'結合',keepTools:'削除'};
  const expectedVolume=22.131*.44*.1166;
  const preview=runOperation(features,{type:'preview',operation:spec});
  const result=runOperation(features,spec);
  for(const {outputs,remove} of [preview,result]){
   assert.deepEqual(remove,['tool']);
   assert.equal(outputs[0].shapeMetrics.solids,1);
   assertNear(outputs[0].shapeMetrics.volume,expectedVolume);
  }
  const saved=JSON.parse(JSON.stringify({format:'forma-cad',version:1,
   features:[...features,{kind:'cadop',id:spec.id,name:'Join',spec,...result}]}));
  const bodies=kernelBodies(validateProject(saved));
  try{
   assert.deepEqual([...bodies.keys()],['target']);
   assertNear(R.measureVolume(bodies.get('target')),expectedVolume);
  }finally{bodies.forEach(shape=>shape.delete());}
  assert.equal(JSON.stringify(features),snapshot);
 }finally{boxes.forEach(shape=>shape.delete());}
});

test('the fallback for completely contained solids accepts a valid thin container',()=>{
 const outer=R.makeBox([8123.123,8400.01,9000.0001],[8153.123,8400.11,9002.5001]);
 const inner=R.makeBox([8124.123,8400.03,9000.2001],[8126.123,8400.09,9001.5001]);
 const inputs=[outer,inner];
 const measures=shape=>{
  const box=shape.boundingBox;
  try{return {bounds:box.bounds,volume:R.measureVolume(shape)};}
  finally{box.delete();}
 };
 const before=inputs.map(measures);
 let result;
 try{
  result=containedUnion(inputs,before.map(record=>record.volume));
  assert.ok(result);
  assertNear(measures(result).volume,7.5);
  assert.deepEqual(measures(result).bounds,before[0].bounds);
  assert.deepEqual(inputs.map(measures),before);
 }finally{result?.delete();inputs.forEach(shape=>shape.delete());}
});

test('inner taper retains the requested depth at a high offset in both directions',()=>{
 const offset=9000.123456;
 const region={id:'outline',plane:'XY',offset,outer:[[0,0],[20,0],[20,18],[0,18]],
  holes:[[[4,4],[4,14],[16,14],[16,4]]],area:240,sourceIds:[]};
 for(const depth of [.14327,-.14327]){
  const feature={...defaults,id:'taper',name:'Taper',kind:'extrusion',profile:'region',region,
   z:offset,depth,taperMode:'inner',taperAngle:7};
  const preview=runOperation([],{type:'exactExtrusionPreview',features:[feature]});
  const committed=runOperation([],{type:'extrusionBatch',features:[feature]});
  for(const {features} of [preview,committed]){
   const [min,max]=features[0].cadResult.outputs[0].shapeMetrics.bounds;
   assertNear(min[2],Math.min(offset,offset+depth));
   assertNear(max[2],Math.max(offset,offset+depth));
  }
 }
});

test('extrusion detection and combine preview retain a narrow overlap after translation',()=>{
 const x=9000;
 const target={...defaults,id:'base',width:10,height:10,depth:8,x};
 const tool={...defaults,id:'tool',width:10,height:6,depth:4,z:2,x:x+9.9998};
 const bodies=rebuild([target]),base=bodies.get('base'),profile=new THREE.Mesh(makeGeometry(tool));
 let overlap;
 try{
  const local=extrusionIntersections(tool,bodies);
  const worker=meshExtrusionProbe({feature:tool,bodies:extrusionProbeBodies(bodies)});
  const expectedVolume=.0002*6*4;
  assert.deepEqual(local.map(hit=>hit.id),['base']);
  assertNear(local[0].volume,expectedVolume,1e-5);
  assert.deepEqual(worker.matches,local);
  assert.deepEqual(extrusionIntersections({...tool,x:x+10},bodies),[]);
  const result=meshCombinePreview({bodies:combinePreviewMeshes(base,[profile])});
  overlap=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(result.positions,3));
  if(result.indices)overlap.setIndex(Array.from(result.indices));
  assertNear(volume(overlap),expectedVolume,1e-5);
  const box=new THREE.Box3().setFromBufferAttribute(overlap.attributes.position)
   .applyMatrix4(new THREE.Matrix4().fromArray(result.matrix));
  assertNear(box.min.x,9004.9998);
  assertNear(box.max.x,9005);
 }finally{
  overlap?.dispose();
  for(const mesh of [base,profile]){mesh.geometry.dispose();mesh.material.dispose();}
 }
});
