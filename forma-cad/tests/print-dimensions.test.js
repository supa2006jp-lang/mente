import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {printDimensions} from '../src/print-dimensions.js';
import {runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
test('maximum XYZ extents use max minus min, independent of location',()=>{
 const result=printDimensions([{id:'box',min:[-100,50,-40],max:[20,80,5]}]);
 assert.deepEqual(result.size,[120,30,45]);assert.ok(result.fits);assert.deepEqual(result.dimensions.map(axis=>axis.remaining),[60,150,135]);
});
test('multiple bodies include their separation and expose all exceeded axes',()=>{
 const items=[{id:'a',min:[0,0,0],max:[20,20,20]},{id:'b',min:[160,100,40],max:[180,120,60]}];
 const result=printDimensions(items,[170,100,50]);assert.deepEqual(result.size,[180,120,60]);assert.equal(result.fits,false);assert.deepEqual(result.dimensions.map(axis=>axis.remaining),[-10,-20,-10]);
 assert.ok(printDimensions(items).fits,'exact capacity fits');assert.deepEqual(printDimensions([items[1]]).size,[20,20,20]);
 assert.deepEqual(items[0],{id:'a',min:[0,0,0],max:[20,20,20]},'measurement is read-only');
});
test('native curved bounds measure the full diameter after a non-tessellation-aligned rotation',()=>{
 const cylinder=R.makeCylinder(20,25).rotate(22.5,[0,0,0],[0,0,1]);
 const shape=R.makeBox([0,0,0],[40,20,10]).rotate(45,[0,0,0],[0,0,1]);
 try{
  const features=[{kind:'cadop',id:'source',outputs:[{id:'cylinder',brep:cylinder.serialize()},{id:'rotated',brep:shape.serialize()}],remove:[]}];
  const before=JSON.stringify(features),result=runOperation(features,{type:'printLayoutInfo',targets:['cylinder','rotated']});
  const curve=printDimensions(result.items.filter(item=>item.id==='cylinder'));curve.size.forEach((value,i)=>close(value,[40,40,25][i]));
  const rotated=printDimensions(result.items.filter(item=>item.id==='rotated'));close(rotated.size[0],60*Math.SQRT1_2);close(rotated.size[1],60*Math.SQRT1_2);close(rotated.size[2],10);
  assert.equal(JSON.stringify(features),before);
 }finally{cylinder.delete();shape.delete();}
});
test('invalid limits and invalid or missing bounds fail explicitly',()=>{
 const item={id:'box',min:[0,0,0],max:[10,10,10]};
 for(const limits of [[0,180,180],[180,NaN,180],[180,180],[180,180,10001]])assert.throws(()=>printDimensions([item],limits),/造形範囲/);
 for(const items of [[],[item,item]])assert.throws(()=>printDimensions(items),/ソリッド/);
 for(const invalid of [{...item,min:[NaN,0,0]},{...item,max:[-1,10,10]},{...item,min:[0,0]}])assert.throws(()=>printDimensions([invalid]),/外形寸法/);
});
