import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseBody,encloseParts} from '../src/enclose.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {cleanBinaryStl} from '../src/clean-stl.js';
import {binaryStlReport} from './stl-topology.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function probe(shape,point,filled,label){
 const box=R.makeBox(point.map(x=>x-.02),point.map(x=>x+.02)),common=shape.intersect(box);
 try{const volume=R.measureVolume(common);assert.ok(filled?volume>.00006:Math.abs(volume)<1e-8,label);}finally{common.delete();box.delete();}
}
for(const [plane,dimensions,hinge]of [['XY',[60,40,40],'+Y'],['XY',[40,60,40],'+Y'],['XZ',[60,40,40],'-Z'],['YZ',[40,60,40],'+Y']]){
 const source=R.makeBox([0,0,0],dimensions),before=source.serialize(),n={XY:2,XZ:1,YZ:0}[plane],tangents=[0,1,2].filter(i=>i!==n),u=tangents.reduce((best,i)=>dimensions[i]>dimensions[best]?i:best),v=tangents.find(i=>i!==u),pad=3.5,low=dimensions.map(()=>-pad),high=dimensions.map(x=>x+pad),split=dimensions[n]*.43;
 const p={boxMode:true,chestStyle:true,thickness:3,clearance:.5,enclosureSplit:plane,splitOffset:split,hingeEdge:hinge};
 const shape=encloseBody(source,3,p);
 try{
  const point=[0,0,0];point[u]=dimensions[u]/2;point[n]=low[n]+.4;
  for(const side of [-1,1]){
   point[v]=side<0?low[v]-.4:high[v]+.4;
   probe(shape,point,true,'bottom horizontal frame on both wide faces');point[n]=split-.4;probe(shape,point,true,'body seam frame');point[n]=split+.4;probe(shape,point,true,'lid seam frame');point[n]=high[n]-.4;probe(shape,point,true,'lid top rim frame');
   point[n]=(low[n]+split)/2;probe(shape,point,false,'body panel stays recessed');point[n]=(split+high[n])/2;probe(shape,point,false,'lid panel stays recessed');
   for(const end of [low[u]+.4,high[u]-.4]){point[u]=end;probe(shape,point,true,'vertical corner frames');}
   point[u]=dimensions[u]/2;point[n]=low[n]+.4;
  }
  point[v]=dimensions[v]/2;point[n]=(low[n]+split)/2;
  for(const end of [low[u]-.3,high[u]+.3]){point[u]=end;probe(shape,point,false,'narrow end faces have no protruding relief');}
  point[u]=dimensions[u]/2;point[v]=dimensions[v]/2;point[n]=dimensions[n]/2;probe(shape,point,false,'storage cavity is unchanged');
  const roofV='XYZ'.indexOf(hinge.slice(1)),roofU=tangents.find(i=>i!==roofV),span=high[roofV]-low[roofV],length=high[roofU]-low[roofU],rise=Math.min(span*.22,Math.max(2,3*1.8,span*.12)),radius=span*span/(8*rise)+rise/2;
  const top=(axisU,axisV,lift)=>{const p=[0,0,0];p[roofU]=axisU;p[roofV]=axisV;p[n]=high[n]+rise-radius+Math.sqrt(radius*radius-(axisV-(low[roofV]+high[roofV])/2)**2)+lift;return p;};
  for(const [axisU,axisV]of [[low[roofU]+.4,dimensions[roofV]/2],[high[roofU]-.4,dimensions[roofV]/2],[low[roofU]+length*.43,low[roofV]+.4],[low[roofU]+length*.43,high[roofV]-.4]])probe(shape,top(axisU,axisV,.4),true,'all four roof perimeter edges have raised relief');
  probe(shape,top(low[roofU]+length*.43,dimensions[roofV]/2,.4),false,'roof panel between the rim and original bands remains lower');
  for(const end of [low[roofU]-.3,high[roofU]+.3])probe(shape,top(end,dimensions[roofV]/2,.4),false,'arched rim does not project beyond the end faces');
  assert.ok(solidMeshComplete(shape),'frame meshes completely');const solids=shape.solids;try{assert.equal(solids.length,1,'frame is fused to the chest');}finally{solids.forEach(s=>s.delete());}
  assert.equal(source.serialize(),before,'source stays unchanged');
 }finally{shape.delete();source.delete();}
}
const source=R.makeBox([0,0,0],[60,40,40]);
try{for(const angle of [0,90]){
 const spec={boxMode:true,chestStyle:true,thickness:3,clearance:.5,enclosureSplit:'XY',splitOffset:20,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,seamGap:.3,hingeAngle:angle,hardwareScale:1.3,snapLatch:true,latchProfile:'triangle',latchGap:.3,latchEngagement:1.3};
 const parts=encloseParts(source,spec);
 try{
  assert.equal(parts.analysis.latchMotion.unexpectedContactAngle,null,'relief does not obstruct opening');
  assert.ok(R.measureDistanceBetween(...parts)>.18,'lid and body retain their gap');
  assert.ok(Math.abs(parts.hingeFrame.point[1]-(40+3.5+((1.65*1.3)+.5+(1.95*1.3))+1.2))<1e-6,'hinge axis stays at the structural wall');
  for(const part of parts){
   assert.ok(solidMeshComplete(part));const solids=part.solids;try{assert.equal(solids.length,1);}finally{solids.forEach(s=>s.delete());}
   const data=part.mesh({tolerance:.08,angularTolerance:.15}),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));geometry.setIndex(data.triangles);const mesh=new THREE.Mesh(geometry);mesh.updateMatrixWorld(true);
   try{const report=binaryStlReport(cleanBinaryStl(new STLExporter().parse(mesh,{binary:true})));for(const key of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[key],0,'decorated body/lid STL '+key);}finally{geometry.dispose();mesh.material.dispose();}
  }
 }finally{parts.forEach(part=>part.delete());}
}}finally{source.delete();}
console.log('PASS complete curved roof perimeter, existing bands and recessed panels, wide-face frames, flush end faces, storage cavity, all split planes, hinge axis, opening clearance and closed STL');
