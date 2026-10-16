import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {threadClearanceProfile} from '../src/thread-clearance-profile.js';
import {allThreadPullSpec} from '../src/thread-pull-spec.js';
import {solidMeshComplete} from '../src/solid-mesh.js';

for(const pitch of [.5,1,1.5,2,3])for(const previous of [-pitch*.1,0,pitch*.1]){
 const root=5-pitch*.561266,report=threadClearanceProfile(pitch,root,previous,pitch*.4);
 assert.ok(report.height>report.minimumRidge&&report.width>report.minimumRidge);
 assert.ok(report.maxGap>pitch*.4,'geometric limit must replace the manual 40% guard');
 const near=threadClearanceProfile(pitch,root,previous,report.maxGap);
 assert.ok(near.height>=near.minimumRidge&&near.height<.004,'reported limit must retain a small real ridge');
 assert.throws(()=>threadClearanceProfile(pitch,root,previous,report.maxGap+.002),/ねじ山が残りません.*目安/);
}
assert.throws(()=>allThreadPullSpec({pitch:1.5},-.8),/40%/,'ordinary manual pull retains its existing guard');
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const cylinder={...defaults,id:'bolt',name:'M10',profile:'circle',diameter:10,depth:5};
const spec={type:'thread',target:'bolt',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,surfacePoint:[5,0,3]};
const history=[cylinder,{kind:'cadop',id:'thread',name:'M10ねじ',spec,...runOperation([cylinder],spec)}];
const snapshot=JSON.stringify(history),male=R.deserializeShape(history[1].outputs[0].brep).asShape3D();
const feature={...defaults,kind:'extrusion',id:'female',name:'受け側',width:20,height:20,depth:5,barrier:true};
const maximum=threadClearanceProfile(1.5,5-1.5*.561266,0,.6).maxGap;
try{
 for(const gap of [.6,.8,1.1,maximum]){
  const f={...feature,barrierGap:gap},stages=[];
  const preview=runOperation(history,{type:'extrusionToolPreview',feature:f});
  const report=preview.barrierThreadProfiles[0];
  assert.equal(report.maxGap,maximum);assert.ok(report.height>=.001);
  const repeat=runOperation(history,{type:'extrusionToolPreview',feature:f},progress=>stages.push(progress.stage));
  assert.deepEqual(repeat.barrierThreadProfiles,preview.barrierThreadProfiles);
  assert.ok(!stages.includes('ねじ山に沿うすき間形状を作成しています'),'repeat previews reuse validated geometry and profile reports');
  const result=runOperation(history,{type:'extrusion',feature:f}),shape=R.deserializeShape(result.outputs[0].brep).asShape3D();
  try{
   const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
   try{assert.ok(check.IsValid(),'near-limit output must be valid');}finally{check.delete();}
   assert.ok(solidMeshComplete(shape),'near-limit thread must export a complete mesh');
   const distance=R.measureDistanceBetween(shape,male);
   assert.ok(distance>=gap-1e-5&&distance<gap+.004,`${gap}: actual clearance ${distance}`);
   const faces=shape.faces;try{assert.ok(faces.some(face=>face.geomType==='BSPLINE_SURFACE'),'helical ridges must survive');}finally{faces.forEach(face=>face.delete());}
   const bore=R.makeCylinder(5+report.clearance,2.5,[0,0,1.25]);let ridge;
   try{ridge=shape.intersect(bore);assert.ok(R.measureVolume(ridge)>1e-7,'actual ridge material must protrude into the bore');}finally{ridge?.delete();bore.delete();}
  }finally{shape.delete();}
  validateProject({format:'forma-cad',version:1,features:[...history,{...f,cadResult:result}]});
  console.log('PASS actual helical cavity gap '+gap+' mm, ridge height '+report.height+' mm');
 }
 const over={...feature,barrierGap:maximum+.002},stages=[];
 assert.throws(()=>runOperation(history,{type:'extrusionToolPreview',feature:over},progress=>stages.push(progress.stage)),/ねじ山が残りません.*目安/);
 assert.ok(!stages.includes('ねじ山に沿うすき間形状を作成しています'),'reject erased ridges before expensive helix generation');
 assert.equal(JSON.stringify(history),snapshot,'failed and successful operations preserve the source screw');
}finally{male.delete();}
console.log('PASS geometric thread clearance limits, pitches, pulled profiles, preview cache, source preservation and over-limit rejection');
