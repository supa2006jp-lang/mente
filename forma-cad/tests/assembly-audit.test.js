import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {inspectAssemblyClearances} from '../src/assembly-contact.js';
import {runOperation} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));

test('unordered audit separates overlap, touch, near gap, containment and distant pairs',()=>{
 const shapes=new Map([
  ['base',R.makeBox([0,0,0],[10,10,10])],
  ['overlap',R.makeBox([8,1,1],[12,4,4])],
  ['touch',R.makeBox([0,10,0],[4,14,4])],
  ['gap',R.makeBox([0,0,11.5],[4,4,15])],
  ['inside',R.makeBox([2,2,2],[3,3,3])],
  ['far',R.makeBox([50,0,0],[51,1,1])],
 ]);
 try{
  const ids=[...shapes.keys()],all=inspectAssemblyClearances(ids,shapes);
  assert.equal(all.total,15);assert.equal(all.complete,true);
  assert.equal(new Set(all.rows.map(r=>[r.source,r.target].sort().join('/'))).size,all.rows.length);
  const target=inspectAssemblyClearances(ids,shapes,{against:['base']});
  const rows=new Map(target.rows.map(r=>[r.target,r]));
  assert.equal(target.total,5);assert.equal(target.pruned,1);
  assert.ok(Math.abs(rows.get('overlap').volume-18)<1e-8);
  assert.deepEqual(rows.get('overlap').bounds.map(p=>p.map(Math.round)),[[8,1,1],[10,4,4]]);
  assert.equal(rows.get('touch').status,'contact');
  assert.equal(rows.get('gap').distance,1.5);
  assert.ok(Math.abs(rows.get('inside').volume-1)<1e-8);
  assert.equal(inspectAssemblyClearances(ids,shapes,{against:['base'],gapLimit:1}).rows.some(r=>r.target==='gap'),false);
  assert.equal(inspectAssemblyClearances(ids,shapes,{maxPairs:1}).complete,false);
  const detail=inspectAssemblyClearances(['base','inside'],shapes,{gapLimit:0,preview:true});
  assert.equal(detail.rows[0].status,'interference');
  assert.ok(detail.highlight.triangles.length);
 }finally{for(const shape of shapes.values())shape.delete();}
});

test('overlapping bounds around an opening do not count as interference',()=>{
 const outer=R.makeBox([0,0,0],[20,20,20]),voidTool=R.makeBox([4,4,-1],[16,16,21]),shell=outer.cut(voidTool);
 const peg=R.makeBox([6,6,1],[14,14,19]);
 try{
  const result=inspectAssemblyClearances(['shell','peg'],new Map([['shell',shell],['peg',peg]]),{gapLimit:2});
  assert.equal(result.complete,true);
  assert.equal(result.rows[0].status,'gap');
  assert.equal(result.rows[0].distance,2);
 }finally{outer.delete();voidTool.delete();shell.delete();peg.delete();}
});

test('a mesh-only body remains untested without preventing checks on the other bodies',()=>{
 const shape=R.makeBox([0,0,0],[10,10,10]);
 try{
  const features=[
   {...defaults,id:'extrusion',kind:'extrusion',width:10,height:10,depth:10},
   {kind:'cadop',id:'native',outputs:[{id:'native',brep:shape.serialize(),...shape.mesh()}],remove:[]},
   {kind:'cadop',id:'mesh',outputs:[{id:'mesh',...shape.mesh()}],remove:[]},
  ];
  const source=JSON.stringify(features);
  const result=runOperation(features,{type:'assemblyAudit',targets:['extrusion','native','mesh']});
  assert.equal(result.total,3);assert.equal(result.checked,1);
  assert.deepEqual(result.unavailableIds,['mesh']);assert.equal(result.unavailable,2);assert.equal(result.complete,false);
  assert.equal(result.rows[0].status,'interference');
  assert.equal(JSON.stringify(features),source);
 }finally{shape.delete();}
});

test('face detail finds a mounting gap while a peg interferes in the same pair',()=>{
 const plate=R.makeBox([0,0,0],[20,20,10]),peg=R.makeBox([8,8,9],[12,12,12]),base=plate.fuse(peg);
 const lid=R.makeBox([0,0,11],[20,20,15]);
 try{
  const result=inspectAssemblyClearances(['base','lid'],new Map([['base',base],['lid',lid]]),{gapLimit:2,preview:true});
  assert.equal(result.rows[0].status,'interference');
  assert.ok(Math.abs(result.rows[0].volume-16)<1e-8);
  assert.ok(result.faceGaps.rows.some(gap=>Math.abs(gap.distance-1)<1e-8&&gap.area>300));
  assert.equal(result.faceGaps.partial,false);
 }finally{plate.delete();peg.delete();base.delete();lid.delete();}
});
