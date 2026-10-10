import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointNeckLayout} from '../src/ball-joint-neck-layout.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:40};
const info=runOperation([source],{type:'ballJointInfo',target:'c'}).analysis;
const p={...ballJointDefaults(info),type:'ballJoint',id:'joint',target:'c',pose:'assembled'};
const shape=o=>R.deserializeShape(o.brep).asShape3D(),vol=s=>Math.abs(R.measureVolume(s));
function same(a,b){const ab=a.cut(b),ba=b.cut(a);try{assert.ok(vol(ab)+vol(ba)<1e-4);}finally{ab.delete();ba.delete();}}
function valid(s){const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s));}finally{c.delete();solids.forEach(s=>s.delete());}}
const original=runOperation([source],p);
for(const extra of [0,15]){
 const spec={...p,neckBend:true,neckExtension:extra},s=ballJointSettings(info,spec),q=ballJointNeckLayout(s);
 const result=runOperation([source],spec);
 assert.equal(result.analysis.neckBendAngle,45);assert.equal(result.analysis.neckLength,2.5+extra);
 assert.ok(result.analysis.overlap.every(v=>v<1e-5));
 const delta=q.bend.map((v,i)=>v-q.base[i]),length=Math.hypot(...delta);
 assert.ok(Math.abs(length-q.length/2)<1e-9);
 assert.ok(Math.abs(Math.acos(delta[2]/length)*180/Math.PI-45)<1e-9);
 for(let i=0;i<3;i++){const a=shape(result.outputs[i]),b=shape(original.outputs[i]);valid(a);if(i)same(a,b);a.delete();b.delete();}
 if(extra){
  const ball=shape(result.outputs[0]);
  // The lower rod follows the angled centre line and leaves the old straight line empty.
  const mid=q.base.map((v,i)=>(v+q.bend[i])/2),probe=R.makeSphere(.15).translate(mid),hit=ball.intersect(probe);
  assert.ok(Math.abs(vol(hit)-vol(probe))<1e-6);
  const empty=R.makeSphere(.15).translate([-s.neckDiameter*.3,0,mid[2]]),noHit=ball.intersect(empty);assert.ok(vol(noHit)<1e-6);
  [ball,probe,hit,empty,noHit].forEach(s=>s.delete());
 }
 console.log('PASS bent rod length',q.length);
}
const bent=runOperation([source],{...p,neckBend:true,neckExtension:15}),turned=runOperation([source],{...p,neckBend:true,neckExtension:15,neckBendDirection:90});
const a=shape(bent.outputs[0]),b=shape(turned.outputs[0]),rotated=a.clone().rotate(90,[0,0,0],[0,0,1]);same(rotated,b);[a,b,rotated].forEach(s=>s.delete());
const fixedSpec={...p,neckBend:true,neckBendDirection:180,neckExtension:15,mountThread:true,mountSide:'ball',mountLength:4,mountPitch:1.5,fixHole:true,fixSide:'ball',fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4};
const fixed=runOperation([source],fixedSpec),straight=runOperation([source],{...fixedSpec,neckBend:false}),s=ballJointSettings(info,fixedSpec),offset=s.neckBaseOffset,ball=shape(fixed.outputs[0]),old=shape(straight.outputs[0]);
valid(ball);
const moved=old.clone().translate(offset),region=R.makeCylinder(20,s.ballBaseHeight-.3,[offset[0],offset[1],s.ballBaseStart+offset[2]]),left=ball.intersect(region),right=moved.intersect(region);same(left,right);
assert.deepEqual(fixed.analysis.fixingHoles[0].center,[offset[0],offset[1],s.ballBaseStart+offset[2]]);
[ball,old,moved,region,left,right].forEach(s=>s.delete());
for(const pose of ['print','exploded']){const result=runOperation([source],{...p,neckBend:true,neckExtension:15,pose});if(pose==='print')for(const o of result.outputs)assert.ok(Math.abs(o.vertices.reduce((m,v,i)=>i%3===2?Math.min(m,v):m,Infinity))<1e-5);}
const spec={...p,neckBend:true,neckExtension:15,neckBendDirection:90},feature={kind:'cadop',id:'joint',name:'45°の棒',spec,...turned},history=[source,feature];
validateProject({format:'forma-cad',version:1,features:history});
const replay=runOperation(history,{type:'replay',before:history,start:1});assert.equal(replay.features[1].analysis.neckBendAngle,45);assert.equal(replay.features[1].analysis.neckBendDirection,90);
const legacy={...p};delete legacy.neckBend;delete legacy.neckBendDirection;
assert.equal(ballJointSettings(info,legacy).neckBend,false);
assert.throws(()=>ballJointSettings(info,{...p,neckBend:'yes'}),/45°/);
assert.throws(()=>ballJointSettings(info,{...p,neckBendDirection:45}),/向き/);
console.log('PASS 45-degree centre line, connected valid meshes, unchanged socket/nut, direction, translated base/threads/holes, bed placement, replay and legacy compatibility');
