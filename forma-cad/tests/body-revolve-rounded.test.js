import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {orthogonalRoundedSweep} from '../src/orthogonal-rounded-revolution.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

test('a filleted full body revolution can be swept 360 degrees about an intersecting perpendicular axis',async()=>{
 const oc=await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))});
 R.setOC(oc);
 const width=50,length=50,depth=36.344278074867546,fillet=2;
 const base={...defaults,id:'block',kind:'extrusion',profile:'rect',width,height:length,depth,x:width/2,y:length/2,z:0};
 const features=[base];
 const filletSpec={type:'fillet',id:'rounded',target:base.id,radius:fillet,
  edges:[{bodyId:base.id,a:[0,0,depth],b:[width,0,depth],point:[width/2,0,depth]}]};
 features.push({id:filletSpec.id,kind:'cadop',spec:filletSpec,...runOperation(features,filletSpec)});
 const first={type:'revolve',id:'first',sourceBody:base.id,target:base.id,bodySweep:true,
  angle:360,direction:'片側',origin:[width,0,0],axisVector:[0,1,0],operation:'new',keepSourceBody:false};
 features.push({id:first.id,kind:'cadop',spec:first,...runOperation(features,first)});

 const saved=JSON.parse(JSON.stringify(features)),snapshot=JSON.stringify(saved);
 const second={...first,id:'second',sourceBody:first.id,target:first.id,origin:[0,0,0],axisVector:[1,0,0]};
 const body=kernelBodies(saved);
 try {
  const source=body.get(first.id);
  assert.equal(orthogonalRoundedSweep(saved,source,{...second,angle:90}),null);
  assert.equal(orthogonalRoundedSweep(saved,source,{...second,origin:[0,0,1]}),null);
 } finally {body.forEach(shape=>shape.delete());}

 const result=runOperation(saved,second);
 assert.equal(JSON.stringify(saved),snapshot);
 assert.deepEqual(result.remove,[first.id]);
 assert.equal(result.outputs.length,1);
 assert.equal(result.outputs[0].shapeMetrics.solids,1);
 const report=inspectCadStl(result.outputs[0]).report;
 assert.ok(report.ok,JSON.stringify(report.issues));
 const shape=R.deserializeShape(result.outputs[0].brep).asShape3D();
 const properties=new oc.GProp_GProps();
 try {
  const radius=Math.hypot(width,depth),startRadius=Math.hypot(width,depth-fillet);
  const lower=x=>x<=startRadius ? 0 : fillet-Math.sqrt(Math.max(0,fillet**2-(Math.sqrt(x*x-width*width)-(depth-fillet))**2));
  const upper=x=>Math.sqrt(radius*radius+length*length-x*x);
  const count=50_000, step=radius/count;
  let expected=0;
  for(let i=0;i<count;i++){
   const x=step*(i+.5);
   expected+=2*Math.PI*step*(upper(x)**2-lower(x)**2);
  }
  oc.BRepGProp.VolumeProperties(shape.wrapped,properties,1e-9,true,false);
  assert.ok(Math.abs(properties.Mass()-expected)<.01,'swept volume matches the independent radial envelope');
  const x=radius-.1, minimum=lower(x), maximum=upper(x);
  assert.ok(minimum>.1);
  for(const [radial,inside] of [[minimum/2,false],[minimum+.05,true],[maximum-.05,true],[maximum+.05,false]]){
   const point=R.makeVertex([width+x,radial*.6,radial*.8]);
   try {assert.equal(R.measureDistanceBetween(shape,point)<1e-7,inside);}
   finally {point.delete();}
  }
 } finally {properties.delete();shape.delete();}
});
