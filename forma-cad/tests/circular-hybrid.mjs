import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';import {validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`),volume=s=>Math.abs(R.measureVolume(s));
function record(id,shape){return {id,...shape.mesh({tolerance:.08,angularTolerance:.15}),brep:shape.serialize()};}
function holedBox(min,max,point,radius=3){const box=R.makeBox(min,max),hole=R.makeCylinder(radius,max[2]-min[2]+2,[...point,min[2]-1]);try{return box.cut(hole);}finally{box.delete();hole.delete();}}
const spec={id:'hybrid',type:'circular',target:'source',origin:[0,0,0],axis:'Z',count:4,angle:360,operation:'新規かつ切り取り'};
const source=holedBox([20,-10,0],[40,10,10],[30,0]),filled=R.makeBox([-10,20,0],[10,40,10]),old=holedBox([-40,-10,0],[-20,10,10],[-36,0],1.5),far=R.makeBox([100,100,0],[110,110,10]),seed={kind:'cadop',id:'seed',name:'元の形状',outputs:[record('source',source),record('filled',filled),record('old-hole',old),record('far',far)],remove:[]},before=JSON.stringify(seed);
const result=runOperation([seed],spec);assert.equal(JSON.stringify(seed),before);assert.deepEqual(result.analysis.patternHybrid.cutBodies,['filled','old-hole']);assert.deepEqual(result.analysis.patternHybrid.newBodies,[{id:'hybrid-3',position:3}]);assert.deepEqual(result.remove,[]);assert.equal(result.outputs.length,3);
const feature={kind:'cadop',id:'hybrid',name:'円形状パターン',spec,...result},project=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[seed,feature]}))),bodies=kernelBodies(project);assert.equal(bodies.size,5);near(volume(bodies.get('source')),4000-90*Math.PI);near(volume(bodies.get('filled')),4000-90*Math.PI);near(volume(bodies.get('old-hole')),4000-90*Math.PI-22.5*Math.PI);near(volume(bodies.get('hybrid-3')),4000-90*Math.PI);near(volume(bodies.get('far')),1000);
function assertHole(bodies,point,radius){const tool=R.makeCylinder(radius,10,[...point,0]);try{for(const shape of bodies.values()){const overlap=shape.intersect(tool);near(volume(overlap),0);overlap.delete();}}finally{tool.delete();}}
for(const point of [[30,0],[0,30],[-30,0],[0,-30]])assertHole(bodies,point,3);assertHole(bodies,[-36,0],1.5);for(const shape of bodies.values())shape.delete();[source,filled,old,far].forEach(shape=>shape.delete());
// Later solid copies must never fill holes of earlier copies, even where the
// four positive shapes overlap. Their positive output volumes must not overlap.
const overlapping=holedBox([0,-15,0],[40,15,10],[10,0]),overSeed={kind:'cadop',id:'seed-over',name:'重なる原型',outputs:[record('source',overlapping)],remove:[]},over=runOperation([overSeed],spec),overBodies=kernelBodies([overSeed,{...feature,...over}]);
for(const point of [[10,0],[0,10],[-10,0],[0,-10]])assertHole(overBodies,point,3);const parts=[...overBodies.values()];for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const common=parts[i].intersect(parts[j]);near(volume(common),0);common.delete();}parts.forEach(shape=>shape.delete());overlapping.delete();
// A positive, hole-free copy landing inside an existing hole is discarded,
// rather than turning that existing hole into a new positive body.
const plain=R.makeBox([28,-2.5,0],[33,2.5,10]),receiver=holedBox([-20,10,0],[20,50,10],[0,30],10),emptySeed={kind:'cadop',id:'seed-empty',name:'穴を保護',outputs:[record('source',plain),record('receiver',receiver)],remove:[]},empty=runOperation([emptySeed],spec);assert.ok(empty.analysis.patternHybrid.skippedPositions.includes(1));assert.ok(!empty.outputs.some(o=>o.id==='hybrid-1'));plain.delete();receiver.delete();
console.log('PASS rotated holes cut existing bodies; free positions create only holed material; original/existing/later-copy holes stay empty; no overlapping positives; unrelated bodies unchanged; save/reload and copies inside existing holes');

// Blind holes cut only their actual depth, including a custom center/axis.
const solid=R.makeBox([20,-10,0],[40,10,10]),blindTool=R.makeCylinder(3,6,[30,0,5]),blind=solid.cut(blindTool),opposite=R.makeBox([-10,20,0],[10,40,10]);
const blindSeed={kind:'cadop',id:'blind-seed',outputs:[record('source',blind),record('opposite',opposite)],remove:[]};
const blindSpec={...spec,targets:['source','opposite'],origin:[0,0,0],axisVector:[0,0,2]};const blindResult=runOperation([blindSeed],blindSpec),blindBodies=kernelBodies([blindSeed,{...feature,spec:blindSpec,...blindResult}]);
near(volume(blindBodies.get('opposite')),4000-Math.PI*9*5);const floor=R.makeCylinder(2,4,[0,30,0]),floorCommon=blindBodies.get('opposite').intersect(floor);near(volume(floorCommon),Math.PI*4*4);floorCommon.delete();floor.delete();blindBodies.forEach(s=>s.delete());
assert.deepEqual(runOperation([blindSeed],{...blindSpec,count:1}).outputs,[]);assert.throws(()=>runOperation([blindSeed],{...blindSpec,targets:['missing']}),/見つかりません/);
[solid,blindTool,blind,opposite].forEach(s=>s.delete());
// Hole-free solids are copied as new positive bodies where no body exists.
const positive=R.makeBox([25,-5,0],[35,5,10]),positiveSeed={kind:'cadop',id:'positive-seed',outputs:[record('source',positive)],remove:[]},positiveResult=runOperation([positiveSeed],spec);assert.equal(positiveResult.outputs.length,3);assert.equal(positiveResult.analysis.patternHybrid.sourceHoles,0);for(const out of positiveResult.outputs){const body=R.deserializeShape(out.brep).asShape3D();near(volume(body),1000);body.delete();}positive.delete();
const {featureReads,historyImpact}=await import('../src/history-impact.js');assert.deepEqual([...featureReads({spec:blindSpec})],['source','opposite']);assert.equal(historyImpact([{id:'edit-opposite',outputs:[{id:'opposite'}],kind:'cadop'}, {...feature,spec:blindSpec}], 'edit-opposite').affected,1);
console.log('PASS blind depth/floor preservation, custom axis, one-copy no-op, missing reference safety, hole-free new bodies and history dependencies');

// An existing solid completely inside a copied hole is removed, never replaced with a plug.
const ring=holedBox([20,-10,0],[40,10,10],[30,0]),plug=R.makeCylinder(1,5,[0,30,2]),plugSeed={kind:'cadop',id:'plug-seed',outputs:[record('source',ring),record('plug',plug)],remove:[]},plugResult=runOperation([plugSeed],spec);assert.deepEqual(plugResult.remove,['plug']);assert.ok(!plugResult.outputs.some(o=>o.id==='plug'));ring.delete();plug.delete();console.log('PASS completely removed existing material is not emitted as a hole plug');
