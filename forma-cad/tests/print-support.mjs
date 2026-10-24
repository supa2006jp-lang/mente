import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {printSupportDefaults,validatePrintSupport,makePrintSupport} from '../src/print-support.js';
import {assemblyTargets,assemblyLinks} from '../src/assembly-state.js';
import {validateProject} from '../src/geometry.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const box=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};
const record=(id,shape)=>{try{return {kind:'cadop',id,name:id,outputs:[{id,brep:shape.serialize(),...shape.mesh()}],remove:[]};}finally{shape.delete();}};
const feature=(spec,result)=>({kind:'cadop',id:spec.id,name:'疑似サポート',spec,...result});
const before=[record('plate',R.makeBox([-25,-17.5,60],[25,17.5,64]))],saved=JSON.stringify(before),spec={...printSupportDefaults,type:'printSupport',id:'support',target:'plate',maxSupports:4};
const result=runOperation(before,spec),history=[...before,feature(spec,result)],report=result.analysis.printSupport;
assert.equal(report.count,4);assert.equal(report.components,1);assert(report.reinforcements>3);assert.deepEqual(result.remove,[]);assert.deepEqual(result.outputs.map(o=>o.id),['support']);assert.equal(result.supportPreview,undefined);assert.equal(JSON.stringify(before),saved);
const bodies=kernelBodies(history);try{
 const s=bodies.get('support'),base=bodies.get('plate'),b=box(s);near(b[0][2],0);near(b[1][2],59.8);near(R.measureVolume(base),50*35*4);
 const query=new R.DistanceTool();try{near(query.distanceBetween(s,base),.2);}finally{query.delete();}
 const check=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}
 const solids=s.solids;try{for(const part of solids)near(box(part)[0][2],0);}finally{solids.forEach(x=>x.delete());}
 for(const contact of report.contacts){near(contact.point[2]-contact.tip[2],.2);const [x,y]=contact.point,edge=R.makeVertex([x+9,y,0]);try{near(R.measureDistanceBetween(edge,s),0);}finally{edge.delete();}}
}finally{bodies.forEach(s=>s.delete());}
assert(inspectCadStl(result.outputs[0]).report.ok,'support export must be closed and printable');
assert.deepEqual(assemblyTargets(history,['plate']),['plate','support']);
const move={type:'move',id:'move',target:'plate',x:10,y:5,z:0,rotation:[0,0,0]},moved=runOperation(history,move);assert.deepEqual(new Set(moved.outputs.map(o=>o.id)),new Set(['plate','support']));
const copy=runOperation(history,{...move,id:'copy',copy:true});assert.equal(copy.outputs.length,2);assert.equal(copy.analysis.assemblyCopies.length,1);
const release={type:'assemblyRelease',id:'release',linkId:'support-model-link'},released=[...history,feature(release,runOperation(history,release))];assert.deepEqual(assemblyTargets(released,['plate']),['plate']);
const unlinked=runOperation(before,{...spec,lockToModel:false});assert.equal(assemblyLinks([...before,feature({...spec,lockToModel:false},unlinked)]).length,0);
const independent=runOperation(before,{...spec,connectFeet:false,braces:false,maxSupports:2}),freeShapes=kernelBodies([...before,feature(spec,independent)]);try{const parts=freeShapes.get('support').solids;try{assert.equal(parts.length,2);for(const s of parts)near(box(s)[0][2],0);}finally{parts.forEach(s=>s.delete());}}finally{freeShapes.forEach(s=>s.delete());}
const preview=runOperation(before,{...spec,preview:true});assert.equal(preview.supportPreview.body.id,'plate');assert.equal(JSON.stringify(before),saved);
const roundtrip=JSON.parse(JSON.stringify(history));validateProject({format:'forma-cad',version:1,features:roundtrip});assert.deepEqual(assemblyTargets(roundtrip,['plate']),['plate','support']);
const changed=structuredClone(history);changed[0]=record('plate',R.makeBox([-25,-17.5,75],[25,17.5,79]));const replay=runOperation(changed,{type:'replay',before:history,start:0}).features;for(const c of replay.at(-1).analysis.printSupport.contacts)near(c.tip[2],74.8);
// The selected inclined face gets a parallel tip cut and the requested vertical gap.
let tilted=R.makeBox([-15,-15,0],[15,15,4]);let next=tilted.rotate(30,[0,0,0],[0,1,0]);tilted.delete();tilted=next;next=tilted.translate([0,0,60]);tilted.delete();const tiltBefore=[record('tilt',next)],normal=[-.5,0,-Math.sqrt(.75)],tiltSpec={...spec,target:'tilt',mode:'face',maxSupports:2,faces:[{bodyId:'tilt',point:[0,0,60],normal}]};
const tiltResult=runOperation(tiltBefore,tiltSpec);assert(tiltResult.analysis.printSupport.count);for(const c of tiltResult.analysis.printSupport.contacts){near(c.point[2],60-c.point[0]*normal[0]/normal[2]);near(c.tip[2],c.point[2]-.2);}
const tiltBodies=kernelBodies([...tiltBefore,feature(tiltSpec,tiltResult)]);try{near(R.measureDistanceBetween(tiltBodies.get('tilt'),tiltBodies.get('support')),.2*Math.sqrt(.75));}finally{tiltBodies.forEach(s=>s.delete());}
assert.throws(()=>runOperation(before,{...spec,mode:'face',faces:[{bodyId:'plate',point:[0,0,64],normal:[0,0,1]}]}),/下向き/);
// A second solid blocks every path; no support may go through it.
const blocked=[...before,record('blocker',R.makeBox([-40,-40,10],[40,40,15]))];assert.throws(()=>runOperation(blocked,{...spec,baseMode:'bed'}),/ベッド/);assert.equal(JSON.stringify(before),saved);
assert.throws(()=>runOperation([record('bed',R.makeBox([0,0,0],[20,20,10]))],{...spec,target:'bed'}),/下面/);
// An annulus has its area centroid in the hole. Native-validated interior seeds still place posts.
const outer=R.makeCylinder(18,4,[0,0,50]),inner=R.makeCylinder(10,6,[0,0,49]);let ring;try{ring=outer.cut(inner);}finally{outer.delete();inner.delete();}
const annulus=runOperation([record('ring',ring)],{...spec,target:'ring',spacing:100,maxSupports:3,footDiameter:10,connectFeet:false,braces:false});assert(annulus.analysis.printSupport.count>0);for(const c of annulus.analysis.printSupport.contacts)assert(Math.hypot(...c.point.slice(0,2))>=10);
for(const bad of [{topGap:0},{maxSupports:1.5},{footDiameter:2},{postDiameter:2,tipDiameter:3},{spacing:Infinity},{braces:1},{mode:'face',faces:[]},{mode:'face',faces:[{bodyId:'wrong'}]}])assert.throws(()=>validatePrintSupport({...spec,...bad}));
assert.throws(()=>makePrintSupport(new Map(),spec),/ボディ/);
await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/print-support-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:before}));
console.log('PASS wide bed feet, braced native solids, exact flat/inclined tip gaps, source preservation, obstacles, annulus seeds, closed STL, links/move/copy/release, save/replay and validation');
