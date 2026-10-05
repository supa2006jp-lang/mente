import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeSnapLid} from '../src/snap-lid.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={bodyWall:4.2,lidWall:2.4,floor:2.4,insertion:4,clearance:.2,ridge:.4,pose:'assembled',divider:true,dividerThickness:2.4,filletInside:true,innerFilletRadius:1};
function material(shape,point){const tool=R.makeBox(point.map(v=>v-.01),point.map(v=>v+.01)),hit=shape.intersect(tool);try{return R.measureVolume(hit);}finally{hit.delete();tool.delete();}}
function valid(shape){const c=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);}finally{c.delete();solids.forEach(s=>s.delete());}}
for(const [width,height,direction,angle,radius,rounded]of [[80,50,'short',0,1,false],[80,50,'long',0,1,false],[80,50,'short',27,1,false],[80,50,'long',27,10,false],[40,20,'long',0,10,false],[80,50,'short',0,1,true]]){
 const lower=(rounded?R.drawRoundedRectangle(width,height,8).sketchOnPlane('XY').extrude(30):R.makeBox([-width/2,-height/2,0],[width/2,height/2,30])).rotate(angle,[0,0,0],[0,0,1]);
 const upper=(rounded?R.drawRoundedRectangle(width,height,8).sketchOnPlane('XY',30).extrude(12):R.makeBox([-width/2,-height/2,30],[width/2,height/2,42])).rotate(angle,[0,0,0],[0,0,1]);
 const spec={...p,dividerDirection:direction,innerFilletRadius:radius},result=makeSnapLid(lower,upper,spec),sharp=makeSnapLid(lower,upper,{...spec,filletInside:false});
 try{
  valid(result.body);valid(result.lid);assert.ok(result.analysis.overlap<1e-5);
  const d=result.analysis.divider,r=d.filletRadius;assert.ok(r>0&&r<=radius);assert.equal(r,result.analysis.fillet.innerRadius);assert.ok(r<=d.compartmentWidth/4+1e-6);
  const point=(s,t,z)=>[d.center[0]+d.tangent[0]*s+d.normal[0]*t,d.center[1]+d.tangent[1]*s+d.normal[1]*t,z];
  for(const end of [-1,1])for(const side of [-1,1])for(const z of [12,29.95,30.05,33.95]){
   const at=point(end*(d.span/2-r*.12),side*(d.thickness/2+r*.12),z);
   assert.ok(material(result.body,at)>1e-6,'rounded divider-wall joint at z='+z);assert.ok(material(sharp.body,at)<1e-8,'sharp control has no rounding');
  }
  for(const side of [-1,1]){
   const at=point(0,side*(d.thickness/2+r*.12),d.zMin+r*.12);
   assert.ok(material(result.body,at)>1e-6,'rounded divider-floor joint');assert.ok(material(sharp.body,at)<1e-8,'sharp floor control');
   assert.ok(material(result.body,point(0,side*(d.thickness/2+r+.2),15))<1e-8,'compartments remain open beyond fillet');
  }
  assert.ok(material(result.body,point(0,0,33.95))>1e-6,'divider top height and full thickness retained');
  const envelope=R.makeBox([-width/2+p.bodyWall,-height/2+p.bodyWall,p.floor-.01],[width/2-p.bodyWall,height/2-p.bodyWall,34.01]).rotate(angle,[0,0,0],[0,0,1]),added=result.body.cut(sharp.body),outside=added.cut(envelope),removed=sharp.body.cut(result.body);try{
   assert.ok(R.measureVolume(added)>1e-5,'fillets add material at internal joints');assert.ok(R.measureVolume(removed)<1e-7,'no original divider material removed');assert.ok(R.measureVolume(outside)<1e-7,'external mating surfaces unchanged');
  }finally{envelope.delete();added.delete();outside.delete();removed.delete();}
  const addedLid=result.lid.cut(sharp.lid),removedLid=sharp.lid.cut(result.lid);try{assert.ok(R.measureVolume(addedLid)<1e-7&&R.measureVolume(removedLid)<1e-7,'lid and groove unchanged');}finally{addedLid.delete();removedLid.delete();}
  console.log('PASS '+width+'x'+height+' '+direction+' '+angle+' degrees, requested R'+radius+' effective R'+r+': four continuous divider-wall fillets, two bottom fillets, safe thickness and unchanged fit');
 }finally{result.body.delete();result.lid.delete();sharp.body.delete();sharp.lid.delete();lower.delete();upper.delete();}
}
