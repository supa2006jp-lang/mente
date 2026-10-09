import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const vol=s=>Math.abs(R.measureVolume(s)),shape=o=>R.deserializeShape(o.brep).asShape3D();
function check(s){const analyzer=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s));}finally{analyzer.delete();solids.forEach(s=>s.delete());}}
function same(a,b){const ab=a.cut(b),ba=b.cut(a);try{assert.ok(vol(ab)+vol(ba)<1e-5,'compatible with the old ball/socket/thread geometry');}finally{ab.delete();ba.delete();}}
const info={radius:12,height:40},source={...defaults,id:'c',name:'円柱',profile:'circle',diameter:24,depth:40},preset=ballJointDefaults(info),oldSpec={...preset,type:'ballJoint',id:'joint',target:'c',pose:'assembled',coneClearance:.25},old=runOperation([source],oldSpec),oldShapes=old.outputs.map(shape),oldSettings=ballJointSettings(info,oldSpec);
const legacy={...oldSpec};delete legacy.coneClearance;const fromLegacy=runOperation([source],legacy);assert.equal(fromLegacy.analysis.coneClearance,.25);for(let i=0;i<3;i++){const sh=shape(fromLegacy.outputs[i]);same(sh,oldShapes[i]);sh.delete();}
assert.ok(Math.abs(old.analysis.clampReserve-.077254165)<1e-8);console.log('PASS old files retain the original nut, ball, socket and clamping travel');
const spec={...oldSpec,coneClearance:.05},result=runOperation([source],spec),parts=result.outputs.map(shape),s=ballJointSettings(info,spec);
for(const sh of parts)check(sh);assert.ok(result.analysis.overlap.every(v=>v<1e-5));same(parts[0],oldShapes[0]);same(parts[1],oldShapes[1]);assert.ok(vol(parts[2])>vol(oldShapes[2])+.1,'only the nut seat gains material to contact earlier');
assert.equal(result.analysis.availableTravel,old.analysis.availableTravel);assert.equal(s.socketTop,oldSettings.socketTop);assert.equal(s.threadStart,oldSettings.threadStart);assert.equal(result.analysis.threadPitch,old.analysis.threadPitch);assert.ok(Math.abs(result.analysis.clampReserve-old.analysis.clampReserve-.2)<1e-8);
// Above the tapered seat, the nut's clearance and female thread remain identical.
const upper=R.makeBox([-30,-30,s.coneEnd+.001],[30,30,60]),a=parts[2].intersect(upper),b=oldShapes[2].intersect(upper);same(a,b);a.delete();b.delete();upper.delete();
const between=(s.contactTravel+oldSettings.contactTravel)/2;
for(const [label,nut,expectContact]of [['old',oldShapes[2],false],['strong',parts[2],true]]){
 const turned=nut.clone().rotate(between/s.threadPitch*360,[0,0,0],[0,0,1]).translate([0,0,between]),hit=parts[1].intersect(turned),v=vol(hit);if(expectContact)assert.ok(v>.01,'strong seat starts squeezing earlier');else assert.ok(v<1e-5,'old seat has not reached the collet');
 const outsideSeat=R.makeBox([-30,-30,s.coneEnd+between+.001],[30,30,60]),teeth=hit.intersect(outsideSeat);assert.ok(vol(teeth)<1e-5,'screw thread still travels freely');teeth.delete();outsideSeat.delete();hit.delete();turned.delete();
}
for(const [label,nut]of [['old',oldShapes[2]],['strong',parts[2]]]){
 const moved=nut.clone().rotate(s.availableTravel/s.threadPitch*360,[0,0,0],[0,0,1]).translate([0,0,s.availableTravel]),hit=parts[1].intersect(moved);assert.ok(vol(hit)>.01);if(label==='old')globalThis.oldPressure=vol(hit);else assert.ok(vol(hit)>globalThis.oldPressure+.01,'more geometric compression before reaching the same stop');hit.delete();moved.delete();
}
validateProject({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'joint',name:'締め付けを強めたボールジョイント',spec,...result}]});
for(const pose of ['print','exploded'])assert.equal(runOperation([source],{...spec,pose}).analysis.coneClearance,.05);
const rotated=runOperation([{...source,plane:'YZ',x:4,y:-3,z:8}],spec);assert.ok(Math.abs(rotated.analysis.axis[0])>.999);
for(const bad of [0,NaN,.7])assert.throws(()=>ballJointSettings(info,{...spec,coneClearance:bad}),/締め付け面/);assert.throws(()=>ballJointSettings(info,{...spec,coneClearance:.6}),/締め代/);
assert.equal(preset.coneClearance,.1);assert.ok(ballJointSettings(info,preset).clampReserve>.22);assert.equal(ballJointSettings(info,{...legacy,threadClearance:.15}).coneClearance,.15);
oldShapes.forEach(s=>s.delete());parts.forEach(s=>s.delete());console.log('PASS valid stronger nut, unchanged matching parts/threads, earlier conical contact and increased compression at the same stop, poses/axes/save and invalid gaps');
