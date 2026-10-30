import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {makeStorageTray,makeDovetail,checkMotion} from '../src/part-workshop.js';
import {binaryStlReport} from './stl-topology.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
async function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}const parts=shape.solids;try{assert.equal(parts.length,1);}finally{parts.forEach(s=>s.delete());}const report=binaryStlReport(Buffer.from(await shape.blobSTL({binary:true,tolerance:.02,angularTolerance:.1}).arrayBuffer()));assert.equal(report.boundary,0);assert.equal(report.nonmanifold,0);assert.equal(report.orientation,0);assert.equal(report.degenerate,0);}
const box={...defaults,id:'box',kind:'extrusion',name:'箱',width:40,height:40,depth:30};
const hole={...defaults,id:'hole',kind:'extrusion',profile:'circle',hole:true,operation:'cut',target:'box',diameter:6,depth:-20,z:30,counterbore:true,counterboreDiameter:12,counterboreDepth:5};
let bodies=kernelBodies([box,hole]);try{await valid(bodies.get('box'));assert(Math.abs(R.measureVolume(bodies.get('box'))-(48000-Math.PI*3**2*20-Math.PI*(6**2-3**2)*5))<.001);}finally{bodies.forEach(s=>s.delete());}
assert.throws(()=>kernelBodies([box,{...hole,counterboreDiameter:5}]),/座ぐり/);
const a=R.makeBox([-20,-20,0],[0,20,30]),b=R.makeBox([0,-20,0],[20,20,30]);bodies=new Map([['a',a],['b',b]]);
try{
 const made=makeDovetail(bodies,{target:'a',other:'b',width:10,depth:4,angle:12,clearance:.2});try{for(const {shape}of made.items)await valid(shape);assert(R.measureVolume(made.items[0].shape)>R.measureVolume(a));assert(R.measureVolume(made.items[1].shape)<R.measureVolume(b));}finally{made.items.forEach(a=>a.shape.delete());}
 const snapshot=()=>[a,b].map(s=>({volume:R.measureVolume(s),bounds:s.boundingBox.bounds}));const before=snapshot();assert.throws(()=>makeDovetail(bodies,{target:'a',other:'b',width:100,depth:4,angle:12,clearance:.2}));assert.deepEqual(snapshot(),before);
 const tray=makeStorageTray(bodies,{targets:['a','b'],columns:2,clearance:.3,wall:2,floor:2,depth:10,gap:3,fingerAccess:true,fingerRadius:4,labels:false});try{await valid(tray.shape);assert.equal(tray.info.pockets.length,2);}finally{tray.shape.delete();}
 const motion={targets:['a'],motion:'slide',axisVector:[1,0,0],pivot:[0,0,0],min:-10,max:10,value:2};assert.equal(checkMotion(bodies,motion).rows[0].status,'interference');assert.equal(checkMotion(bodies,{...motion,value:-2}).rows[0].status,'gap');assert.equal(checkMotion(bodies,{...motion,type:'motionRangeCheck'}).rows.length,13);assert.deepEqual(snapshot(),before);
}finally{bodies.forEach(s=>s.delete());}
const trayResult=runOperation([box],{type:'storageTray',id:'tray',targets:['box'],columns:1,clearance:.3,wall:2,floor:2,depth:10,gap:3,fingerAccess:false,labels:false});assert.equal(trayResult.outputs.length,1);assert.equal(trayResult.outputs[0].id,'tray');
validateProject({format:'forma-cad',version:1,features:[box,{kind:'cadop',name:'トレー',id:'tray-op',spec:{type:'storageTray'},...trayResult}]});
// A rotated interface must use the actual CAD plane, not world-aligned bounds.
const ra=R.makeBox([-20,-20,0],[0,20,30]).rotate(37,[0,0,0],[0,0,1]).rotate(24,[0,0,0],[1,0,0]),rb=R.makeBox([0,-20,0],[20,20,30]).rotate(37,[0,0,0],[0,0,1]).rotate(24,[0,0,0],[1,0,0]);
const rotated=new Map([['a',ra],['b',rb]]);try{for(const twist of [0,90]){const joint=makeDovetail(rotated,{target:'a',other:'b',width:8,depth:3,angle:15,clearance:.15,twist});try{for(const part of joint.items)await valid(part.shape);}finally{joint.items.forEach(p=>p.shape.delete());}}const far=rb.clone().translate([100,0,0]);try{assert.throws(()=>makeDovetail(new Map([['a',ra],['b',far]]),{target:'a',other:'b',width:8,depth:3,angle:15,clearance:.15}),/境界/);}finally{far.delete();}}finally{rotated.forEach(s=>s.delete());}
const ca={...box,id:'a',width:20,x:-10},cb={...ca,id:'b',x:10};const jointSpec={type:'dovetail',id:'join',target:'a',other:'b',width:10,depth:4,angle:12,clearance:.2};
const result=runOperation([ca,cb],jointSpec);assert.equal(result.outputs.length,2);assert.equal(result.remove.length,0);const history=[ca,cb,{kind:'cadop',id:'join',name:'蟻継ぎ',spec:jointSpec,...result}];validateProject({format:'forma-cad',version:1,features:history});const replay=runOperation(history,{type:'replay',before:history,start:2,forceFull:true});assert.equal(replay.features[2].outputs.length,2);
// Arbitrary entry normals and positive/negative directions share one recess rule.
const turned={...box,plane:'YZ',width:40,height:40,depth:30},sideHole={...hole,plane:'YZ',x:30,y:0,z:0};const side=kernelBodies([turned,sideHole]);try{await valid(side.get('box'));assert(Math.abs(R.measureVolume(side.get('box'))-(48000-Math.PI*3**2*20-Math.PI*27*5))<.001);}finally{side.forEach(s=>s.delete());}
assert.throws(()=>kernelBodies([box,{...hole,counterboreDepth:21}]),/座ぐり/);
console.log('PASS counterbore entry directions/volume, closed STL, rotated dovetails, replay, tray, sampled motion and non-destructive errors');
