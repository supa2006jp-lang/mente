import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {trimSurface} from '../src/trim-surface.js';import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const vol=R.measureVolume,frustum=(r0,r1,z0,z1)=>R.draw([0,z0]).lineTo([r0,z0]).lineTo([r1,z1]).lineTo([0,z1]).close().sketchOnPlane('XZ').revolve([0,0,1]);
const probe=(s,point,inside,transform=x=>x)=>{const ball=transform(R.makeSphere(.1).translate(point)),overlap=s.intersect(ball);assert.ok(inside?Math.abs(vol(overlap)-vol(ball))<1e-7:Math.abs(vol(overlap))<1e-7,JSON.stringify({point,inside,volume:vol(overlap)}));overlap.delete();ball.delete();};
const base=R.makeBox([-10,-10,-10],[10,10,10]),ref=R.makeBox([-30,-30,-5],[30,30,0]);
for(const tilted of [false,true])for(const side of ['通常','反転']){
 const transform=s=>tilted?s.clone().rotate(37,[0,0,0],[0,1,0]).translate([13,-7,9]):s.clone(),target=transform(base),reference=transform(ref);
 const angle=37*Math.PI/180,selection={point:tilted?[13+20*Math.cos(angle),-7,9-20*Math.sin(angle)]:[20,0,0]};
 const result=trimSurface(target,reference,selection,side);assert.ok(Math.abs(vol(result)-4000)<1e-5);probe(result,[0,0,-5],side==='通常',transform);probe(result,[0,0,5],side==='反転',transform);assert.ok(Math.abs(vol(reference)-vol(ref))<1e-6);
 result.delete();target.delete();reference.delete();
}
for(const slope of [0,.2])for(const innerWall of [false,true])for(const side of ['通常','反転']){
 const cavity=frustum(20,20+40*slope,0,40),reference=innerWall?frustum(23,23+40*slope,-3,40).cut(cavity):cavity.clone(),target=R.makeBox([-40,-2,-5],[40,2,45]);
 const selection={point:[-(20+20*slope),0,20]},result=trimSurface(target,reference,selection,side),removeInside=innerWall===(side==='通常');
 probe(result,[0,0,20],!removeInside);probe(result,[35,0,20],removeInside);probe(result,[35,0,-2],true);probe(result,[0,0,43],true);result.delete();target.delete();reference.delete();cavity.delete();
}
assert.throws(()=>trimSurface(base,ref,{point:[20,0,0]},'invalid'),/削る側/);
const below=R.makeBox([-2,-2,-8],[2,2,-1]);assert.throws(()=>trimSurface(below,ref,{point:[20,0,0]},'通常'),/取り除く部分がありません/);assert.throws(()=>trimSurface(below,ref,{point:[20,0,0]},'反転'),/対象全体/);
const sphere=R.makeSphere(20);assert.throws(()=>trimSurface(base,sphere,{point:[20,0,0]}),/自由曲面/);
const output=(id,shape)=>({id,...shape.mesh({tolerance:.08,angularTolerance:.15}),planarFaces:shape.faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep:shape.serialize()});
const features=[{kind:'cadop',id:'reference',name:'基準平面',outputs:[output('reference',ref)],remove:[]},{kind:'cadop',id:'target',name:'切り取るブロック',outputs:[output('target',base)],remove:[]}];
const result=runOperation(features,{type:'trimSurface',id:'trim',target:'target',faces:[{bodyId:'reference',point:[20,0,0]}],trimSide:'反転'});assert.equal(result.outputs[0].id,'target');assert.equal(result.outputs.length,1);assert.ok(Math.abs(vol(R.deserializeShape(result.outputs[0].brep).asShape3D())-4000)<1e-5);
await fs.writeFile('.sites-runtime/trim-surface-test.json',JSON.stringify({format:'forma-cad',version:1,features}));
console.log('PASS plane both sides/tilt, inner/outer cylinder/cone both sides, finite height, reference preservation, no-op/empty/unsupported errors and kernel output');
