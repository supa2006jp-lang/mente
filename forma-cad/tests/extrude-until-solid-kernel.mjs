import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));

const blocker=(id,x,z)=>({...defaults,id,name:id,kind:'extrusion',width:10,height:10,x,z,depth:2});
const extrusion=(z,depth)=>({...defaults,id:'tool',name:'Until solid',kind:'extrusion',width:20,height:10,z,depth,untilSolid:true});
const volume=shape=>R.measureVolume(shape);

function testResult(blockers,feature,expectedHeight,expectedVolume,label){
 const output=runOperation(blockers,{type:'extrusion',target:'',feature}).outputs[0];
 assert.equal(output.id,'tool',`${label}: new body is created`);
 const shape=R.deserializeShape(output.brep).asShape3D();
 try{
  assert.ok(Math.abs(volume(shape)-expectedVolume)<2,`${label}: volume ${volume(shape)} should be ${expectedVolume}`);
  const [leftHeight,rightHeight]=expectedHeight;
  const start=feature.z,sign=Math.sign(feature.depth);
  const section=(x0,x1)=>{
   const sectionBox=R.makeBox([x0,-4,Math.min(start,start+feature.depth)-1],[x1,4,Math.max(start,start+feature.depth)+1]);
   try{const intersection=shape.intersect(sectionBox);try{return volume(intersection);}finally{intersection.delete();}}finally{sectionBox.delete();}
  };
  assert.ok(Math.abs(section(-9,-1)-8*8*leftHeight)<1,`${label}: left section stops at its own first contact`);
  assert.ok(Math.abs(section(1,9)-8*8*rightHeight)<1,`${label}: right section reaches its independent stop`);
  const contains=(x,z,inside)=>{
   const probe=R.makeBox([x-.25,-.25,z-.25],[x+.25,.25,z+.25]);
   try{const intersection=shape.intersect(probe);try{
    const amount=volume(intersection);
    assert.ok(inside?amount>.11:amount<1e-5,`${label}: x=${x}, z=${z}, inside=${inside}, overlap=${amount}`);
   }finally{intersection.delete();}}finally{probe.delete();}
  };
  contains(-5,start+sign*(leftHeight-.5),true);
  contains(-5,start+sign*(leftHeight+.5),false);
  contains(5,start+sign*(rightHeight-.5),true);
  contains(5,start+sign*(rightHeight+.5),false);
 }finally{shape.delete();}
}

// The left half contacts an obstacle at 8 mm; the right half keeps going until 14 mm.
const upwardBlockers=[blocker('near',-5,8),blocker('far',5,14)];
testResult(upwardBlockers,extrusion(0,20),[8,14],2200,'two blockers in +Z');

// One region contacts early; the other contacts exactly at the distance limit.
// Both regions have a real destination surface.
testResult([upwardBlockers[0],blocker('limit-face',5,20)],extrusion(0,20),[8,20],2800,'early and exact-limit contacts');

// The uncovered half ends at the farthest real first contact, not the search cap.
for(const depth of [8,20]){
 const output=runOperation([upwardBlockers[0]],{type:'extrusion',target:'',feature:extrusion(0,depth)}).outputs[0];
 const shape=R.deserializeShape(output.brep).asShape3D();
 try{assert.ok(Math.abs(volume(shape)-1600)<1,'uncovered half also extends to the real contact depth');}
 finally{shape.delete();}
}

// The same first-contact behavior must work when extrusion is reversed.
const downwardBlockers=[blocker('near',-5,10),blocker('far',5,4)];
testResult(downwardBlockers,extrusion(20,-20),[8,14],2200,'two blockers in -Z');

// Reaching a face exactly is a valid contact even though the clipping cut removes no volume.
const exact=runOperation([{...blocker('end-face',0,8),width:20}],{type:'extrusion',target:'',feature:extrusion(0,8)}).outputs[0];
const exactShape=R.deserializeShape(exact.brep).asShape3D();
try{assert.ok(Math.abs(volume(exactShape)-1600)<1,'exact end-face contact must succeed');}
finally{exactShape.delete();}

// A join can use its own selected target as the contact surface when starting elsewhere.
const partialJoinTarget=blocker('partial-join-target',0,8);
const partialJoin=runOperation([partialJoinTarget],{type:'extrusion',target:partialJoinTarget.id,feature:{...extrusion(0,20),operation:'join',target:partialJoinTarget.id}}).outputs[0];
const partialJoinShape=R.deserializeShape(partialJoin.brep).asShape3D();
try{assert.ok(Math.abs(volume(partialJoinShape)-1800)<1,'uncovered join wings end at the last contact');}
finally{partialJoinShape.delete();}
const joinTarget={...blocker('join-target',0,8),width:20};
const joined=runOperation([joinTarget],{type:'extrusion',target:joinTarget.id,feature:{...extrusion(0,20),operation:'join',target:joinTarget.id}}).outputs[0];
const joinedShape=R.deserializeShape(joined.brep).asShape3D();
try{assert.ok(Math.abs(volume(joinedShape)-2000)<1,'fully covered join extrusion stops at the target face: '+volume(joinedShape));}
finally{joinedShape.delete();}

// Touching only a lateral side is not a forward stop.
assert.throws(()=>runOperation([blocker('side-only',15,8)],{type:'extrusion',target:'',feature:extrusion(0,20)}),/接触するソリッドがありません/);

console.log('PASS until-solid surface-only contact, partial coverage and reverse direction');

// Reproducer from the supplied design: 20 mm source face meets a 19.093 mm
// triangular prism along -X. The upper band has no destination surface.
const source='source-box',height=19.093258305279406,y=6.17083;
const features=[
 {...defaults,id:'triangle',kind:'extrusion',profile:'region',depth:height,region:{plane:'XY',offset:0,outer:[[40,50],[0,50],[0,0]],holes:[]}},
 {...defaults,id:source,kind:'extrusion',width:30,height:40,depth:20,x:75,y:y+20},
];
const frame={u:[0,1,0],v:[0,0,-1],n:[-1,0,0]};
const region={plane:'CUSTOM',frame,offset:-60,outer:[[y,-20],[y+40,-20],[y+40,0],[y,0]],holes:[],bodyId:source,cadFace:{bodyId:source,point:[60,y+20,10],normal:[-1,0,0]}};
const bridge=runOperation(features,{type:'extrusion',target:source,feature:{...defaults,id:'bridge',kind:'extrusion',profile:'region',region,plane:'CUSTOM',frame,operation:'join',target:source,depth:60.1,untilSolid:true}}).outputs[0];
const bridgeShape=R.deserializeShape(bridge.brep).asShape3D();
try{
 const lastContact=60-.8*y;
 const expected=24000+40*(60-.8*(y+20))*height+40*(20-height)*lastContact;
 assert.ok(Math.abs(volume(bridgeShape)-expected)<1e-4,'the supplied shape connects to its sloped destination despite the height difference');
 const upper=R.makeBox([-1,y+.1,height+.05],[59,y+39.9,19.95]);
 try{const extra=bridgeShape.intersect(upper);try{assert.ok(Math.abs(volume(extra))>100,'uncontacted upper band must be created');}finally{extra.delete();}}finally{upper.delete();}
}finally{bridgeShape.delete();}
console.log('PASS sloped destination and source-face height mismatch');

// A manual limit can stop before any surface; the search still finds the
// eventual destination independently of this shorter requested depth.
testResult(upwardBlockers,extrusion(0,4),[4,4],800,'manual limit before first contact');
testResult(downwardBlockers,extrusion(20,-4),[4,4],800,'reverse manual limit');
const preview=runOperation(features,{type:'extrusionToolPreview',feature:{...defaults,id:'short-bridge',kind:'extrusion',profile:'region',region,plane:'CUSTOM',frame,operation:'join',target:source,depth:10,untilSolid:true}});
assert.ok(Math.abs(preview.contactDepth-(60-.8*y))<1e-5,'automatic last contact uses the sloped surface, not its world AABB');
assert.equal(preview.depth,10,'requested manual depth is preserved');
const shortBridge=runOperation(features,{type:'extrusion',target:source,feature:{...defaults,id:'short-bridge',kind:'extrusion',profile:'region',region,plane:'CUSTOM',frame,operation:'join',target:source,depth:10,untilSolid:true}}).outputs[0];
const shortShape=R.deserializeShape(shortBridge.brep).asShape3D();
try{assert.ok(Math.abs(volume(shortShape)-32000)<1e-4,'manual bridge retains the full height and can stop before touching');}finally{shortShape.delete();}
console.log('PASS unmatched last-contact extension and manual shortening');

// Restore the contacted-footprint-only mode as a saved independent option.
for(const [start,depth,obstacle,expected] of [[0,20,upwardBlockers[0],800],[0,4,upwardBlockers[0],400],[20,-20,downwardBlockers[0],800],[20,-4,downwardBlockers[0],400]]){
 const feature={...extrusion(start,depth),contactOnly:true};
 const result=runOperation([obstacle],{type:'extrusion',target:'',feature}).outputs[0];
 const shape=R.deserializeShape(result.brep).asShape3D();
 try{assert.ok(Math.abs(volume(shape)-expected)<1,'contact-only keeps only the eventual contacted footprint, including manual shortening');}
 finally{shape.delete();}
}
const contactBridge=runOperation(features,{type:'extrusion',target:source,feature:{...defaults,id:'contact-bridge',kind:'extrusion',profile:'region',region,plane:'CUSTOM',frame,operation:'join',target:source,depth:60.1,untilSolid:true,contactOnly:true}}).outputs[0];
const contactBridgeShape=R.deserializeShape(contactBridge.brep).asShape3D();
try{
 const expected=24000+40*(60-.8*(y+20))*height;
 assert.ok(Math.abs(volume(contactBridgeShape)-expected)<1e-4,'contact-only excludes the unmatched top band of the supplied sloped model');
}finally{contactBridgeShape.delete();}
console.log('PASS optional contact-only footprint, reverse, manual stop and sloped model');

function meshVolume(mesh){
 const {vertices:v,triangles:t}=mesh;let sum=0;
 for(let i=0;i<t.length;i+=3){
  const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;
  sum+=v[a]*(v[b+1]*v[c+2]-v[b+2]*v[c+1])+v[a+1]*(v[b+2]*v[c]-v[b]*v[c+2])+v[a+2]*(v[b]*v[c+1]-v[b+1]*v[c]);
 }
 return Math.abs(sum/6);
}
for(const [z,depth,obstacle,contactOnly,expected] of [[0,20,upwardBlockers[0],false,800],[0,4,upwardBlockers[0],false,400],[20,-4,downwardBlockers[0],false,400],[0,4,upwardBlockers[0],true,400]]){
 const result=runOperation([obstacle],{type:'extrusionToolPreview',feature:{...extrusion(z,depth),contactOnly}});
 const contact=result.outputs.find(o=>o.role==='contacted'),free=result.outputs.find(o=>o.role==='uncontacted');
 assert.ok(contact,'contacted preview region exists');
 assert.ok(Math.abs(meshVolume(contact)-expected)<1e-4,'contacted preview mesh has exact requested volume');
 if(contactOnly)assert.equal(free,undefined,'contact-only has no unmatched preview');
 else{assert.ok(free);assert.ok(Math.abs(meshVolume(free)-expected)<1e-4,'unmatched preview has its own complete volume');}
}
const allContact=runOperation(upwardBlockers,{type:'extrusionToolPreview',feature:extrusion(0,20)});
assert.equal(allContact.outputs.length,1,'fully covered preview omits empty unmatched geometry');
assert.equal(allContact.outputs[0].role,'contacted');
console.log('PASS preview colour regions, manual shortening, reverse and fully contacted footprint');
