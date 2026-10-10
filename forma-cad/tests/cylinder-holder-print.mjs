import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeCylinderHinge,makeCylinderHolderTest} from '../src/cylinder-hinge.js';
import {arrangeHingePair} from '../src/cylinder-hinge-print.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const volume=s=>Math.abs(R.measureVolume(s)),hit=(a,b)=>{const c=a.intersect(b);try{return volume(c);}finally{c.delete();}};
function valid(s){const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);try{assert.ok(c.IsValid());assert.ok(solidMeshComplete(s));}finally{c.delete();}}
const source=R.makeCylinder(45,100),before=source.serialize(),spec={pose:'print',openBottom:true,holderLip:true,fingerTab:true},plain=makeCylinderHinge(source,spec),placed=makeCylinderHinge(source,{...spec,printArrange:true,printMargin:2});
placed.parts.forEach(valid);console.log('Assembly footprint before/after',plain.analysis.printBounds.width,plain.analysis.printBounds.depth,placed.analysis.printBounds.width,placed.analysis.printBounds.depth,placed.analysis.layout);
assert.ok(Math.max(placed.analysis.printBounds.width,placed.analysis.printBounds.depth)<Math.max(plain.analysis.printBounds.width,plain.analysis.printBounds.depth)-1);
assert.equal(placed.analysis.angle,90);assert.equal(placed.analysis.layout.margin,2);assert.ok(hit(...placed.parts)<1e-5);assert.ok(Math.abs(R.measureDistanceBetween(...placed.parts)-R.measureDistanceBetween(...plain.parts))<1e-5);
for(let i=0;i<2;i++){
 const box=placed.parts[i].boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-6);if(placed.analysis.layout.fits)for(const axis of [0,1])assert.ok(box.bounds[0][axis]>=-88-1e-5&&box.bounds[1][axis]<=88+1e-5);}finally{box.delete();}
 const restored=placed.parts[i].clone().translate(placed.analysis.layout.translation.map(x=>-x)).rotate(-placed.analysis.layout.angle,[0,0,0],[0,0,1]),a=restored.cut(plain.parts[i]),b=plain.parts[i].cut(restored);assert.ok(volume(a)+volume(b)<1e-4,'each part receives identical rigid transform');[restored,a,b].forEach(s=>s.delete());
}
assert.equal(source.serialize(),before);
const giant=R.makeCylinder(70,180),overflow=makeCylinderHinge(giant,{...spec,printArrange:true,printMargin:2});assert.equal(overflow.analysis.layout.fits,false);assert.ok(overflow.analysis.layout.requiredSquare>180);assert.equal(overflow.analysis.layout.requiredSquare,Math.max(overflow.analysis.printBounds.width,overflow.analysis.printBounds.depth)+4);
for(const margin of [-1,NaN,21])assert.throws(()=>arrangeHingePair(plain.parts,margin));assert.throws(()=>makeCylinderHinge(source,{...spec,printArrange:'true'}));
const ringSource=R.makeCylinder(30,80),fit={fitHolder:true,holderDiameter:52,holderGap:.3,holderLip:true,lipInset:1.2,lipHeight:2.4},test=makeCylinderHolderTest(ringSource,fit),ring=test.parts[0];valid(ring);
const a=test.analysis,inner=a.innerDiameter/2,mouth=a.mouthDiameter/2;
assert.ok(Math.abs(volume(ring)-Math.PI*((30**2-inner**2)*a.height+(inner**2-mouth**2)*a.lipHeight))<1e-5,'ring reproduces exact bore and upper shoulder');
const hole=R.makeCylinder(mouth-.01,a.height+2,[0,0,-1]);assert.ok(hit(ring,hole)<1e-5,'through opening remains open');
const holderOuter=R.makeCylinder(26,a.height-a.lipHeight-.01),holderInner=R.makeCylinder(24,a.height+1,[0,0,-.1]),holder=holderOuter.cut(holderInner),lifted=holder.clone().translate([0,0,1]);assert.ok(hit(ring,holder)<1e-5);assert.ok(hit(ring,lifted)>1,'test holder rim stops against reproduced shoulder');
const bare=makeCylinderHolderTest(ringSource,{...fit,holderLip:false}),tall=makeCylinderHolderTest(ringSource,{...fit,lipHeight:10});assert.equal(bare.analysis.mouthDiameter,bare.analysis.innerDiameter);assert.equal(tall.analysis.height,12.4);
const tool=R.makeCylinder(27,82,[0,0,-1]),tube=ringSource.cut(tool),tubeRing=makeCylinderHolderTest(tube,{});assert.equal(tubeRing.analysis.innerDiameter,54);
for(const p of [{holderDiameter:59},{holderGap:3},{lipInset:.1}])assert.throws(()=>makeCylinderHolderTest(ringSource,{...fit,...p}));
assert.throws(()=>makeCylinderHolderTest(ringSource,{wall:NaN}));
const f={...defaults,id:'c',name:'円柱',profile:'circle',diameter:90,depth:100},operation={...spec,type:'cylinderHinge',target:'c',id:'hinge',printArrange:true,printMargin:2},output=runOperation([f],operation),feature={kind:'cadop',id:'hinge',name:'円柱のヒンジ蓋',spec:operation,...output};validateProject({format:'forma-cad',version:1,features:[f,feature]});assert.equal(output.outputs.length,2);
const replay=runOperation([f,feature],{type:'replay',before:[f,feature],start:0});assert.equal(replay.features.at(-1).outputs.length,2);
const testOutput=runOperation([{...f,diameter:60,depth:80}],{...fit,type:'cylinderHolderTest',target:'c',id:'test'});assert.deepEqual(testOutput.outputs.map(o=>o.id),['test-ring']);assert.deepEqual(testOutput.remove,[]);assert.equal(testOutput.analysis.innerDiameter,52.6);
[source,giant,ringSource,hole,holderOuter,holderInner,holder,lifted,tool,tube,...[plain,placed,overflow,test,bare,tall,tubeRing].flatMap(r=>r.parts)].forEach(s=>s.delete());
console.log('PASS grouped placement, unchanged hinge geometry and clearance, insufficient plate readout, exact test-ring bore/ledge and actual seating, tall lip, existing tube, guards and persistence/replay');
