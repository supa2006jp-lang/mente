import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointFixHole} from '../src/ball-joint-fix-hole.js';import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const vol=s=>Math.abs(R.measureVolume(s));
function check(s){const analyzer=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s));}finally{analyzer.delete();solids.forEach(s=>s.delete());}}
function same(a,b){const ab=a.cut(b),ba=b.cut(a);try{assert.ok(vol(ab)+vol(ba)<1e-5,'material beyond entry bevel remains identical');}finally{ab.delete();ba.delete();}}
const base=R.makeCylinder(12,10),legacy={fixHole:true,fixSide:'both',fixDiameter:6,fixPitch:1,fixDepth:5},plain=ballJointFixHole(base,10,legacy,'ball');
for(const [role,size]of [['ball',.3],['socket',.6]]){
 const prefix=role==='ball'?'fixBall':'fixSocket',s={...legacy,[prefix+'Chamfer']:true,[prefix+'ChamferSize']:size},result=ballJointFixHole(base,10,s,role),local=role==='socket'?result.clone().rotate(180,[0,0,0],[1,0,0]).translate([0,0,10]):result.clone();check(result);assert.ok(vol(local)<vol(plain)-.01);
 for(const z of [size/4,3*size/4])for(const delta of [-.02,.02]){
  const probe=R.makeSphere(.005).translate([3.2+size-z+delta,0,z]),hit=local.intersect(probe),before=plain.intersect(probe);
  assert.ok(Math.abs(vol(before)-vol(probe))<1e-8,'probe starts in original entrance material');
  if(delta<0)assert.ok(vol(hit)<1e-8,'entry is open inside the 45-degree slope');else assert.ok(Math.abs(vol(hit)-vol(probe))<1e-8,'outside of 45-degree slope stays solid');
  hit.delete();before.delete();probe.delete();
 }
 const below=R.makeBox([-15,-15,size+1.01],[15,15,10.01]),actual=local.intersect(below),expected=plain.intersect(below);same(actual,expected);[actual,expected,below].forEach(s=>s.delete());
 const disabled=ballJointFixHole(base,10,{...s,[prefix+'Chamfer']:false},role),disabledLocal=role==='socket'?disabled.clone().rotate(180,[0,0,0],[1,0,0]).translate([0,0,10]):disabled.clone();same(disabledLocal,plain);disabledLocal.delete();disabled.delete();local.delete();result.delete();console.log('PASS '+role+' adjustable 45-degree entrance, unchanged deep thread and blind bottom, valid solid/mesh and disabled compatibility');
}
base.delete();plain.delete();
const info={radius:12,height:40},preset=ballJointDefaults(info),spec={...preset,type:'ballJoint',id:'joint',target:'c',pose:'assembled',fixHole:true,fixBallDepth:5,fixBallChamfer:true,fixBallChamferSize:.6,fixSocketChamfer:true,fixSocketChamferSize:.3},cylinder={...defaults,id:'c',name:'円柱',profile:'circle',diameter:24,depth:40};
const joint=runOperation([cylinder],spec);assert.deepEqual(joint.analysis.fixingHoles.map(h=>[h.role,h.chamfer,h.chamferSize]),[['ball',true,.6],['socket',true,.3]]);assert.ok(Math.abs(joint.analysis.fixingHoles[0].entryDiameter-7.6)<1e-9);assert.ok(Math.abs(joint.analysis.fixingHoles[1].entryDiameter-7)<1e-9);assert.ok(joint.analysis.overlap.every(v=>v<1e-5));
for(const out of joint.outputs){const sh=R.deserializeShape(out.brep).asShape3D();check(sh);sh.delete();}
validateProject({format:'forma-cad',version:1,features:[cylinder,{kind:'cadop',id:'joint',name:'入口面取り付きボールジョイント',spec,...joint}]});
for(const pose of ['print','exploded'])assert.equal(runOperation([cylinder],{...spec,pose}).analysis.fixingHoles[1].chamferSize,.3);
const rotated=runOperation([{...cylinder,plane:'XZ',x:7,y:-3,z:9}],spec);assert.ok(Math.abs(rotated.analysis.axis[1])>.999);
for(const [bad,pattern]of [[{fixBallChamfer:'yes'},/球側/],[{fixBallChamferSize:0},/球側.*面取り幅/],[{fixSocketChamferSize:NaN},/受け側.*面取り幅/],[{fixSocketChamferSize:1},/受け側.*短すぎ/],[{fixBallDiameter:20,fixBallChamferSize:.7},/球側.*薄すぎ/],[{mountThread:true,mountLength:2.8,mountPitch:1,fixBallDiameter:20,fixBallChamferSize:.3},/球側.*薄すぎ/]])assert.throws(()=>ballJointSettings(info,{...spec,...bad}),pattern);
assert.equal(ballJointSettings(info,{...spec,fixBallChamfer:false,fixBallChamferSize:NaN}).fixingHoles[0].chamfer,false);
assert.equal(ballJointSettings(info,{...spec,fixSide:'ball',fixSocketChamferSize:NaN}).fixingHoles.length,1);
assert.deepEqual(ballJointSettings(info,{...spec,fixHole:false,fixSocketChamferSize:NaN}).fixingHoles,[]);
const old={...spec};for(const key of Object.keys(old))if(key.includes('Chamfer'))delete old[key];assert.ok(ballJointSettings(info,old).fixingHoles.every(h=>h.chamfer===false&&h.entryDiameter===6.4));
assert.ok(ballJointSettings(info,{...legacy,printSafe:true,fixDepth:2.8}).fixingHoles.every(h=>!h.chamfer));
console.log('PASS complete independent chamfers, poses/rotated axis, persistence, wall/engagement guards and old shared/individual file compatibility');
