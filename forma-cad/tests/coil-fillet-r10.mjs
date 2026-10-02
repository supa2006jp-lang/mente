import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeCoilJoint} from '../src/coil-joint.js';
import {polygonCylinder} from '../src/coil-prism.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));

// Reproduce the 40 mm hexagonal ridge design without an external fixture.
// Its 3.3 mm wall limits the horizontal caps to 1.155 mm, while the vertical
// corner can accept a much larger radius when the ridge clearance allows it.
const profile=[[0,-20],[17.32050807568877,-10],[17.320508075688775,10],[0,20],[-17.32050807568877,10],[-17.32050807568877,-10]];
const base=polygonCylinder(profile,40);
const spec={wire:2,pitch:4,turns:2,wall:3.3,jointGap:.4,jointSeam:0,jointSplit:0,
 hand:'右ねじ',autoAdjust:true,alignStop:false,closeAngle:0,closeAngleZero:2,
 jointPose:'閉じた状態',rimSeat:true,jointLatch:true,latchStyle:'ridge',latchFirm:true,
 latchExtraFirm:true,latchGap:.05,latchEngagement:1.6,
 autoFillet:true,filletRadius:10,filletBodyBottom:true,filletLidTop:true,filletVertical:true};

function assertClosedSolid(shape){
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
 try{
  assert.equal(check.IsValid(),true,'OCCT must accept the filleted solid');
  assert.equal(solids.length,1,'one solid per half');
  assert.ok(R.measureVolume(shape)>1e-6,'positive volume');
 }finally{check.delete();solids.forEach(s=>s.delete());}
 const mesh=shape.mesh({tolerance:.08,angularTolerance:.15});
 const keys=Array.from({length:mesh.vertices.length/3},(_,i)=>mesh.vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(','));
 const edges=new Map();
 for(let i=0;i<mesh.triangles.length;i+=3){
  const tri=mesh.triangles.slice(i,i+3).map(index=>keys[index]);
  assert.equal(new Set(tri).size,3,'no collapsed mesh triangles');
  for(let j=0;j<3;j++){
   const key=[tri[j],tri[(j+1)%3]].sort().join('|');
   edges.set(key,(edges.get(key)||0)+1);
  }
 }
 assert.ok(edges.size>0,'mesh has edges');
 assert.ok([...edges.values()].every(count=>count===2),'watertight manifold mesh');
}

let result;
try{
 result=makeCoilJoint(base,spec);
 const q=result.analysis,f=q.fillet;
 console.log(JSON.stringify({requested:f.requestedRadius,vertical:f.verticalRadius,cap:f.capRadius,
  status:f.status,motion:q.motion.status,edges:f.edges}));
 assert.equal(q.motion.status,'clear');
 assert.equal(f.status,'clear');
 assert.equal(f.requestedRadius,10);
 assert.equal(f.requestedVerticalRadius,10);
 assert.equal(f.requestedCapRadius,10);
 assert.equal(f.verticalReason?.type,'ridge-wall');
 assert.equal(f.capReason?.type,'wall');
 assert.ok(f.verticalRadius>7&&f.verticalRadius<8,'vertical corner stays near 7.5 mm');
 assert.ok(Math.abs(f.capRadius-1.155)<.03,'cap stays near the 1.15 mm wall limit');
 assert.ok(f.verticalRadius>f.capRadius*5,'vertical radius is independent of cap radius');
 assert.deepEqual(f.locations,{bodyBottom:true,lidTop:true,vertical:true});
 assert.ok(f.edges.every(count=>count>0),'both parts receive exterior fillets');
 const plain=makeCoilJoint(base,{...spec,autoFillet:false},null,{preview:true});
 try{
  const volumeIn=(shape,tool)=>{const hit=shape.intersect(tool);try{return Math.abs(R.measureVolume(hit));}finally{hit.delete();}};
  const removedAt=(part,tool,label,minimum)=>{
   try{
    const before=volumeIn(plain.parts[part],tool),after=volumeIn(result.parts[part],tool);
    assert.ok(before>minimum,label+' has material before filleting');
    assert.ok(before-after>minimum,label+' loses exterior material to the fillet');
   }finally{tool.delete();}
  };
  const turn=(point,degrees)=>{const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [point[0]*c-point[1]*s,point[0]*s+point[1]*c];};
  for(const [part,z] of [[0,q.split/2],[1,(q.split+q.height)/2]]){
   for(const [index,point] of q.profile.entries()){
    const [x,y]=part?turn(point,q.closeAngle):point;
    removedAt(part,R.makeCylinder(.4,1,[x,y,z]),'part '+part+' vertical corner '+index,.005);
   }
  }
  for(const [part,z] of [[0,0],[1,q.height-.3]]){
   const midpoint=q.profile[0].map((v,i)=>(v+q.profile[1][i])/2),[x,y]=part?turn(midpoint,q.closeAngle):midpoint;
   removedAt(part,R.makeCylinder(.4,.3,[x,y,z]),'part '+part+' horizontal cap',.001);
  }
 }finally{plain.parts.forEach(shape=>shape.delete());}
 const independent=makeCoilJoint(base,{...spec,filletVerticalRadius:2,filletCapRadius:.5},null,{preview:true});
 try{
  assert.equal(independent.analysis.fillet.requestedVerticalRadius,2);
  assert.equal(independent.analysis.fillet.requestedCapRadius,.5);
  assert.ok(Math.abs(independent.analysis.fillet.verticalRadius-2)<.01);
  assert.ok(Math.abs(independent.analysis.fillet.capRadius-.5)<.01);
  assert.equal(independent.analysis.fillet.verticalReason,null);
  assert.equal(independent.analysis.fillet.capReason,null);
 }finally{independent.parts.forEach(shape=>shape.delete());}
 result.parts.forEach(assertClosedSolid);
 console.log('PASS R10 hex coil fillet: independent vertical and cap radii, valid closed solids');
}finally{result?.parts.forEach(shape=>shape.delete());base.delete();}


