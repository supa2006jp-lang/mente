import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {BoxGeometry} from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {traceGeometryHistory} from '../src/geometry-history-trace.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));
const step=(id,outputs,spec,remove=[])=>({kind:'cadop',id,name:id,outputs,spec,remove});
const native=(id,shape)=>({id,...cadMesh(shape),brep:shape.serialize()});

test('CAD history finds the operation that created a narrow internal gap and follows a later move',()=>{
 const base=R.makeBox([0,0,0],[20,20,10]),tool=R.makeBox([9.9975,-1,2],[10.0025,21,11]),cut=base.cut(tool),moved=cut.clone().translate([50,-20,5]);
 try{
  const features=[step('base',[native('part',base)]),step('cut',[native('part',cut)],{type:'join',combineMode:'切り取り',target:'part'}),
   step('moved',[native('part',moved)],{type:'move',target:'part',x:50,y:-20,z:5})];
  const before=JSON.stringify(features);
  const result=runOperation(features,{type:'geometryHistoryTrace',target:'part',mode:'cad',codes:['micro-gap']});
  assert.equal(result.checked,3);
  assert.equal(result.partial,false);
  assert.ok(result.origins.length);
  for(const row of result.origins){
   assert.equal(row.featureId,'cut');assert.deepEqual(row.beforeIds,['part']);
   assert.ok(Math.abs(row.finding.size-.005)<1e-8);
  }
  assert.equal(JSON.stringify(features),before);
 }finally{base.delete();tool.delete();cut.delete();moved.delete();}
});

test('STL history separates unrelated openings and stops at a repaired step',()=>{
 const a=new BoxGeometry(10,10,10),b=new BoxGeometry(10,10,10).translate(30,0,0);
 try{
  const vertices=[...a.attributes.position.array,...b.attributes.position.array];
  const first=Array.from(a.index.array),second=Array.from(b.index.array,n=>n+a.attributes.position.count);
  const shape=(x,y)=>({id:'part',vertices,triangles:[...x,...y]});
  const features=[step('previous defect',[shape(first.slice(3),second)]),step('repaired',[shape(first,second)]),
   step('left opening',[shape(first.slice(3),second)]),step('right opening',[shape(first.slice(3),second.slice(3))])];
  const result=runOperation(features,{type:'geometryHistoryTrace',target:'part',mode:'stl',codes:['boundary']});
  assert.deepEqual(result.origins.map(row=>row.featureId),['left opening','right opening']);
  assert.ok(result.origins.every(row=>row.finding.segments.length===18&&!row.uncertain));
 }finally{a.dispose();b.dispose();}
});

test('join checks both source bodies and a budget limit cannot assert an origin',()=>{
 const shape=id=>({id});
 const features=[step('base',[shape('a')]),step('tool',[shape('b')]),step('join',[shape('a')],{type:'join',target:'a',other:'b'},['b'])];
 const inspect=node=>({findings:node.featureId==='base'?[]:[{code:'short-edge',size:.005,bounds:[[0,0,0],[.005,0,0]]}]});
 assert.equal(traceGeometryHistory(features,{target:'a'},inspect).origins[0].featureId,'tool');
 const limited=traceGeometryHistory(features,{target:'a'},inspect,null,{maxChecks:1});
 assert.ok(limited.partial);
 assert.ok(limited.origins[0].uncertain);
});

test('a mirrored copy follows the original defect location',()=>{
 const source=step('source',[{id:'source'}]),copy=step('mirror',[{id:'copy'}],{type:'mirror',target:'source',plane:'YZ'});
 copy.analysis={mirrors:[{bodyId:'source',outputId:'copy',action:'copied'}]};
 const result=traceGeometryHistory([source,copy],{target:'copy'},node=>{
  const x=node.id==='source'?8:-8;
  return {findings:[{code:'boundary',bounds:[[x,0,0],[x,1,0]],segments:[x,0,0,x,1,0]}]};
 });
 assert.equal(result.origins[0].featureId,'source');
 assert.equal(result.partial,false);
});
