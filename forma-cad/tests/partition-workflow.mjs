import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,makeGeometry,validateProject} from '../src/geometry.js';
import {findRegions,regionContains} from '../src/regions.js';
import {worldPoint} from '../src/frames.js';
import {sketchSolidOverlapRegions,sketchRegionHit} from '../src/sketch-solid-overlap.js';
import {runOperation,kernelBodies,featureSolid,resolveHistoryPartition} from '../src/kernel.js';
import {reverseExtrusionFrame} from '../src/extrusion-direction.js';
import {regionOffsetSketches,linkRegionOffset} from '../src/linked-sketch-offset.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'cylinder',name:'円柱',kind:'extrusion',profile:'circle',diameter:20,depth:20};
const sketch={...defaults,id:'triangle',name:'三角形',kind:'sketch',profile:'polyline',points:[[0,0],[30,0],[30,30]],closed:true,z:10};
const source=findRegions([sketch])[0],sector=Math.PI*100/8;
const mesh=new THREE.Mesh(makeGeometry(base));mesh.userData.bodyId=base.id;
const parts=sketchSolidOverlapRegions([source],[mesh],{includeOutside:true});
assert.equal(parts.length,2);
const inside=parts.find(r=>r.partitionSide==='inside'),outside=parts.find(r=>r.partitionSide==='outside');
const near=(a,b,tolerance=.003)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
near(inside.area,sector,.1);near(outside.area,450-sector,.1);near(inside.area+outside.area,450,.0001);
assert.ok(regionContains(outside,[20,2]));assert.ok(!regionContains(outside,[5,2]));
const outsideHit={distance:10,point:worldPoint(outside,[20,2]),object:{visible:true,userData:{region:outside}}};
const fullHit={...outsideHit,object:{visible:true,userData:{region:source}}};
assert.equal(sketchRegionHit([fullHit,outsideHit]).region.partitionSide,'outside');
assert.equal(sketchRegionHit([outsideHit,fullHit],null,{whole:true}).region.id,source.id);
function valid(shape,expected){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());if(expected!==undefined)near(R.measureVolume(shape),expected);}finally{check.delete();}}
const feature=region=>({...defaults,id:'patch',name:'領域押し出し',kind:'extrusion',profile:'region',region,overlapOnly:true,overlapTargets:region.overlapTargets,z:10,depth:4});
{
 const bodies=kernelBodies([base]);try{
  for(const region of [outside,reverseExtrusionFrame(feature(outside)).region]){
   const shape=featureSolid({...feature(region),plane:region.plane,frame:region.frame},bodies);try{valid(shape,(450-sector)*4);}finally{shape.delete();}
  }
  const thin=featureSolid({...feature(outside),overlapOnly:false,mode:'thin',wall:.5},bodies);try{valid(thin);assert.ok(R.measureVolume(thin)>1);}finally{thin.delete();}
 }finally{for(const body of bodies.values())body.delete();}
 const result=runOperation([base],{type:'revolve',id:'turn',region:outside,origin:[0,0,10],axisVector:[1,0,0],angle:60,operation:'new'});
 const shape=R.deserializeShape(result.outputs[0].brep).asShape3D();try{valid(shape);}finally{shape.delete();}
 const upper={...outside,offset:15,overlapSource:{...source,offset:15},overlapPoint:outside.overlapPoint.map((v,i)=>i===2?15:v)};
 const loft=runOperation([base],{type:'loft',id:'loft',sections:[outside,upper]});
 const solid=R.deserializeShape(loft.outputs[0].brep).asShape3D();try{valid(solid,(450-sector)*5);}finally{solid.delete();}
}
function made(region){const f=feature(region);return {...f,cadResult:runOperation([base,sketch],{type:'extrusion',feature:f})};}
function volume(feature){const shape=R.deserializeShape(feature.cadResult?.outputs[0].brep||feature.outputs[0].brep).asShape3D();try{return R.measureVolume(shape);}finally{shape.delete();}}
for(const region of [inside,outside,reverseExtrusionFrame(feature(outside)).region]){
 const before=[base,sketch,made(region)],snapshot=JSON.stringify(before);
 let next=structuredClone(before);next[0].diameter=24;
 let updated=runOperation(next,{type:'replay',before,start:0}).features;
 near(volume(updated[2]),(region.partitionSide==='outside'?450-Math.PI*144/8:Math.PI*144/8)*4);
 assert.equal(updated[2].region.id,region.id);assert.equal(updated[2].region.partitionSide,region.partitionSide);
 next=structuredClone(before);next[1].points=[[0,0],[40,0],[40,40]];
 updated=runOperation(next,{type:'replay',before,start:1}).features;
 near(volume(updated[2]),(region.partitionSide==='outside'?800-sector:sector)*4);
 assert.notEqual(updated[2].region.overlapSource.id,source.id);
 assert.equal(JSON.stringify(before),snapshot,'replay never changes original data');
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:updated})));
 assert.equal(saved[2].region.partitionSide,region.partitionSide);
 if(region.partitionSide==='outside'){
  next=structuredClone(before);next[0].diameter=100;
  assert.throws(()=>runOperation(next,{type:'replay',before,start:0}),/領域がなくなりました/);
  assert.equal(JSON.stringify(before),snapshot);
 }
}
// Disconnected outside islands remain independent and cannot jump components.
{
 const cutSketch={...sketch,id:'rectangle',points:[[-20,-1],[20,-1],[20,1],[-20,1]]},r=findRegions([cutSketch])[0];
 const divided=sketchSolidOverlapRegions([r],[mesh],{includeOutside:true}).filter(r=>r.partitionSide==='outside');
 assert.equal(divided.length,2);assert.ok(divided.every(r=>r.partitionCount===2));
 const left=divided.find(r=>r.outer.every(p=>p[0]<0)),right=divided.find(r=>r.outer.every(p=>p[0]>0));assert.ok(left&&right);
 const result=resolveHistoryPartition(left,[{...base,diameter:24}]);assert.ok(result.outer.every(p=>p[0]<0));
 assert.ok(regionContains(resolveHistoryPartition(left,[{...base,x:30}]),[-15,0]),'other component changes do not invalidate selection');
 const cover={...source,outer:[[-20,-20],[20,-20],[20,20],[-20,20]],holes:[],area:1600};
 const one=sketchSolidOverlapRegions([cover],[mesh],{includeOutside:true})[0];
 const cut={...defaults,id:'divide',name:'分割切り取り',kind:'extrusion',profile:'rect',width:2,height:30,depth:20,operation:'cut',target:base.id};
 assert.throws(()=>resolveHistoryPartition(one,[base,cut]),/領域が複数に分かれ/);
}
// Region offsets keep their link and update downstream extrusions after edits.
{
 const copies=linkRegionOffset(regionOffsetSketches(outside,1),outside,1);
 const r=findRegions(copies)[0],f={...defaults,id:'offset-solid',name:'オフセット押し出し',kind:'extrusion',profile:'region',region:r,z:10,depth:3};
 const before=[base,sketch,...copies,f],snapshot=JSON.stringify(before),next=structuredClone(before);next[0].diameter=26;
 const updated=runOperation(next,{type:'replay',before,start:0}).features;
 assert.ok(updated[2].offsetLink);assert.equal(updated[2].id,copies[0].id);
 assert.notDeepEqual(updated[2].points,copies[0].points);
 assert.ok(updated.at(-1).region.area<f.region.area);
 assert.equal(JSON.stringify(before),snapshot);
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:updated})));assert.ok(saved[2].offsetLink);
 const bad=structuredClone(saved);bad[2].offsetLink.index=100;assert.throws(()=>validateProject({format:'forma-cad',version:1,features:bad}),/追従情報/);
 const all=linkRegionOffset(regionOffsetSketches(outside,1,true),outside,1,true);
 const allBefore=[base,sketch,...all],allNext=structuredClone(allBefore);allNext[0].diameter=24;
 const allUpdated=runOperation(allNext,{type:'replay',before:allBefore,start:0}).features;
 assert.equal(allUpdated.length,allBefore.length);assert.ok(allUpdated.slice(2).every(f=>f.offsetLink?.allAround));
}
// Revolve and loft recipes also update their exact profile after diameter edits.
for(const type of ['revolve','loft']){
 const upperSketch={...sketch,id:'upper',z:15},upperSource=findRegions([upperSketch])[0];
 const upper=sketchSolidOverlapRegions([upperSource],[mesh],{includeOutside:true}).find(r=>r.partitionSide==='outside');
 const prefix=type==='loft'?[base,sketch,upperSketch]:[base,sketch];
 const spec=type==='loft'?{type,id:'derived',sections:[outside,upper]}:{type,id:'derived',region:outside,origin:[0,0,10],axisVector:[1,0,0],angle:60,operation:'new'};
 const before=[...prefix,{kind:'cadop',id:'derived',name:type,spec,...runOperation(prefix,spec)}],next=structuredClone(before);next[0].diameter=24;
 const updated=runOperation(next,{type:'replay',before,start:0}).features;
 assert.ok(volume(updated.at(-1))<volume(before.at(-1)));
 if(type==='loft')near(volume(updated.at(-1)),(450-Math.PI*144/8)*5);
}
// Native source arcs and holes survive outside subtraction and multiple bodies.
{
 const extra={...base,id:'second',x:25},cover={id:'cover',plane:'XY',offset:10,outer:[[-20,-20],[50,-20],[50,20],[-20,20]],holes:[],area:2800};
 const r={...cover,id:'outside',overlapSource:cover,partitionSide:'outside',overlapTargets:['cylinder','second'],overlapPoint:[-15,0,10]};
 const bodies=kernelBodies([base,extra]);try{const shape=featureSolid(feature(r),bodies);try{valid(shape,(2800-2*Math.PI*100)*4);}finally{shape.delete();}}finally{for(const body of bodies.values())body.delete();}
}
await fs.writeFile('outputs/partition-fixture.json',JSON.stringify({format:'forma-cad',version:1,features:[base,sketch]}));
mesh.geometry.dispose();mesh.material.dispose();
console.log('PASS outside/inside picking, native extrusion/revolve/loft/thin, reverse frame, multi-body difference, diameter/sketch replay, linked offsets, save/reload and atomic topology failures');
