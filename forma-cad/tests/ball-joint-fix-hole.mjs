import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointFixHole} from '../src/ball-joint-fix-hole.js';import {ballJointMountBase} from '../src/ball-joint-mount.js';import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const vol=s=>Math.abs(R.measureVolume(s)),shape=o=>R.deserializeShape(o.brep).asShape3D();
function check(s){const analyzer=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s));}finally{analyzer.delete();solids.forEach(s=>s.delete());}}
function same(a,b){const ab=a.cut(b),ba=b.cut(a);try{assert.ok(vol(ab)+vol(ba)<1e-4,'same real geometry as regular thread followed by all-face pull');}finally{ab.delete();ba.delete();}}
const b={...defaults,id:'b',profile:'circle',diameter:24,depth:10},hole={...defaults,id:'hole',profile:'circle',diameter:6,depth:5,z:0,operation:'cut',target:'b',hole:true};
const threadSpec={type:'thread',id:'thread',target:'b',profile:'metric60',threadVersion:2,pitch:1,fullLength:true,surfacePoint:[3,0,2]};
const threaded=runOperation([b,hole],threadSpec),history=[b,hole,{kind:'cadop',id:'thread',spec:threadSpec,...threaded}],pulled=runOperation(history,{type:'pull',target:'b',allThreadFaces:true,distance:-.2}),reference=shape(pulled.outputs[0]),before=shape(threaded.outputs[0]);
assert.equal(pulled.outputs[0].threadSource.spec.threadCylinderOffset,-.2);assert.ok(vol(reference)<vol(before)-.1);before.delete();
const s={fixHole:true,fixSide:'both',fixDiameter:6,fixPitch:1,fixDepth:5},base=R.makeCylinder(12,10);
for(const role of ['ball','socket']){
 const result=ballJointFixHole(base,10,s,role);check(result);const ref=role==='socket'?reference.clone().rotate(180,[0,0,0],[1,0,0]).translate([0,0,10]):reference.clone();same(result,ref);
 const local=role==='socket'?result.clone().rotate(180,[0,0,0],[1,0,0]).translate([0,0,10]):result.clone(),core=R.makeCylinder(2.6,4.9,[0,0,.01]),empty=local.intersect(core),floor=R.makeCylinder(3,.5,[0,0,5.3]),material=local.intersect(floor);
 assert.ok(vol(empty)<1e-6,'hole opens at free end and extends to requested depth');assert.ok(Math.abs(vol(material)-vol(floor))<1e-5,'blind hole has a solid bottom');
 assert.ok(result.faces.some(f=>f.geomType==='BSPLINE_SURFACE'),'real helical thread remains after auto-pull');
 const other=ballJointFixHole(base,10,{...s,fixSide:role==='ball'?'socket':'ball'},role);same(other,base);
 [other,material,floor,empty,core,local,ref,result].forEach(s=>s.delete());console.log('PASS '+role+' central blind hole: exact regular auto-pull equivalence, right-hand orientation, bottom and mesh');
}
const screwFeature={...defaults,id:'screw',profile:'circle',diameter:6,depth:3},male=shape(runOperation([screwFeature],{...threadSpec,target:'screw',surfacePoint:[3,0,1]}).outputs[0]);
for(const advance of [0,.15,.35]){const moved=male.clone().rotate(advance*360,[0,0,0],[0,0,1]).translate([0,0,advance]),hit=reference.intersect(moved);assert.ok(vol(hit)<1e-5,'ordinary nominal screw fits the auto-pulled hole during screw motion');hit.delete();moved.delete();}male.delete();
for(const [diameter,pitch]of [[3,.5],[16,2]]){const result=ballJointFixHole(base,10,{...s,fixDiameter:diameter,fixPitch:pitch},'ball');check(result);assert.ok(result.faces.some(f=>f.geomType==='BSPLINE_SURFACE'));result.delete();}
console.log('PASS standard screw motion and smallest/largest preset geometry');
// Existing external mounting threads can coexist without losing their ridges.
const mounting={...s,mountThread:true,mountSide:'both',mountLength:4,mountPitch:1.5,mountClearance:.15};
for(const role of ['ball','socket']){const external=ballJointMountBase(12,10,mounting,role),result=ballJointFixHole(external,10,mounting,role);check(result);const region=R.makeBox([5,-20,-1],[20,20,11]),a=external.intersect(region),c=result.intersect(region);same(a,c);[external,result,region,a,c].forEach(s=>s.delete());}
const independent={fixHole:true,fixSide:'both',fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4,fixSocketDiameter:8,fixSocketPitch:1.25,fixSocketDepth:6};
for(const role of ['ball','socket']){
 const prefix=role==='ball'?'fixBall':'fixSocket',actual=ballJointFixHole(base,10,independent,role),expected=ballJointFixHole(base,10,{...s,fixDiameter:independent[prefix+'Diameter'],fixPitch:independent[prefix+'Pitch'],fixDepth:independent[prefix+'Depth']},role);
 check(actual);same(actual,expected);actual.delete();expected.delete();
}
reference.delete();base.delete();console.log('PASS side mounting thread coexistence and independent per-side real geometry');
const info={radius:12,height:40},spec={...ballJointDefaults(info),type:'ballJoint',id:'joint',target:'c',pose:'assembled',fixHole:true,fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4,fixSocketDiameter:8,fixSocketPitch:1.25,fixSocketDepth:2.8},cylinder={...defaults,id:'c',name:'円柱',profile:'circle',diameter:24,depth:40};
const settings=ballJointSettings(info,spec);assert.deepEqual(settings.fixingHoles.map(h=>[h.role,h.diameter,h.pitch,h.depth]),[['ball',4,.7,4],['socket',8,1.25,2.8]]);const joint=runOperation([cylinder],spec);assert.equal(joint.outputs.length,3);assert.equal(joint.analysis.fixingHoles.length,2);assert.ok(joint.analysis.overlap.every(v=>v<1e-5));for(const out of joint.outputs){const sh=shape(out);check(sh);sh.delete();}
validateProject({format:'forma-cad',version:1,features:[cylinder,{kind:'cadop',id:'joint',name:'固定ねじ穴付きボールジョイント',spec,...joint}]});
for(const pose of ['print','exploded']){const result=runOperation([cylinder],{...spec,pose});assert.equal(result.analysis.fixingHoles.length,2);if(pose==='print')for(const out of result.outputs)assert.ok(Math.abs(out.vertices.reduce((min,v,i)=>i%3===2?Math.min(min,v):min,Infinity))<1e-5);}
for(const plane of ['XZ','YZ']){const result=runOperation([{...cylinder,plane,x:7,y:-3,z:9}],spec);assert.ok(Math.abs(result.analysis.axis[plane==='XZ'?1:0])>.999);assert.equal(result.analysis.fixingHoles.length,2);}
for(const side of ['ball','socket'])assert.deepEqual(ballJointSettings(info,{...spec,fixSide:side}).fixingHoles.map(h=>h.role),[side]);
for(const bad of [{fixHole:'yes'},{fixSide:'nut'},{fixBallDiameter:24},{fixBallDiameter:NaN},{fixBallPitch:.4},{fixBallPitch:4},{fixBallDepth:20},{fixBallDepth:1},{fixBallDepth:Infinity},{mountThread:true,mountLength:2.8,mountPitch:1,fixBallDiameter:21.4}])assert.throws(()=>ballJointSettings(info,{...spec,...bad}));
assert.equal(ballJointSettings(info,{}).fixHole,false);assert.deepEqual(ballJointSettings(info,{...spec,fixHole:false,fixBallDepth:NaN,fixSocketDepth:NaN}).fixingHoles,[]);assert.equal(settings.fixingHoles[1].start,40);assert.equal(settings.fixingHoles[0].wallDiameter,4.4);
console.log('PASS complete joint, poses, translated/rotated axes, persistence, legacy defaults and invalid dimensions');

const legacy={type:'ballJoint',printSafe:true,fixHole:true,fixSide:'both',fixDiameter:6,fixPitch:1,fixDepth:2.8};
assert.deepEqual(ballJointSettings(info,legacy).fixingHoles.map(h=>[h.diameter,h.pitch,h.depth]),[[6,1,2.8],[6,1,2.8]]);
assert.equal(ballJointSettings(info,{...legacy,fixBallDiameter:4}).fixingHoles[0].diameter,4);
for(const role of ['ball','socket']){
 const inactive=role==='ball'?'fixSocket':'fixBall';
 assert.equal(ballJointSettings(info,{...spec,fixSide:role,[inactive+'Diameter']:NaN,[inactive+'Pitch']:NaN,[inactive+'Depth']:NaN}).fixingHoles.length,1);
 assert.throws(()=>ballJointSettings(info,{...spec,fixSide:'both',[inactive+'Depth']:20}),new RegExp(role==='ball'?'受け側':'球側'));
}
console.log('PASS shared legacy dimensions migrate to both sides, explicit side overrides and inactive-side validation');
