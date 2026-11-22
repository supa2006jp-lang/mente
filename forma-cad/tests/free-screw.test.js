import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {freeScrewBlank} from '../src/free-screw.js';
import {freeScrewSettings,screwCoarsePitches,screwDriveDefaults,screwDriveTypes,screwHeadDefaults,screwHeadTypes} from '../src/free-screw-settings.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {captureSelectionHistory,placeSelectionHistory} from '../src/selection-history.js';

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
    near(max[1]-min[1],settings.headSize);
    if(drive==='none')solidVolume=volume;else assert.ok(solidVolume-volume>.01,head+' '+drive);
   }finally{shape.delete();}
  }
 }
});

test('the free screw reuses the real thread generator and keeps the mating-thread settings after library placement',()=>{
 const spec=screw({diameter:3,pitch:.5,head:'cylinder',drive:'hex',leftHand:true});
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
