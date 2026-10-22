import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {taperDisplayAngle,taperStoredAngle} from '../src/taper-angle-reference.js';
import {defaults,makeGeometry,volume,validateProject} from '../src/geometry.js';
import {featureSolid} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<.003,`${a} ≠ ${b}`);
for(const display of [10,30,45,80,90,-10,-30,-80,-90]){const stored=taperStoredAngle(display,'base');near(Math.abs(taperDisplayAngle(stored,'base')),Math.abs(display));const f={...defaults,id:'t',kind:'extrusion',name:'底面基準',width:50,height:50,depth:5,taperAngle:stored,taperReference:'base',taperMode:'oneSide'},shape=featureSolid(f),geometry=makeGeometry(f),shift=5*Math.tan(stored*Math.PI/180);try{near(R.measureVolume(shape),12500+50*5*shift/2);near(volume(geometry),12500+50*5*shift/2);const points=shape.mesh().vertices,end=[];for(let i=0;i<points.length;i+=3)if(Math.abs(points[i+2]-5)<1e-5)end.push(points[i]);near(Math.min(...end),-25);near(Math.max(...end)-Math.min(...end),50+shift);if(display===80)near(Math.atan2(5,shift)*180/Math.PI,80);}finally{shape.delete();geometry.dispose();}validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[f]})));}
for(const value of [0,5,-5,91,NaN,Infinity])assert.throws(()=>taperStoredAngle(value,'base'),/底面/);
for(const value of [-80,-10,0,10,80]){assert.equal(taperStoredAngle(value),value);assert.equal(taperDisplayAngle(value),value);}
const legacy={...defaults,id:'legacy',name:'旧モデル',kind:'extrusion',width:50,height:50,depth:5,taperAngle:80,taperMode:'oneSide'};delete legacy.taperReference;const g=makeGeometry(legacy);try{near(volume(g),12500+50*5*5*Math.tan(80*Math.PI/180)/2);}finally{g.dispose();}
await fs.mkdir('outputs/taper-angle-reference',{recursive:true});const proof={baseAngle80Is80:true,nativeAndMeshMatch:true,positiveAndNegative:true,oppositeSideFixed:true,vertical90:true,referenceRoundtrip:true,legacyUnchanged:true,invalidRejected:true,saveReload:true,errors:[]};await fs.writeFile('outputs/taper-angle-reference/geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
