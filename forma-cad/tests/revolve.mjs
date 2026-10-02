import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {runOperation} from '../src/kernel.js';import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const spec={type:'revolve',id:'r',region:{plane:'XY',offset:0,outer:[[0,0],[10,0],[10,20],[0,20]],holes:[]},origin:[0,0,0],axisVector:[0,1,0],angle:360,direction:'片側',operation:'new'};
const volume=result=>{const s=R.deserializeShape(result.outputs[0].brep).asShape3D();const v=R.measureVolume(s);s.delete();return v;};
for(const angle of [90,180,360])for(const direction of ['片側','逆方向','対称'])assert.ok(Math.abs(volume(runOperation([],{...spec,angle,direction}))-Math.PI*100*20*angle/360)<.001);
const box={...defaults,id:'b',width:40,height:40,depth:40,y:10,z:-20};const cut=runOperation([box],{...spec,target:'b',operation:'cut'});assert.ok(Math.abs(volume(cut)-(64000-Math.PI*2000))<.01);
assert.throws(()=>runOperation([],{...spec,axisVector:[0,0,1]}),/平面/);assert.throws(()=>runOperation([],{...spec,angle:0}),/角度/);assert.throws(()=>runOperation([],{...spec,origin:[5,0,0]}),/横切/);console.log('PASS revolve volume, 90/180/360, reverse/symmetric, cut, invalid axes');

const small={...defaults,id:'b',width:2,height:20,depth:2,x:5,y:10,z:-1};assert.ok(Math.abs(volume(runOperation([small],{...spec,target:'b',operation:'join'}))-Math.PI*2000)<.01);
const hole={...spec.region,outer:[[2,0],[10,0],[10,20],[2,20]],holes:[]};assert.ok(Math.abs(volume(runOperation([],{...spec,region:hole}))-Math.PI*96*20)<.01);
console.log('PASS revolve join and hollow cylinder');
