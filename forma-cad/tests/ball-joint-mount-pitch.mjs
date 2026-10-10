import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointMountBase} from '../src/ball-joint-mount.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const info={radius:12,height:60},p={...ballJointDefaults(info),mountThread:true},s=ballJointSettings(info,p);
assert.equal(p.mountPitch,3);assert.equal(p.mountLength,6.2);
const volume=shape=>Math.abs(R.measureVolume(shape));
function check(shape){const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{analyzer.delete();solids.forEach(x=>x.delete());}}
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
