import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {runOperation,kernelBodies} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'base',kind:'extrusion',name:'本体',profile:'rect',width:60,height:40,depth:30};
const p={type:'bossJoint',mode:'split',id:'joint',target:'base',plane:'XY',offset:15,pose:'assembled',count:2,diameter:3,length:4,clearance:.25,bossWall:1.6,bossHeight:8,spacing:0,offsetU:0,offsetV:0};
function validResult(result){assert.equal(result.outputs.length,2);for(const o of result.outputs){const s=R.deserializeShape(o.brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);}finally{check.delete();solids.forEach(b=>b.delete());s.delete();}}}
console.time('solid');const joined=runOperation([base],p);console.timeEnd('solid');validResult(joined);assert.equal(joined.analysis.count,2);assert.equal(joined.analysis.holeDiameter,3.5);assert.ok(joined.analysis.overlap<1e-5);console.log('solid',joined.analysis.positions);
const print=runOperation([base],{...p,pose:'print'});validResult(print);for(const o of print.outputs){assert.ok(Math.abs(Math.min(...o.vertices.filter((_,i)=>i%3===2)))<1e-5);}console.log('PASS basic assembled/print boss joint');
const cut=runOperation([base],{type:'split',target:'base',id:'upper',plane:'XY',offset:15}),history=[base,{kind:'cadop',id:'upper',name:'分離',outputs:cut.outputs,remove:cut.remove}],pair=runOperation(history,{...p,mode:'pair',pinTarget:'upper'});validResult(pair);assert.deepEqual(pair.outputs.map(o=>o.id),['base','upper']);
const cavity={...defaults,id:'cavity',name:'空洞',kind:'extrusion',profile:'rect',operation:'cut',target:'base',width:55,height:35,depth:25,z:2.5},hollow=[base,cavity];console.time('hollow');const result=runOperation(hollow,p);console.timeEnd('hollow');validResult(result);assert.ok(result.analysis.positions.every(q=>q.bossHeight>12));const resultHistory=[...hollow,{kind:'cadop',id:p.id,name:'ボス接合',spec:p,...result}],bodies=kernelBodies(resultHistory);try{const probe=R.makeCylinder(1,3,[result.analysis.positions[0].point[0],result.analysis.positions[0].point[1],11]);const hole=bodies.get('base').intersect(probe);try{assert.ok(R.measureVolume(hole)<1e-7,'receiver hole is empty');}finally{hole.delete();probe.delete();}}finally{for(const b of bodies.values())b.delete();}validateProject({format:'forma-cad',version:1,features:resultHistory});console.log('PASS hollow boss reaches floor and rod reaches roof, independent solids and save validation');
for(const plane of ['XZ','YZ']){const result=runOperation([base],{...p,plane,offset:plane==='XZ'?0:0});validResult(result);console.log('PASS '+plane);}
import {makeBossJoint} from '../src/boss-joint.js';
for(const count of [1,4]){const result=runOperation([base],{...p,count});validResult(result);assert.equal(result.analysis.positions.length,count);assert.ok(result.analysis.overlap<1e-5);}
const round=runOperation([{...base,profile:'circle',diameter:50}],{...p,count:4});validResult(round);assert.equal(round.analysis.count,4);
const assembled=kernelBodies([base,{kind:'cadop',id:p.id,name:'ボス接合',spec:p,...joined}]);try{
 const receiver=assembled.get('base'),male=assembled.get('joint-pin'),q=joined.analysis.positions[0],pt=q.point;
 for(const [name,radius,z,height,wantMaterial]of [['clearance',1.7,12,2,false],['blind bottom',1.7,10,0.5,true]]){
  const probe=R.makeCylinder(radius,height,[pt[0],pt[1],z]);const hit=receiver.intersect(probe);try{assert.equal(R.measureVolume(hit)>1e-6,wantMaterial,name);}finally{hit.delete();probe.delete();}
 }
 const probe=R.makeCylinder(1,2,[pt[0],pt[1],12]),hit=male.intersect(probe);try{assert.ok(Math.abs(R.measureVolume(hit)-Math.PI*2)<1e-6,'rod is present at designed insertion position');}finally{hit.delete();probe.delete();}
}finally{for(const shape of assembled.values())shape.delete();}
const pairBodies=kernelBodies(history);try{
 const a=pairBodies.get('base').rotate(28,[0,0,0],[1,1,0]).translate([7,-3,9]),b=pairBodies.get('upper').rotate(28,[0,0,0],[1,1,0]).translate([7,-3,9]);const sourceVolume=R.measureVolume(a);try{
  const result=makeBossJoint(a,b,{...p,mode:'pair',pinTarget:'upper',pose:'print'});try{assert.equal(result.parts.length,2);assert.equal(result.analysis.count,2);for(const shape of result.parts){const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-5);}finally{box.delete();}}assert.equal(R.measureVolume(a),sourceVolume,'source remains unchanged');}finally{result.parts.forEach(shape=>shape.delete());}
  const swapped=makeBossJoint(b,a,{...p,mode:'pair',target:'upper',pinTarget:'base'});swapped.parts.forEach(shape=>shape.delete());
  const far=b.clone().translate([0,0,100]);try{assert.throws(()=>makeBossJoint(a,far,{...p,mode:'pair',pinTarget:'upper'}),/接している/);}finally{far.delete();}
 }finally{a.delete();b.delete();}
}finally{for(const shape of pairBodies.values())shape.delete();}
for(const [change,message]of [[{offset:0},/内部/],[{clearance:0},/すき間/],[{bossHeight:2},/ボス高さ/],[{count:3},/接合の数/],[{offsetU:100},/広さ/],[{diameter:50},/広さ/]])assert.throws(()=>runOperation([base],{...p,...change}),message);
console.log('PASS 1/2/4 joints, circular outline, blind hole/clearance/pin dimensions, rotated/swapped pair, source immutability and invalid inputs');
