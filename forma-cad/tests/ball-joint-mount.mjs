import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointMountBase} from '../src/ball-joint-mount.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const info={radius:12,height:40},p={...ballJointDefaults(info),printSafe:false,threadPitch:1.8,mountThread:true,mountLength:4,mountPitch:1.5},s=ballJointSettings(info,p);
const volume=shape=>Math.abs(R.measureVolume(shape));
function check(shape){const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{analyzer.delete();solids.forEach(x=>x.delete());}}
assert.equal(ballJointSettings(info,{}).mountThread,false,'old saves leave the bases unchanged');
assert.equal(s.mountingThreads.length,2);
for(const role of ['ball','socket']){
 const h=role==='ball'?s.lowerEnd:info.height-s.socketTop,male=ballJointMountBase(info.radius,h,s,role);check(male);
 assert.ok(volume(male)<Math.PI*info.radius**2*h-1,'threading removes valleys from the nominal-diameter base');
 const unchanged=ballJointMountBase(info.radius,h,{...s,mountSide:role==='ball'?'socket':'ball'},role);assert.ok(Math.abs(volume(unchanged)-Math.PI*info.radius**2*h)<1e-5);unchanged.delete();
 const local=role==='socket'?male.clone().rotate(180,[0,0,0],[1,0,0]).translate([0,0,h]):male.clone();
 // Check mating against the existing female thread tool, not a clone of the new teeth.
 const receiver={...defaults,id:'receiver',profile:'circle',diameter:32,depth:p.mountLength},hole={...defaults,id:'hole',profile:'circle',diameter:24,depth:-p.mountLength,z:p.mountLength,operation:'cut',target:'receiver',hole:true};
 const result=runOperation([receiver,hole],{type:'thread',target:'receiver',profile:'metric60',threadVersion:2,pitch:p.mountPitch,fullLength:true,surfacePoint:[12,0,2]});
 const female=R.deserializeShape(result.outputs[0].brep).asShape3D();check(female);
 for(const advance of [0,.3,.65]){const moved=local.clone().rotate(advance/p.mountPitch*360,[0,0,0],[0,0,1]).translate([0,0,advance]),hit=moved.intersect(female);try{assert.ok(volume(hit)<1e-4,'same pitch nominal female screws over '+role+' base without tooth collision at '+advance);}finally{hit.delete();moved.delete();}}
 const cavity=R.makeCylinder(info.radius,p.mountLength),plainHit=local.intersect(cavity);assert.ok(volume(plainHit)>100,'thread has material inside the receiving opening');plainHit.delete();cavity.delete();
 const shoulder=R.makeCylinder(info.radius-.02,.5,[0,0,p.mountLength+.3]),support=local.intersect(shoulder);assert.ok(Math.abs(volume(support)-volume(shoulder))<1e-4,'full diameter shoulder remains');support.delete();shoulder.delete();
 female.delete();local.delete();male.delete();console.log('PASS '+role+' base: valid mesh, correct nominal female fit through screw motion, shoulder, unselected base unchanged');
}
const cylinder={...defaults,id:'c',kind:'extrusion',name:'円柱',profile:'circle',diameter:24,depth:40};
const spec={...p,type:'ballJoint',target:'c',id:'joint',pose:'assembled'},result=runOperation([cylinder],spec,progress=>console.log(progress.stage));
assert.equal(result.outputs.length,3);assert.equal(result.analysis.mountingThreads.length,2);assert.ok(result.analysis.overlap.every(v=>v<1e-5));
for(const output of result.outputs){const shape=R.deserializeShape(output.brep).asShape3D();check(shape);shape.delete();}
validateProject({format:'forma-cad',version:1,features:[cylinder,{kind:'cadop',id:spec.id,name:'ねじ取付ボールジョイント',spec,...result}]});
for(const pose of ['print','exploded']){const next=runOperation([cylinder],{...spec,pose});assert.equal(next.analysis.mountingThreads.length,2);if(pose==='print')for(const output of next.outputs){let min=Infinity;for(let i=2;i<output.vertices.length;i+=3)min=Math.min(min,output.vertices[i]);assert.ok(Math.abs(min)<1e-5);}}
for(const plane of ['XZ','YZ']){const next=runOperation([{...cylinder,plane,x:7,y:-3,z:9}],spec);assert.ok(Math.abs(next.analysis.axis[plane==='XZ'?1:0])>.999);assert.equal(next.outputs.length,3);assert.ok(next.analysis.overlap.every(v=>v<1e-5));}
for(const side of ['ball','socket'])assert.deepEqual(ballJointSettings(info,{...p,mountSide:side}).mountingThreads.map(t=>t.role),[side]);
for(const bad of [{mountLength:20},{mountPitch:3},{mountClearance:-.1},{mountPitch:NaN},{mountSide:'nut'},{mountThread:'yes'}])assert.throws(()=>ballJointSettings(info,{...p,...bad}));
// Disabled option does not reject obsolete or unfinished input in its hidden dimensions.
assert.equal(ballJointSettings(info,{...p,mountThread:false,mountLength:NaN}).mountingThreads.length,0);
console.log('PASS joint integration, no interference, placement, rotated axes, persistence and dimension guards');
