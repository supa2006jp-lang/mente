import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const plate={...defaults,kind:'extrusion',id:'plate',name:'板',width:20,height:20,depth:5,x:40},cylinder={...defaults,kind:'extrusion',id:'cylinder',name:'ねじの下地',profile:'circle',diameter:10,depth:5};
const thread={type:'thread',id:'thread',target:'cylinder',surfacePoint:[5,0,2.5],profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,leftHand:false,designation:'M10 × 1.5'};
const rounded={type:'fillet',id:'rounded',target:'plate',radius:.5};
const make=(features,spec)=>[...features,{kind:'cadop',id:spec.id,name:spec.type,spec,...runOperation(features,spec)}];
let before=make([plate,cylinder],thread);before=make(before,rounded);
await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/history-incremental-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:before}));
const proposed=structuredClone(before);proposed[0].depth=7;let summary;const started=performance.now(),incremental=runOperation(proposed,{type:'replay',before,start:0},event=>{if(event.complete)summary=event;}).features,incrementalMs=performance.now()-started;
const fullStart=performance.now(),full=runOperation(proposed,{type:'replay',before,start:0,forceFull:true}).features,fullMs=performance.now()-fullStart;
assert.equal(summary.reused,2);assert.equal(JSON.stringify(incremental[2]),JSON.stringify(before[2]));
const a=kernelBodies(incremental),b=kernelBodies(full);try{for(const [id,shape]of a){assert.ok(Math.abs(R.measureVolume(shape)-R.measureVolume(b.get(id)))<1e-5);const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);assert(check.IsValid());check.delete();}}finally{a.forEach(s=>s.delete());b.forEach(s=>s.delete());}
const fail=structuredClone(before);fail[0].depth=.01;fail[3].spec.radius=100;const snapshot=JSON.stringify(before);assert.throws(()=>runOperation(fail,{type:'replay',before,start:0}),/変更前の形状/);assert.equal(JSON.stringify(before),snapshot);
console.log(JSON.stringify({pass:true,reused:summary.reused,recalculated:summary.recalculated,incrementalMs:Math.round(incrementalMs),fullMs:Math.round(fullMs),checks:'native volume/validity matches full replay, independent thread unchanged, atomic failure'}));
