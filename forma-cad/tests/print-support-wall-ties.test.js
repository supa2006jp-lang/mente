import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as R from 'replicad';
import init from 'replicad-opencascadejs';
import {makeWallTies} from '../src/print-support-wall-ties.js';
import {printSupportDefaults} from '../src/print-support.js';

test('tall stacks of ties use each valid height when an obstruction interrupts the stack',async()=>{
 const wasm=new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url);
 R.setOC(await init({wasmBinary:await readFile(wasm)}));
 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const prism=hold(R.makeBox([0,0,0],[12,10,102]));
  const left=hold(R.makeBox([1.6,0,0],[2.4,10,101]));
  const right=hold(R.makeBox([9.6,0,0],[10.4,10,101]));
  const oneLevel=hold(R.makeBox([5,2.8,40.1],[7,3.8,41]));
  const between=hold(R.makeBox([5,2.8,46],[7,3.8,49]));
  const fins=[{id:'left',axis:0,center:2,shape:left},{id:'right',axis:0,center:10,shape:right}];
  const spec={...printSupportDefaults,wallPitch:8,tieInterval:20,layerHeight:.3};
  for(const [obstacle,count,skipped] of [[null,8,0],[oneLevel,7,1],[between,8,0]]){
   const bodies=new Map(obstacle?[['obstacle',obstacle]]:[]);
   const ties=makeWallTies(fins,prism,bodies,spec);
   ties.shapes.forEach(hold);
   assert.equal(ties.shapes.length,count);
   assert.equal(ties.skipped,skipped);
   assert.deepEqual(ties.levels,[20.1,40.2,60,80.1]);
   if(obstacle)for(const tie of ties.shapes){
    const collision=hold(tie.intersect(obstacle));
    assert(Math.abs(R.measureVolume(collision))<1e-8);
   }
  }
 }finally{owned.reverse().forEach(shape=>shape.delete());}
});
