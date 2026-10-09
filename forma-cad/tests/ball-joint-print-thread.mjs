import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults} from '../src/geometry.js';import {solidMeshComplete} from '../src/solid-mesh.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';import {ballJointThreadDimensions} from '../src/ball-joint-thread.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
for(const [nozzle,diameter,height]of [[.4,24,60],[.6,24,40],[.8,36,70]]){
 const cylinder={...defaults,id:'c',kind:'extrusion',profile:'circle',diameter,depth:height},info={radius:diameter/2,height},p={...ballJointDefaults(info),threadNozzle:nozzle,type:'ballJoint',target:'c',id:'j',pose:'assembled'};
 p.threadPitch=ballJointThreadDimensions(p).minPitch;if(nozzle===.6)p.mountThread=true;
 const s=ballJointSettings(info,p),result=runOperation([cylinder],p),shapes=result.outputs.map(o=>R.deserializeShape(o.brep).asShape3D());
 try{
  assert.equal(result.analysis.threadProfile.mode,'print');assert.ok(result.analysis.overlap.every(v=>v<1e-5));
  for(const shape of shapes){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{check.delete();solids.forEach(x=>x.delete());}}
  const [,socket,nut]=shapes;
  function materialWidth(shape,r,start,angle=0){
   const x=r*Math.cos(angle),y=r*Math.sin(angle),edge=R.makeLine([x,y,start],[x,y,start+s.threadPitch]),builder=new (R.getOC().BRepAlgoAPI_Common)(shape.wrapped,edge.wrapped);let common,edges=[];
   try{builder.Build();common=R.cast(builder.Shape());edges=common.edges;return edges.reduce((sum,e)=>sum+R.measureLength(e),0);}finally{edges.forEach(e=>e.delete());common?.delete();builder.delete();edge.delete();}
  }
  // Measure real material in both BReps, including male teeth outside the core.
  const width=materialWidth(nut,s.core+s.threadClearance+.005,s.coneEnd+s.threadPitch),maleWidth=materialWidth(socket,s.core+s.depth-.02,s.threadStart+s.threadPitch,Math.PI/8);
  console.log('nozzle',nozzle,'pitch',s.threadPitch,'measured nut tooth width',width,'male tooth width',maleWidth);
  assert.ok(width>=2*nozzle-1e-3,'actual female tooth spans at least two nozzle diameters');assert.ok(width<s.threadPitch-2*nozzle,'groove remains open');
  assert.ok(maleWidth>=s.threadProfile.maleCrestWidth-.01,'actual male thread crests remain outside the socket core');assert.ok(maleWidth<s.threadPitch*.7,'male helix is not a solid ring');
  const wrongPhase=nut.clone().rotate(180,[0,0,0],[0,0,1]),wrongHit=socket.intersect(wrongPhase);try{assert.ok(R.measureVolume(wrongHit)>.1,'teeth engage: turning without advancing must collide');}finally{wrongPhase.delete();wrongHit.delete();}
  for(const advance of [s.contactTravel*.4,s.contactTravel+.3,s.availableTravel]){const moved=nut.clone().rotate(advance/s.threadPitch*360,[0,0,0],[0,0,1]).translate([0,0,advance]),hit=socket.intersect(moved),above=R.makeBox([-100,-100,s.coneEnd+Math.max(0,advance-s.contactTravel)+.001],[100,100,200]),teethHit=hit.intersect(above);try{assert.ok(Math.abs(R.measureVolume(teethHit))<1e-5,'threads remain collision-free through the full tightening travel');if(advance<s.contactTravel)assert.ok(Math.abs(R.measureVolume(hit))<1e-5);else assert.ok(R.measureVolume(hit)>.001,'tightening pressure reaches the conical collet');}finally{moved.delete();hit.delete();above.delete();teethHit.delete();}}
  assert.ok(s.threadProfile.flankAngle>=45);assert.ok((s.nutTop-s.threadStart-s.depth*s.threadProfile.slope)/s.threadPitch>=2,'two full turns remain after the male lead-in');
 }finally{shapes.forEach(s=>s.delete());}
 console.log('PASS printable '+nozzle+' nozzle thread, mesh, measured tooth, screw motion and conical clamping');
}
const i={radius:12,height:40},legacy=ballJointSettings(i,{threadPitch:1.8});assert.equal(legacy.printSafe,false);assert.equal(legacy.threadProfile.mode,'legacy');assert.ok(legacy.threadProfile.femaleCrestWidth<.6);
for(const p of [{printSafe:true,threadPitch:1.8},{printSafe:true,threadNozzle:.4,threadPitch:4,threadClearance:.6},{printSafe:'yes'},{printSafe:true,threadNozzle:1}])assert.throws(()=>ballJointSettings(i,p));
console.log('PASS legacy opt-out and invalid printable dimensions');
