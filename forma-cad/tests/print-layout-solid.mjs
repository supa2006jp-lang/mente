import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {check} from './print-layout.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=Array.from({length:4},(_,i)=>({...defaults,id:'b'+i,name:'ボディ'+i,kind:'extrusion',width:100,height:70,depth:10+i,z:i%2?-30:20,x:300+i*200,y:-600}));source.push({...defaults,id:'hidden',kind:'extrusion',name:'非表示のボディ',width:500,height:500,depth:10,x:800});
const spec={type:'printLayout',id:'plate',targets:source.slice(0,4).map(f=>f.id),margin:0,gap:0,allowRotation:true},input=JSON.stringify(source),result=runOperation(source,spec);assert.equal(JSON.stringify(source),input);check(result.analysis);assert.equal(result.outputs.length,4);assert.deepEqual(result.remove,[]);assert.ok(result.analysis.placements.some(p=>p.rotation===90));
const bodies=kernelBodies(source),after=kernelBodies([...source,{kind:'cadop',name:'印刷配置',id:'plate',spec,...result}]);
try{for(const p of result.analysis.placements){const shape=after.get(p.id),box=shape.boundingBox,valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());const [min,max]=box.bounds;assert.ok(min[0]>=-90-1e-5&&min[1]>=-90-1e-5&&max[0]<=90+1e-5&&max[1]<=90+1e-5);assert.ok(Math.abs(min[2])<1e-5);assert.ok(Math.abs(R.measureVolume(shape)-R.measureVolume(bodies.get(p.id)))<1e-5);}finally{box.delete();valid.delete();}}assert.equal(bodies.get('hidden').serialize(),after.get('hidden').serialize());}finally{for(const b of bodies.values())b.delete();for(const b of after.values())b.delete();}
validateProject({format:'forma-cad',version:1,features:[...source,{kind:'cadop',name:'印刷配置',id:'plate',spec,...result}]});assert.throws(()=>runOperation(source,{...spec,targets:['hidden']}),/超えています/);assert.throws(()=>runOperation(source,{...spec,targets:['missing']}),/見つかりません/);
const next=structuredClone(source);next[0].depth=15;const operation={kind:'cadop',name:'印刷配置',id:'plate',spec,...result};const replay=runOperation([...next,operation],{type:'replay',before:[...source,operation],start:0});check(replay.features.at(-1).analysis);assert.ok(Math.abs(replay.features.at(-1).analysis.placements[0].max[2]-15)<1e-5);
const circle=[{...defaults,id:'round',name:'円柱',kind:'extrusion',profile:'circle',diameter:60,depth:25,z:-5,x:-400}],round=runOperation(circle,{...spec,targets:['round'],margin:2,gap:3});check(round.analysis);
console.log('PASS native rigid solids, unchanged volumes/hidden body, floor/bounds, saved model, history replay and cylinder');
