import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {finishCadSteps} from '../src/cad-steps.js';
import {supportNonDestructiveBoolean} from '../src/print-support-boolean.js';
import {createPrintSupportCache} from '../src/print-support-cache.js';
import {supportLocalPreview} from '../src/print-support-local-preview.js';

function assertSameSolid(expected,actual){
 for(const [source,tool] of [[expected,actual],[actual,expected]]){
  const difference=supportNonDestructiveBoolean('cut',source,tool);
  try{assert(Math.abs(R.measureVolume(difference))<1e-7);}
  finally{difference.delete();}
 }
}

test('grouped contact cuts preserve each rib, including touching and split ribs',async()=>{
 R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const straight=R.makeBox([0,0,0],[10,2,6]);
 const touching=R.makeBox([0,2,0],[10,4,5]);
 const block=R.makeBox([0,7,0],[10,11,6]);
 const hole=R.makeCylinder(1,8,[7.5,9,-1]);
 const curved=supportNonDestructiveBoolean('cut',block,hole);
 const ribs=[straight,touching,curved],records=ribs.map(shape=>({shape}));
 const source=R.makeCompound(ribs.map(rib=>rib.clone()));
 const mask=R.makeBox([3,-1,-1],[4,12,7]);
 const top=R.makeBox([6,-1,4.8],[6.5,12,6.1]);
 const masks=[mask,top];
 const recipes=new Map([[mask,'split'],[top,'top-groove']]);
 const local=supportLocalPreview(source,masks,recipes);
 const expected=[],restored=[];
 try{
  ribs.forEach(rib=>expected.push(local.clip(rib,{contained:true})));
  // Preview jobs restore their inputs from a CAD snapshot.
  ribs.forEach(rib=>restored.push(R.deserializeShape(rib.serialize()).asShape3D()));
  const checked=[];
  const cache=createPrintSupportCache(400_000,12);
  const mesh=finishCadSteps(local.meshSteps(records,{
   contained:true,cache,
   meshShape(shape){
    assertSameSolid(expected[checked.length],shape);
    const result=shape.mesh();
    assert(result.triangles.length>0);
    checked.push(result);
    return result;
   },
  }));
  assert.deepEqual(mesh,checked);
  assert.equal(checked.length,records.length);
  const repeated=finishCadSteps(local.meshSteps(restored.map(shape=>({shape})),{
   contained:true,cache,meshShape(){assert.fail('the same rib and grooves should reuse the mesh');},
  }));
  assert.deepEqual(repeated,mesh);
 }finally{
  local.delete();
  [...expected,...restored,source,block,hole,...ribs,...masks].forEach(shape=>shape.delete());
 }
});
