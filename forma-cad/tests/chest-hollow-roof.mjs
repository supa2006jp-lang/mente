import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseBody,encloseParts} from '../src/enclose.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const checkProbe=(shape,point,filled,label)=>{
 const probe=R.makeBox(point.map(x=>x-.03),point.map(x=>x+.03)),common=shape.intersect(probe);
 try{const volume=R.measureVolume(common);assert.ok(filled?volume>0.00021:Math.abs(volume)<1e-8,label);}
 finally{common.delete();probe.delete();}
};
for(const dimensions of [[30,20,20],[80,60,30]])for(const thickness of [1,2,3])for(const plane of ['XY','XZ','YZ']){
 const source=R.makeBox([0,0,0],dimensions),original=source.serialize(),n={XY:2,XZ:1,YZ:0}[plane],tangents=[0,1,2].filter(i=>i!==n),v=tangents[thickness%2],u=tangents.find(i=>i!==v),clearance=.5,pad=thickness+clearance;
 const spec={boxMode:true,chestStyle:true,thickness,clearance,enclosureSplit:plane,splitOffset:dimensions[n]/2,hingeEdge:'+'+'XYZ'[v]};
 const shape=encloseBody(source,thickness,spec);
 try{
  const bounds=shape.boundingBox.bounds,low=dimensions.map(()=>-pad),high=dimensions.map(x=>x+pad),span=high[v]-low[v],rise=Math.min(span*.22,Math.max(2,thickness*1.8,span*.12)),radius=span*span/(8*rise)+rise/2,innerRadius=radius-thickness;
  const center=high[n]+rise-radius,h=(span-2*thickness)/2,midV=(low[v]+high[v])/2,midU=low[u]+(high[u]-low[u])*.43;
  for(const fraction of [-.7,0,.7]){
   const x=h*fraction,y=Math.sqrt(innerRadius**2-x*x),point=[0,0,0];point[u]=midU;point[v]=midV+x;point[n]=center+y-.15;
   checkProbe(shape,point,false,'vault is empty up to the inner curved wall');
   point[v]=midV+x*(innerRadius+thickness/2)/innerRadius;point[n]=center+y*(innerRadius+thickness/2)/innerRadius;
   checkProbe(shape,point,true,'roof retains the requested thickness normal to the arc');
  }
  const point=[0,0,0];point[u]=midU;point[v]=midV;point[n]=high[n]-thickness+.1;
  checkProbe(shape,point,false,'old rectangular ceiling is removed');
  for(const end of [low[u]+thickness/2,high[u]-thickness/2]){point[u]=end;point[n]=high[n]+rise-thickness-.15;checkProbe(shape,point,true,'arched end walls retain their thickness');}
  assert.ok(solidMeshComplete(shape),'curved hollow roof meshes completely');
  const solids=shape.solids;try{assert.equal(solids.length,1);}finally{solids.forEach(s=>s.delete());}
  assert.equal(source.serialize(),original,'source is unchanged');
  assert.ok(bounds[1][n]>high[n]+rise,'exterior bands remain');
 }finally{shape.delete();source.delete();}
}
// Current default walls with reinforced hardware must still open and export.
const source=R.makeBox([0,0,0],[30,20,20]);
try{for(const angle of [0,90]){
 const parts=encloseParts(source,{boxMode:true,chestStyle:true,thickness:3,clearance:.5,enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,seamGap:.3,hingeAngle:angle,hardwareScale:1.3,snapLatch:true,latchProfile:'triangle',latchGap:.3,latchEngagement:1.3});
 try{assert.equal(parts.analysis.latchMotion.unexpectedContactAngle,null);assert.ok(R.measureDistanceBetween(...parts)>.18);parts.forEach(p=>assert.ok(solidMeshComplete(p)));}
 finally{parts.forEach(p=>p.delete());}
}}finally{source.delete();}
console.log('PASS hollow curved roof: removed flat ceiling, retained roof/end-wall thickness, complete meshes, source unchanged, all split planes, sizes and 1/2/3 mm walls, reinforced hinge/latch');
