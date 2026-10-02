import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {featureSolid,runOperation,kernelBodies} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const fixture=[{...defaults,id:'plate',kind:'extrusion',profile:'rect',width:30,height:30,depth:2},{...defaults,id:'hole',kind:'extrusion',profile:'circle',diameter:10,depth:-2,z:2,operation:'cut',target:'plate'}];
const plate=kernelBodies(fixture).get('plate');
const source={kind:'cadop',id:'plate',outputs:[{id:'plate',brep:plate.serialize(),...plate.mesh()}],remove:[]};
const outer=[[-15,-15],[15,-15],[15,15],[-15,15]];
const hole=Array.from({length:128},(_,i)=>[5*Math.cos(i*2*Math.PI/128),5*Math.sin(i*2*Math.PI/128)]);
const region={id:'top',plane:'XY',offset:2,outer,holes:[hole],bodyId:'plate',cadFace:{bodyId:'plate',point:[10,0,2],normal:[0,0,1]}};
const feature={...defaults,id:'wall',kind:'extrusion',profile:'region',region,mode:'thin',side:'inside',wall:2,depth:2,operation:'join',target:'plate'};
const outerVolume=(30*30-26*26)*2;
const innerVolume=Math.PI*(7*7-5*5)*2;
const valid=shape=>{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.05,`Expected ${expected}, got ${actual}`);
for(const [skipHoleWalls,expected] of [[false,outerVolume+innerVolume],[true,outerVolume]]){
 const input={...feature,skipHoleWalls};
 const tool=featureSolid(input,new Map([['plate',plate]]));
 try{valid(tool);close(R.measureVolume(tool),expected);}finally{tool.delete();}
 const result=runOperation([source],{type:'extrusion',target:'plate',feature:input});
 const joined=R.deserializeShape(result.outputs[0].brep).asShape3D();
 try{valid(joined);close(R.measureVolume(joined),R.measureVolume(plate)+expected);}finally{joined.delete();}
 const generic=featureSolid({...input,region:{...region,bodyId:undefined,cadFace:undefined}},new Map());
 try{valid(generic);close(R.measureVolume(generic),expected);}finally{generic.delete();}
}
for(const [skipHoleWalls,removed] of [[false,outerVolume+innerVolume],[true,outerVolume]]){
 const input={...feature,depth:-1,operation:'cut',skipHoleWalls};
 const result=runOperation([source],{type:'extrusion',target:'plate',feature:input});
 const cut=R.deserializeShape(result.outputs[0].brep).asShape3D();
 try{valid(cut);close(R.measureVolume(cut),R.measureVolume(plate)-removed/2);}finally{cut.delete();}
}plate.delete();
console.log('PASS thin extrusion omits inner-hole walls on CAD faces and sketch regions');
