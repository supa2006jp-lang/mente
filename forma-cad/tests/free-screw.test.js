import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {freeScrewBlank} from '../src/free-screw.js';
import {freeScrewSettings,screwCoarsePitches,screwDriveDefaults,screwDriveTypes,screwHeadDefaults,screwHeadTypes} from '../src/free-screw-settings.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {captureSelectionHistory,placeSelectionHistory} from '../src/selection-history.js';
import {threadCylinderInfo} from '../src/thread-cylinder.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));

function screw({diameter=4,head='pan',drive='cross',...overrides}={}){
 const spec={type:'freeScrew',id:'screw',diameter,pitch:screwCoarsePitches.get(diameter),length:3,origin:[18,-2,0],
  head,drive,leftHand:false,...screwHeadDefaults(diameter,head),...overrides};
 return {...screwDriveDefaults(spec),...spec};
}
function validVolume(shape){
 const checker=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
 try{
  assert.ok(checker.IsValid());
  assert.equal(solids.length,1);
  return R.measureVolume(shape);
 }finally{checker.delete();solids.forEach(s=>s.delete());}
}
function bounds(shape){
 const box=shape.boundingBox;
 try{return box.bounds;}finally{box.delete();}
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-4,actual+' expected '+expected);

test('the M sizes load their coarse pitch and invalid recess dimensions are rejected',()=>{
 assert.equal(screw({diameter:2.5}).pitch,.45);
 assert.equal(screw({diameter:3}).pitch,.5);
 assert.equal(screw({diameter:8}).pitch,1.25);
 for(const diameter of screwCoarsePitches.keys())for(const head of Object.keys(screwHeadTypes))for(const drive of Object.keys(screwDriveTypes)){
  assert.doesNotThrow(()=>freeScrewSettings(screw({diameter,head,drive})));
 }
 assert.throws(()=>freeScrewSettings(screw({length:1000})),/100巻き/);
 assert.doesNotThrow(()=>freeScrewSettings(screw({length:1000,threadLength:8})));
 assert.throws(()=>freeScrewSettings(screw({length:3,threadLength:4})),/首下の長さ以下/);
 assert.throws(()=>freeScrewSettings(screw({head:'bar',barThickness:20})),/横棒/);
 assert.throws(()=>freeScrewSettings(screw({tipChamfer:2})),/先端の面取り量/);
 assert.throws(()=>freeScrewSettings(screw({driveDepth:10})),/底に0.1 mm/);
 assert.throws(()=>freeScrewSettings(screw({driveSize:30})),/工具穴の周囲/);
 assert.equal(freeScrewSettings(screw({drive:'none',driveSize:30,driveDepth:50})).driveDepth,undefined);
});

test('each head and recess produces one solid with the chosen head and under-head dimensions',()=>{
 for(const head of Object.keys(screwHeadTypes)){
  let solidVolume;
  for(const drive of ['none','cross','hex','slot']){
   const settings=freeScrewSettings(screw({head,drive})),shape=freeScrewBlank(settings);
   try{
    const volume=validVolume(shape),[min,max]=bounds(shape);
    near(min[2],0);near(max[2],settings.length+settings.headHeight);
    const widthAxis=['bar','knob'].includes(head)?0:1;
    near(max[widthAxis]-min[widthAxis],settings.headSize);
    if(head==='bar')near(max[1]-min[1],Math.max(settings.barThickness,settings.diameter*1.5));
    if(drive==='none')solidVolume=volume;else assert.ok(solidVolume-volume>.01,head+' '+drive);
   }finally{shape.delete();}
  }
 }
});

test('the free screw reuses the real thread generator and keeps the mating-thread settings after library placement',()=>{
 const spec=screw({diameter:3,pitch:.5,head:'cylinder',drive:'hex',leftHand:true});
 assert.equal(freeScrewSettings(spec).threadLength,spec.length,'older saved screws are fully threaded');
 assert.equal(freeScrewSettings(spec).headDown,false);
 const result=runOperation([],spec),output=result.outputs[0];
 assert.equal(output.id,'screw');
 assert.equal(output.threadSource.spec.leftHand,true);
 const blank=freeScrewBlank(freeScrewSettings(spec)),threaded=R.deserializeShape(output.brep).asShape3D();
 try{
  const volume=validVolume(threaded);
  assert.ok(R.measureVolume(blank)>volume+1,'the modeled grooves remove material from the shaft');
  near(bounds(threaded)[1][2],spec.length+spec.headHeight);
 }finally{blank.delete();threaded.delete();}
 const feature={kind:'cadop',id:spec.id,name:'ねじ M3',spec,...result};
 const history=captureSelectionHistory([feature],[spec.id],{});
 const placed=placeSelectionHistory(history,'saved-screw',{},'ねじ');
 const info=runOperation(placed.features,{type:'threadMateInfo',target:placed.targets[0]}).analysis;
 assert.deepEqual([info.diameter,info.pitch,info.length,info.leftHand,info.sourceInternal],[3,.5,3,true,false]);
});

test('a partial thread starts at the tip in either orientation and leaves the rest of the shaft cylindrical',()=>{
 for(const [head,headDown] of [['knob',false],['bar',true]]){
  const spec=screw({length:25,threadLength:4.2,head,drive:'none',headDown,leftHand:true,tipChamfer:.65,origin:[7,-3,2]});
  const [x,y,z]=spec.origin,total=spec.length+spec.headHeight;
  const result=runOperation([],spec),output=result.outputs[0],shape=R.deserializeShape(output.brep).asShape3D();
  const height=point=>headDown?z+total-point:z+point;
  try{
   validVolume(shape);
   const [min,max]=bounds(shape);near(min[2],z);near(max[2],z+total);
   const radius=spec.diameter/2;
   const shank=threadCylinderInfo(shape,[x+radius,y,height((spec.length+spec.threadLength)/2)]);
   assert.ok(shank&&!shank.internal);
   near(shank.height,spec.length-spec.threadLength);
   near(shank.radius,radius);
   let rootVertices=0,tipRadius=0;
   for(let i=0;i<output.vertices.length;i+=3){
    const [px,py,pz]=output.vertices.slice(i,i+3),axial=headDown?z+total-pz:pz-z;
    if(axial>.01&&axial<spec.threadLength-.01&&Math.hypot(px-x,py-y)<radius-.1)rootVertices++;
    if(Math.abs(axial)<1e-5)tipRadius=Math.max(tipRadius,Math.hypot(px-x,py-y));
   }
   assert.ok(rootVertices>10,'threads remain on the tip side after changing orientation');
   near(tipRadius,radius-spec.tipChamfer);
   assert.equal(output.threadSource.spec.leftHand,true);
   assert.equal(output.threadSource.spec.tipChamfer,.65);
   const feature={kind:'cadop',id:spec.id,name:'部分ねじ',spec,...result};
   const mate=runOperation([feature],{type:'threadMateInfo',target:spec.id}).analysis;
   near(mate.length,spec.threadLength);assert.equal(mate.leftHand,true);
  }finally{shape.delete();}
 }
});

test('a separate hex nut can be auto-pulled without changing the screw, and the assembled section shows the fit',()=>{
 const nut={id:'nut',shape:'hex',height:2.8,wall:2,autoPull:false};
 const spec=screw({length:12,threadLength:4.2,head:'cylinder',drive:'none',tipChamfer:.55,headDown:true,leftHand:true,nut});
 const baseline=runOperation([],spec);
 const adjusted={...spec,nut:{...nut,autoPull:true,clearance:.105}};
 const result=runOperation([],adjusted);
 assert.deepEqual(result.outputs.map(body=>body.id),['screw','nut']);
 near(result.outputs[0].shapeMetrics.volume,baseline.outputs[0].shapeMetrics.volume);
 assert.equal(result.outputs[0].threadSource.spec.threadCylinderOffset,undefined);
 assert.equal(result.outputs[1].threadSource.spec.threadCylinderOffset,-.105);
 assert.ok(result.outputs[1].shapeMetrics.volume<baseline.outputs[1].shapeMetrics.volume);
 const [faceMin,faceMax]=result.outputs[1].shapeMetrics.bounds;
 near(faceMax[1]-faceMin[1],spec.diameter+2*nut.wall);
 near(faceMax[2]-faceMin[2],nut.height);
 assert.ok(faceMin[0]>result.outputs[0].shapeMetrics.bounds[1][0]);
 const section=runOperation([],{type:'freeScrewFitSection',settings:adjusted,screwBrep:result.outputs[0].brep,
  nutBrep:result.outputs[1].brep,nutPosition:result.analysis.nut.position});
 assert.ok(section.screw.length>=1&&section.nut.length>=2);
 assert.ok(section.overlapArea<.0005);
 near(section.nutTop-section.nutBottom,nut.height);
 assert.ok(section.nutBottom>spec.headHeight);
});

test('the section identifies overlap when a round nut reaches the plain shaft',()=>{
 const spec=screw({length:12,threadLength:2.8,head:'cylinder',drive:'none',
  nut:{shape:'round',height:4.2,wall:2,autoPull:false}});
 const result=runOperation([],spec);
 const section=runOperation([],{type:'freeScrewFitSection',settings:spec,screwBrep:result.outputs[0].brep,
  nutBrep:result.outputs[1].brep,nutPosition:result.analysis.nut.position});
 assert.ok(section.overlap.length>0&&section.overlapArea>.1);
 assert.ok(section.nutTop>spec.threadLength);
});

test('a head or shaft change can replay the move after a saved screw without adding another body',()=>{
 const spec=screw({head:'hex',drive:'none',length:2});
 const original={kind:'cadop',id:spec.id,name:'ねじ',spec,...runOperation([],spec)};
 const move={type:'move',id:'move',target:spec.id,x:8,y:1,z:5,rotation:[0,0,0]};
 const before=[original,{kind:'cadop',id:'move',name:'移動',spec:move,...runOperation([original],move)}];
 const edited={...spec,length:3,headHeight:4};
 const proposed=[{...original,spec:edited,...runOperation([],edited)},before[1]];
 const {features}=runOperation(proposed,{type:'replay',before,start:1,refreshStart:true});
 const bodies=kernelBodies(features);
 try{
  assert.equal(bodies.size,1);
  const [min,max]=bounds(bodies.get(spec.id));
  near(min[2],5);near(max[2],12);
 }finally{bodies.forEach(body=>body.delete());}
});
