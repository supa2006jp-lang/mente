import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {runOperation} from '../src/kernel.js';import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const spec={type:'revolve',id:'swept',sourceBody:'b',bodySweep:true,origin:[0,0,0],axisVector:[0,0,1],angle:90,operation:'new',direction:'片側'};
const shapeOf=result=>R.deserializeShape(result.outputs[0].brep).asShape3D();
for(const profile of ['rect','circle'])for(const angle of [90,360]){
 const features=[{...defaults,id:'b',kind:'extrusion',profile,width:20,height:10,diameter:10,depth:8,x:30}];const result=runOperation(features,{...spec,angle}),shape=shapeOf(result);const expected=profile==='circle'?(angle===90?Math.PI*300*4+Math.PI*25*8:Math.PI*(35**2-25**2)*8):angle===360?Math.PI*(40**2+5**2-20**2)*8:null;
 if(expected)assert.ok(Math.abs(R.measureVolume(shape)-expected)<.01,[profile,angle,R.measureVolume(shape),expected].join(' '));
 const probe=R.makeSphere(.1).translate([30/Math.sqrt(2),30/Math.sqrt(2),4]),intersection=shape.intersect(probe);assert.ok(R.measureVolume(intersection)>.004,'intermediate rotation must be inside swept volume');intersection.delete();probe.delete();shape.delete();console.log('PASS swept',profile,angle);
}
for(const direction of ['逆方向','対称']){const features=[{...defaults,id:'b',kind:'extrusion',profile:'circle',diameter:10,depth:8,x:30}],shape=shapeOf(runOperation(features,{...spec,direction})),a=direction==='逆方向'?-Math.PI/4:0,point=R.makeSphere(.1).translate([30*Math.cos(a),30*Math.sin(a),4]),intersection=shape.intersect(point);assert.ok(R.measureVolume(intersection)>.004);intersection.delete();point.delete();shape.delete();}
const centered=[{...defaults,id:'b',kind:'extrusion',width:20,height:10,depth:8}];let shape=shapeOf(runOperation(centered,{...spec,angle:360}));assert.ok(Math.abs(R.measureVolume(shape)-Math.PI*125*8)<.01);shape.delete();
const source={...defaults,id:'b',kind:'extrusion',profile:'circle',diameter:10,depth:8,x:30},target={...defaults,id:'t',kind:'extrusion',width:100,height:100,depth:10};shape=shapeOf(runOperation([source,target],{...spec,target:'t',operation:'cut'}));assert.ok(R.measureVolume(shape)<100000-4000);shape.delete();assert.equal(runOperation([source],{...spec,target:'b',operation:'join'}).outputs[0].id,'b');
console.log('PASS reverse/symmetric, axis through body, cut and join');

for(const axisVector of [[1,1,0],[0,0,-1]]){const f={...defaults,id:'b',kind:'extrusion',width:10,height:8,depth:6,x:20},p={...spec,origin:[2,1,0],axisVector,angle:40},result=shapeOf(runOperation([f],p)),probe=R.makeSphere(.1).translate([20,0,3]).rotate(20,p.origin,axisVector),common=result.intersect(probe);assert.ok(R.measureVolume(common)>.004);common.delete();probe.delete();result.delete();}
console.log('PASS arbitrary and reversed axis swept interiors');
