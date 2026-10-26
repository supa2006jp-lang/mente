import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {bodyRevolution} from '../src/body-revolution.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const doc=JSON.parse(await fs.readFile('tests/fixtures/body-revolve-curved-failure.forma.json','utf8')),features=doc.failure.request.features,p=doc.failure.request.spec,snapshot=JSON.stringify(features),out='.sites-runtime/body-revolve-curved';await fs.mkdir(out,{recursive:true});
const bodies=kernelBodies(features),base=bodies.get(p.sourceBody),before=R.measureVolume(base),beforeArea=R.measureArea(base),shapeOf=o=>R.deserializeShape(o.outputs[0].brep).asShape3D(),rows=[];
function check(shape){const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert(analyzer.IsValid());assert.equal(solids.length,1);}finally{analyzer.delete();solids.forEach(s=>s.delete());}}
function outsideVolume(a,b){const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Cut(),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();let cut;try{args.Append(a.wrapped);tools.Append(b.wrapped);builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.SetFuzzyValue(0);builder.Build();assert(!builder.HasErrors());cut=R.cast(builder.Shape()).asShape3D();return Math.abs(R.measureVolume(cut));}finally{cut?.delete();builder.delete();args.delete();tools.delete();}}
try{
 const cones=base.faces.filter(f=>f.geomType==='CONE');try{assert(cones.length>0);const s=cones[0].surface;try{assert.throws(()=>s.wrapped.Cone(),/unbound types/,'original failure is the unavailable cone API');}finally{s.delete();}}finally{cones.forEach(f=>f.delete());}
 const started=Date.now(),result=runOperation(features,{...p,id:'curved-sweep'}),shape=shapeOf(result);
 try{
  check(shape);const volume=R.measureVolume(shape);assert(volume>before*2);assert.equal(result.outputs[0].id,'curved-sweep');assert.deepEqual(result.remove,[]);
  const poses=[];for(const angle of [0,22.5,45,67.5,90]){const pose=base.clone().rotate(angle,p.origin,p.axisVector);try{const missing=outsideVolume(pose,shape);assert(missing<.01,'entire body is retained along the continuous path at '+angle+' degrees: '+missing);poses.push({angle,missing});}finally{pose.delete();}}
  await fs.writeFile(out+'/result.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[...features,{kind:'cadop',id:'curved-sweep',name:'回転形成',spec:{...p,id:'curved-sweep'},...result}]}));
  const stl=inspectCadStl(result.outputs[0]);assert(stl.report.ok,JSON.stringify(stl.report.issues));
  rows.push({case:'original-new-90',volume,elapsedMs:Date.now()-started,poses,stlClosed:true});
  const joinStart=Date.now(),joined=runOperation(features,{...p,id:'curved-join',operation:'join'}),joinedShape=shapeOf(joined);try{check(joinedShape);assert.equal(joined.outputs[0].id,p.sourceBody);assert(Math.abs(R.measureVolume(joinedShape)-volume)<.01);rows.push({case:'same-body-join',elapsedMs:Date.now()-joinStart});}finally{joinedShape.delete();}
  // Axes must remain correct after a rigid, oblique transformation.
  const shift=new THREE.Vector3(37,-18,23),axis=new THREE.Vector3(1,2,3).normalize(),angle=23,quaternion=new THREE.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180),transform=v=>new THREE.Vector3(...v).applyQuaternion(quaternion).add(shift).toArray(),moved=base.clone().rotate(angle,[0,0,0],axis.toArray()).translate(shift.toArray()),movedSpec={...p,origin:transform(p.origin),axisVector:new THREE.Vector3(...p.axisVector).applyQuaternion(quaternion).toArray()},tiltedStart=Date.now();
  try{const tilted=bodyRevolution(moved,movedSpec);try{check(tilted);assert(Math.abs(R.measureVolume(tilted)-volume)<.02);assert(outsideVolume(moved,tilted)<.01);rows.push({case:'oblique-transformed-body',elapsedMs:Date.now()-tiltedStart});}finally{tilted.delete();}}finally{moved.delete();}
 }finally{shape.delete();}
 // An offset parallel cylinder has an exact annular full-turn volume.
 const cylinder=R.makeCylinder(2,20,[10,0,0],[0,0,1]);try{const shape=bodyRevolution(cylinder,{origin:[0,0,0],axisVector:[0,0,1],angle:360,direction:'片側'});try{check(shape);assert(Math.abs(R.measureVolume(shape)-1600*Math.PI)<.01);rows.push({case:'parallel-cylinder-full-turn',analyticVolume:true});}finally{shape.delete();}}finally{cylinder.delete();}
 assert.equal(JSON.stringify(features),snapshot);assert(Math.abs(R.measureVolume(base)-before)<1e-6);assert(Math.abs(R.measureArea(base)-beforeArea)<1e-6);
 const proof={pass:true,originalFailureReproduced:true,coneAndRoundFaces:true,originalAxisAndNinetyDegrees:true,continuousPath:true,sameBodyJoin:true,obliqueTransform:true,closedStl:true,validSingleSolid:true,sourceUnchanged:true,fullTurnAnalyticVolume:true,rows};await fs.writeFile(out+'/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{for(const body of bodies.values())body.delete();}
