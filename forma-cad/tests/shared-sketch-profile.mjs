import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,validateFeature} from '../src/geometry.js';
import {runOperation,kernelBodies,featureSolid,commandProfileFaces} from '../src/kernel.js';
import {sketchRegionHit} from '../src/sketch-solid-overlap.js';
import {regionExtrusions} from '../src/region-extrusions.js';
import {batchExtrusionFeature} from '../src/extrusion-targets.js';
import {offsetSketch} from '../src/sketch-offset.js';
import {findRegions} from '../src/regions.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'cylinder',kind:'extrusion',profile:'circle',diameter:20,depth:20};
const source={id:'triangle',plane:'XY',offset:10,outer:[[0,0],[30,0],[30,30]],holes:[],area:450,sourceIds:['sketch']};
// Deliberately coarse display polygon: commands must recover native geometry.
const selected={...source,id:'triangle:overlap:0',outer:[[0,0],[8,0],[8,8]],area:32,overlapSource:source,overlapTargets:['cylinder'],overlapPoint:[5,2,10]};
const close=(a,b)=>assert.ok(Math.abs(a-b)<.003,`${a} != ${b}`);
function inspect(shape,expected){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());if(expected!==undefined)close(R.measureVolume(shape),expected);}finally{check.delete();}}
function operation(spec){const result=runOperation([base],spec);return R.deserializeShape(result.outputs[0].brep).asShape3D();}
{
 const shape=operation({id:'revolved',type:'revolve',region:selected,origin:[0,0,10],axisVector:[1,0,0],angle:360,operation:'new'});
 try{inspect(shape,2*Math.PI*1000/3*(1-Math.SQRT1_2));}finally{shape.delete();}
}
{
 const second={...selected,offset:20,overlapSource:{...source,offset:20},overlapPoint:[5,2,20]};
 const shape=operation({id:'loft',type:'loft',sections:[selected,second]});
 try{inspect(shape,Math.PI*100/8*10);const faces=shape.faces;try{assert.ok(faces.some(f=>f.geomType==='CYLINDRE'),'native circular loft wall');}finally{faces.forEach(f=>f.delete());}}finally{shape.delete();}
}
{
 const bodies=kernelBodies([base]);try{
  for(const side of ['inside','outside','center']){
   const f={...defaults,id:'thin',kind:'extrusion',profile:'region',region:selected,z:10,mode:'thin',depth:4,wall:.5,side};validateFeature(f);
   const shape=featureSolid(f,bodies);try{inspect(shape);assert.ok(R.measureVolume(shape)>1);const faces=shape.faces;try{assert.ok(faces.some(f=>f.geomType==='CYLINDRE'),'native circular thin wall');}finally{faces.forEach(f=>f.delete());}}finally{shape.delete();}
  }
  assert.throws(()=>commandProfileFaces({...selected,overlapTargets:['missing']},bodies),/参照先ボディ/);
  assert.throws(()=>commandProfileFaces({...selected,overlapPoint:[20,20,10]},bodies),/重なっていません/);
 }finally{for(const shape of bodies.values())shape.delete();}
 const [f]=regionExtrusions({...defaults,kind:'extrusion',mode:'thin'},[selected]);assert.equal(f.overlapOnly,false);assert.deepEqual(f.region.overlapPoint,selected.overlapPoint);
 const thin={...f,id:'batch-thin',target:'other',wall:.5,depth:4},result=runOperation([{...base,id:'other',x:100},base],{type:'extrusionBatch',features:[thin]});
 const shape=R.deserializeShape(result.features[0].cadResult.outputs[0].brep).asShape3D();try{inspect(shape);}finally{shape.delete();}
 const remapped=batchExtrusionFeature(thin,[{operation:'join',cadResult:{remove:['cylinder'],outputs:[{id:'merged'}]}}]);assert.deepEqual(remapped.region.overlapTargets,['merged']);assert.deepEqual(thin.region.overlapTargets,['cylinder']);
}
{
 const hole={...defaults,id:'bore',kind:'extrusion',profile:'circle',diameter:4,depth:20,operation:'cut',target:base.id};
 const cover={...source,outer:[[-20,-20],[20,-20],[20,20],[-20,20]],area:1600};
 const r={...cover,id:'ring',overlapSource:cover,overlapTargets:['cylinder'],overlapPoint:[5,0,10]};
 const result=runOperation([base,hole],{id:'ring-turn',type:'revolve',region:r,origin:[0,-20,10],axisVector:[1,0,0],angle:360,operation:'new'});
 const shape=R.deserializeShape(result.outputs[0].brep).asShape3D();try{inspect(shape,2*Math.PI*20*Math.PI*96);}finally{shape.delete();}
 const second={...r,offset:20,overlapSource:{...cover,offset:20},overlapPoint:[5,0,20]};
 const loft=runOperation([base,hole],{id:'ring-loft',type:'loft',sections:[r,second]}),tube=R.deserializeShape(loft.outputs[0].brep).asShape3D();try{inspect(tube,Math.PI*96*10);}finally{tube.delete();}
}
{
 const full={object:{visible:true,userData:{region:source}},distance:10,point:new THREE.Vector3(5,2,10)},patch={...full,object:{visible:true,userData:{region:selected}}};
 assert.equal(sketchRegionHit([full,patch],{distance:10}).region.id,selected.id);
 assert.equal(sketchRegionHit([patch,full],{distance:10},{whole:true}).region.id,source.id);
 assert.equal(sketchRegionHit([full,patch],{distance:9}),null,'solid occludes sketch');
 assert.deepEqual(sketchRegionHit([full,patch],null).region.overlapPoint,[5,2,10]);
 const near={...full,distance:5};assert.equal(sketchRegionHit([near,patch],null).region.id,source.id,'nearer sketch takes priority');
 const input={...defaults,id:'offset-source',kind:'sketch',profile:'polyline',closed:true,points:selected.outer,z:10};
 const output=offsetSketch(input,.2),regions=findRegions(output);assert.equal(regions.length,1);assert.ok(regions[0].area<50,'offset uses selected patch, not full source');
}
console.log('PASS shared patch picking, Alt/full and occlusion; exact revolve/loft/thin profiles, holes, validation, offset and batch metadata');
