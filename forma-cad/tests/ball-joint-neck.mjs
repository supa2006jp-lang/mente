import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:40};
const info=runOperation([source],{type:'ballJointInfo',target:'c'}).analysis;
const p={...ballJointDefaults(info),type:'ballJoint',id:'joint',target:'c',pose:'assembled'};
const shape=o=>R.deserializeShape(o.brep).asShape3D(),vol=s=>Math.abs(R.measureVolume(s));
function same(a,b){const ab=a.cut(b),ba=b.cut(a);try{assert.ok(vol(ab)+vol(ba)<1e-4);}finally{ab.delete();ba.delete();}}
function valid(s){const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s));}finally{c.delete();solids.forEach(s=>s.delete());}}
const original=runOperation([source],p),extended=runOperation([source],{...p,neckExtension:15});
assert.equal(extended.analysis.neckLength,p.neckLength+15);
assert.equal(extended.analysis.ballBaseHeight,original.analysis.ballBaseHeight);
assert.ok(extended.analysis.overlap.every(v=>v<1e-5));
for(let i=0;i<3;i++){const old=shape(original.outputs[i]),next=shape(extended.outputs[i]);valid(next);
 if(i){same(old,next);}else{
  const box=next.boundingBox;assert.ok(Math.abs(box.bounds[0][2]+15)<1e-6);box.delete();
  assert.ok(Math.abs(vol(next)-vol(old)-Math.PI*(p.neckDiameter/2)**2*15)<1e-4,'extra volume is only the longer rod');
  const translated=old.clone().translate([0,0,-15]),s=ballJointSettings(info,p),region=R.makeCylinder(20,s.lowerEnd-.1,[0,0,-15]),a=next.intersect(region),b=translated.intersect(region);
  same(a,b);[a,b,region,translated].forEach(s=>s.delete());
  const rotated=next.clone().rotate(15,[0,0,p.splitPosition],[0,1,0]);
  for(const output of extended.outputs.slice(1)){const other=shape(output),hit=rotated.intersect(other);assert.ok(vol(hit)<1e-5,'15 degree swivel remains clear');hit.delete();other.delete();}rotated.delete();
 }
 old.delete();next.delete();
}
const fixedSpec={...p,neckExtension:15,fixHole:true,fixSide:'ball',fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4,mountThread:true,mountSide:'ball',mountLength:4,mountPitch:1.5};
const fixed=runOperation([source],fixedSpec),oldFixed=runOperation([source],{...fixedSpec,neckExtension:0});
const fixedBall=shape(fixed.outputs[0]),oldBall=shape(oldFixed.outputs[0]);valid(fixedBall);
const lower=ballJointSettings(info,fixedSpec).lowerEnd,probe=R.makeCylinder(20,lower-.1,[0,0,-15]),a=fixedBall.intersect(probe),moved=oldBall.clone().translate([0,0,-15]),b=moved.intersect(probe);same(a,b);
assert.equal(fixed.analysis.fixingHoles[0].start,-15);assert.equal(fixed.analysis.mountingThreads[0].start,-15);
[a,b,moved,probe,fixedBall,oldBall].forEach(s=>s.delete());
for(const pose of ['print','exploded']){const result=runOperation([source],{...p,neckExtension:15,pose});assert.equal(result.outputs.length,3);if(pose==='print')for(const o of result.outputs)assert.ok(Math.abs(o.vertices.reduce((min,v,i)=>i%3===2?Math.min(v,min):min,Infinity))<1e-5);}
const feature={kind:'cadop',id:'joint',name:'棒を延長したボールジョイント',spec:{...p,neckExtension:15},...extended},history=[source,feature];
validateProject({format:'forma-cad',version:1,features:history});
const replay=runOperation(history,{type:'replay',before:history,start:1});assert.equal(replay.features[1].analysis.neckLength,17.5);
const legacy={...p};delete legacy.neckExtension;assert.equal(ballJointSettings(info,legacy).neckExtension,0);
const before=runOperation([source],legacy),old=shape(before.outputs[0]),zero=shape(original.outputs[0]);same(old,zero);old.delete();zero.delete();
for(const value of [-1,101,NaN,Infinity])assert.throws(()=>ballJointSettings(info,{...p,neckExtension:value}),/追加長さ/);
console.log('PASS rod-only extension, unchanged base/socket/nut, actual swivel clearance, translated mounting threads and fixing hole, print bed, replay, legacy defaults and dimension guards');

