import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {printSupportDefaults,validatePrintSupport} from '../src/print-support.js';
import {assemblyTargets} from '../src/assembly-state.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),record=(id,shape)=>{try{return {kind:'cadop',id,name:id,outputs:[{id,brep:shape.serialize(),...shape.mesh()}],remove:[]};}finally{shape.delete();}},feature=(spec,out)=>({kind:'cadop',id:spec.id,name:'疑似サポート',spec,...out});
const bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}};
const bottom=R.makeBox([0,0,0],[60,30,5]),wall=R.makeBox([55,0,4],[60,30,51]),top=R.makeBox([0,0,50],[60,30,55]);let joined=bottom.fuse(wall),channel;try{channel=joined.fuse(top);}finally{joined.delete();bottom.delete();wall.delete();top.delete();}
const before=[record('channel',channel)],snapshot=JSON.stringify(before),spec={...printSupportDefaults,type:'printSupport',id:'supports',target:'channel',maxSupports:4};
// Reproduce the screenshot: no column can pass from the bed through the lower plate.
assert.throws(()=>runOperation(before,{...spec,baseMode:'bed'}),/ベッド/);
const out=runOperation(before,spec),a=out.analysis.printSupport,history=[...before,feature(spec,out)];assert.equal(a.count,4);assert.equal(a.modelBasedCount,4);assert.equal(a.bedBasedCount,0);assert.deepEqual(out.remove,[]);assert.equal(out.outputs.length,1);assert.equal(JSON.stringify(before),snapshot);
const bodies=kernelBodies(history);try{const support=bodies.get('supports'),model=bodies.get('channel');near(bounds(support)[0][2],5.2);near(bounds(support)[1][2],49.8);near(R.measureDistanceBetween(support,model),.2);const check=new (R.getOC().BRepCheck_Analyzer)(support.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}for(const c of a.contacts){near(c.base.point[2],5);near(c.base.tip[2],5.2);near(c.point[2],50);near(c.tip[2],49.8);}assert(inspectCadStl(out.outputs[0]).report.ok);}finally{bodies.forEach(s=>s.delete());}
const selected=runOperation(before,{...spec,mode:'face',faces:[{bodyId:'channel',point:[27.5,15,50],normal:[0,0,-1]}],bottomGap:.3,topGap:.25});assert(selected.analysis.printSupport.modelBasedCount>0);for(const c of selected.analysis.printSupport.contacts){near(c.base.tip[2],5.3);near(c.tip[2],49.75);}
// The lower platform can be another solid. Its link and transforms must follow the assembly.
const separate=[record('upper',R.makeBox([-20,-20,50],[20,20,55])),record('lower',R.makeBox([-30,-30,0],[30,30,5]))],otherSpec={...spec,target:'upper'},other=runOperation(separate,otherSpec),otherHistory=[...separate,feature(otherSpec,other)];assert.deepEqual(other.analysis.printSupport.baseBodyIds,['lower']);assert.deepEqual(new Set(assemblyTargets(otherHistory,['upper'])),new Set(['upper','lower','supports']));const moved=runOperation(otherHistory,{type:'move',id:'move',target:'upper',x:10,y:0,z:0,rotation:[0,0,0]});assert.equal(moved.outputs.length,3);
// Inclined native landing planes keep a vertical gap over the whole bottom tip.
let tilted=R.makeBox([-30,-30,0],[30,30,4]),rotated=tilted.rotate(20,[0,0,0],[0,1,0]);tilted.delete();const slope=[separate[0],record('slope',rotated)],sloped=runOperation(slope,otherSpec),slopedShapes=kernelBodies([...slope,feature(otherSpec,sloped)]);try{assert(sloped.analysis.printSupport.modelBasedCount>0);near(R.measureDistanceBetween(slopedShapes.get('slope'),slopedShapes.get('supports')),.2*Math.cos(20*Math.PI/180));}finally{slopedShapes.forEach(s=>s.delete());}
// A landing face's hole is not a platform: posts can go through it to the bed.
const outer=R.makeCylinder(20,5),inner=R.makeCylinder(10,7,[0,0,-1]);let ring;try{ring=outer.cut(inner);}finally{outer.delete();inner.delete();}const hole=[record('small',R.makeBox([-2,-2,50],[2,2,54])),record('ring',ring)],throughHole=runOperation(hole,{...spec,target:'small',maxSupports:1,footDiameter:6});assert.equal(throughHole.analysis.printSupport.bedBasedCount,1);near(throughHole.analysis.printSupport.contacts[0].base.point[2],0);
// A nearly closed gap must not be filled with an intersecting or zero-height post.
const tiny=[record('upper',R.makeBox([-20,-20,6],[20,20,10])),separate[1]];assert.throws(()=>runOperation(tiny,otherSpec),/支えられる/);
const legacy={...otherSpec};delete legacy.baseMode;delete legacy.bottomGap;assert.equal(validatePrintSupport(legacy).baseMode,'bed');assert.throws(()=>runOperation(separate,legacy),/ベッド/);for(const bad of [{baseMode:'invalid'},{bottomGap:0},{bottomGap:NaN}])assert.throws(()=>validatePrintSupport({...spec,...bad}));
const saved=JSON.parse(JSON.stringify(history)),replayed=runOperation(saved,{type:'replay',before:saved,start:1,forceFull:true}).features;assert.equal(replayed.at(-1).analysis.printSupport.modelBasedCount,4);assert.equal(replayed.at(-1).spec.baseMode,'bedOrModel');assert.equal(JSON.stringify(before),snapshot);
await fs.writeFile('.sites-runtime/print-support-model-base-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:before}));
const legacyBefore=[separate[0]],legacyOutput=runOperation(legacyBefore,legacy);await fs.writeFile('.sites-runtime/print-support-legacy-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[...legacyBefore,feature(legacy,legacyOutput)]}));
console.log('PASS C-shaped cavity reproduction, model-top landing, two contact gaps, native validity and closed STL, selected face, other-body links/move, inclined base, real holes, short gap rejection, legacy placement and replay');
