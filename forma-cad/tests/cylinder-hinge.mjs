import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeCylinderHinge,cylinderHingeInfo} from '../src/cylinder-hinge.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const volume=s=>Math.abs(R.measureVolume(s));
const intersection=(a,b)=>{const c=a.intersect(b);try{return volume(c);}finally{c.delete();}};
function valid(s){const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s),'complete exported faces');}finally{c.delete();solids.forEach(s=>s.delete());}}
const source=R.makeCylinder(30,80),snapshot=source.serialize(),closed=makeCylinderHinge(source,{pose:'closed'});
closed.parts.forEach(valid);assert.ok(closed.analysis.motion.every(m=>m.overlap<1e-5&&m.distance>.15));assert.equal(closed.analysis.autoHollow,true);
const cavity=R.makeCylinder(27.5,76,[0,0,2.5]),floor=R.makeCylinder(27,2,[0,0,.1]),opening=R.makeCylinder(27,3,[0,0,78]);
assert.ok(intersection(closed.parts[0],cavity)<1e-5);assert.ok(intersection(closed.parts[0],floor)>4000);assert.ok(intersection(closed.parts[0],opening)<1e-5,'full entrance remains open');assert.ok(intersection(closed.parts[1],opening)>1000,'cap covers entrance');
const escaped=closed.parts[1].clone().translate([.8,0,0]);assert.ok(intersection(closed.parts[0],escaped)>1,'end knuckles retain integral axis');escaped.delete();
const printed=makeCylinderHinge(source,{pose:'print'});printed.parts.forEach(valid);for(const s of printed.parts)assert.ok(Math.abs(s.boundingBox.bounds[0][2])<1e-6,'both parts touch plate');assert.ok(intersection(...printed.parts)<1e-5);assert.equal(printed.analysis.angle,90);assert.equal(source.serialize(),snapshot,'source unmodified');
for(const angle of [45,110]){const result=makeCylinderHinge(source,{pose:'open',angle,azimuth:135});result.parts.forEach(valid);assert.ok(intersection(...result.parts)<1e-5);result.parts.forEach(s=>s.delete());}
// A 90 mm diameter holder fits a 180 mm plate at 90 degrees; the former 180 degree pose does not.
function footprint(parts){
 const boxes=parts.map(s=>s.boundingBox);
 try{return [0,1].map(axis=>Math.max(...boxes.map(b=>b.bounds[1][axis]))-Math.min(...boxes.map(b=>b.bounds[0][axis])));}
 finally{boxes.forEach(b=>b.delete());}
}
const large=R.makeCylinder(45,70),holderOptions={openBottom:true,holderLip:true,fingerTab:true};
const compact=makeCylinderHinge(large,{...holderOptions,pose:'print'}),spread=makeCylinderHinge(large,{...holderOptions,pose:'open',angle:180});
const former=spread.parts.map(s=>s.clone().rotate(90,[0,0,0],[0,1,0]));
compact.parts.forEach(valid);assert.ok(intersection(...compact.parts)<1e-5);
for(const s of compact.parts){const box=s.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-6,'90 degree pose touches plate');}finally{box.delete();}}
const compactSize=footprint(compact.parts),formerSize=footprint(former);
assert.ok(compactSize.every(n=>n<180),'representative holder fits 180 mm plate');
assert.ok(formerSize.some(n=>n>180),'180 degree pose exceeds plate');
console.log('PASS 90 degree plate footprint',compactSize.map(n=>n.toFixed(2)).join(' x '),'mm; former',formerSize.map(n=>n.toFixed(2)).join(' x '),'mm');
[large,...compact.parts,...spread.parts,...former].forEach(s=>s.delete());
console.log('PASS automatic shell, open circular entrance, captive axis, checked opening poses and print geometry');
const tubeTool=R.makeCylinder(27,82,[0,0,-1]),tube=source.cut(tubeTool),cupTool=R.makeCylinder(26,80,[0,0,4]),cup=source.cut(cupTool),sealedTool=R.makeCylinder(26,72,[0,0,4]),sealed=source.cut(sealedTool);
for(const [base,expectedBottom]of [[tube,0],[cup,4],[sealed,4]]){
 const before=base.serialize(),info=cylinderHingeInfo(base),result=makeCylinderHinge(base,{pose:'closed'});assert.equal(info.hollow,true);assert.equal(result.analysis.autoHollow,false);result.parts.forEach(valid);
 const bore=R.makeCylinder(info.innerRadius-.01,80-expectedBottom-.01,[0,0,expectedBottom+.01]);assert.ok(intersection(result.parts[0],bore)<1e-5,'existing bore remains empty');
 const originalBottom=R.makeBox([-31,-31,-.1],[31,31,expectedBottom+.001]),oldBottom=base.intersect(originalBottom),newBottom=result.parts[0].intersect(originalBottom);assert.ok(Math.abs(volume(oldBottom)-volume(newBottom))<1e-4,'existing floor or through-hole preserved');
 assert.equal(base.serialize(),before);[bore,originalBottom,oldBottom,newBottom,...result.parts].forEach(s=>s.delete());
}
const tilted=source.clone().rotate(61,[0,0,0],[1,1,0]).translate([12,-20,37]),tiltResult=makeCylinderHinge(tilted,{pose:'closed',azimuth:210});tiltResult.parts.forEach(valid);assert.ok(intersection(...tiltResult.parts)<1e-5);assert.equal(tiltResult.analysis.height,80);tiltResult.parts.forEach(s=>s.delete());tilted.delete();
console.log('PASS hollow cup, open tube and sealed cavity preservation, arbitrary source axis and placement');
for(const bad of [{radialGap:.1},{axialGap:NaN},{hingeWidth:60},{floor:79},{pose:'bad'}])assert.throws(()=>makeCylinderHinge(source,bad));
const box=R.makeBox([0,0,0],[50,50,50]);assert.throws(()=>cylinderHingeInfo(box),/円柱/);box.delete();
const f={...defaults,id:'c',name:'円柱',profile:'circle',diameter:60,depth:80},spec={type:'cylinderHinge',id:'hinge',target:'c',pose:'closed'},result=runOperation([f],spec);
assert.deepEqual(result.outputs.map(o=>o.id),['c','hinge-lid']);assert.deepEqual(result.remove,[]);
const feature={kind:'cadop',id:'hinge',name:'円柱のヒンジ蓋',spec,...result};validateProject({format:'forma-cad',version:1,features:[f,feature]});
const replay=runOperation([f,feature],{type:'replay',before:[f,feature],start:0});assert.equal(replay.features.at(-1).outputs.length,2);
const duplicate={kind:'cadop',id:'existing',name:'既存',outputs:[{...result.outputs[1]}],remove:[]};assert.throws(()=>runOperation([f,duplicate],spec),/重複/);
console.log('PASS invalid dimensions, unsupported inputs, worker output IDs, persistence and history replay');
[source,...closed.parts,...printed.parts,cavity,floor,opening,tubeTool,tube,cupTool,cup,sealedTool,sealed].forEach(s=>s.delete());
