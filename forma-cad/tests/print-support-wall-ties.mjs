import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {printSupportDefaults,validatePrintSupport} from '../src/print-support.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`),record=(id,s)=>{try{return {kind:'cadop',id,outputs:[{id,brep:s.serialize(),...s.mesh()}],remove:[]};}finally{s.delete();}},feature=(s,o)=>{const {supportPreview,supportPackage,...stored}=o;return {kind:'cadop',id:s.id,name:'疑似サポート',spec:s,...stored};};
const doc=JSON.parse(await fs.readFile('.sites-runtime/print-support-model-base-fixture.forma.json','utf8')),snapshot=JSON.stringify(doc),spec={...printSupportDefaults,type:'printSupport',id:'ties',target:'channel',style:'walls',topGap:.3};
const tied=runOperation(doc.features,spec),a=tied.analysis.printSupport;
assert.equal(a.count,14);assert.equal(a.components,1);assert.equal(a.wallTies.count,52);assert.deepEqual(a.wallTies.levels,[25.2,45]);near(a.wallTies.thickness,.6);near(a.wallTies.neckWidth,.8);assert(inspectCadStl(tied.outputs[0]).report.ok);
const native=kernelBodies([...doc.features,feature(spec,tied)]);try{
 const support=native.get('ties'),source=native.get('channel'),common=support.intersect(source);try{near(R.measureVolume(common),0);}finally{common.delete();}
 const from=.5+54/14/2+.4-.12,row=.5+29/3,center=.5+54/14,z=25.5;
 const probe=point=>{const cube=R.makeBox(point.map(v=>v-.01),point.map(v=>v+.01)),common=support.intersect(cube);try{return R.measureVolume(common);}finally{cube.delete();common.delete();}};for(const point of [[center,row+.6,z],[from+.2,row,z]])near(probe(point),.02**3);
 assert(probe([from+.2,row+.6,z])<1e-8,'narrow breakaway end remains after fusion');
}finally{native.forEach(s=>s.delete());}
const disabled=runOperation(doc.features,{...spec,wallTies:false});assert.equal(disabled.analysis.printSupport.components,14);assert.equal(disabled.analysis.printSupport.wallTies.count,0);
const spaced=runOperation(doc.features,{...spec,tieInterval:30});assert.equal(spaced.analysis.printSupport.wallTies.count,26);assert.deepEqual(spaced.analysis.printSupport.wallTies.levels,[35.1]);
const obstacle=record('obstacle',R.makeBox([3.2,9.5,24.9],[5.2,10.8,26])),avoided=runOperation([...doc.features,obstacle],spec);assert(avoided.analysis.printSupport.wallTies.count<52);assert(avoided.analysis.printSupport.omittedReinforcement>0);const checked=kernelBodies([...doc.features,obstacle,feature(spec,avoided)]);try{const common=checked.get('ties').intersect(checked.get('obstacle'));try{near(R.measureVolume(common),0);}finally{common.delete();}}finally{checked.forEach(s=>s.delete());}
const old={...spec};delete old.wallTies;delete old.tieInterval;const legacy=runOperation(doc.features,old);assert.equal(legacy.analysis.printSupport.wallTies.enabled,false);assert.equal(legacy.analysis.printSupport.components,14);
const saved=JSON.parse(JSON.stringify([...doc.features,feature(spec,tied)])),replayed=runOperation(saved,{type:'replay',before:saved,start:1,forceFull:true}).features;assert.equal(replayed.at(-1).analysis.printSupport.wallTies.count,52);assert.equal(replayed.at(-1).analysis.printSupport.components,1);assert.equal(JSON.stringify(doc),snapshot);
for(const bad of [{wallTies:'yes'},{tieInterval:0},{tieInterval:NaN},{tieInterval:61}])assert.throws(()=>validatePrintSupport({...spec,...bad}));
const shapes=kernelBodies(doc.features);let turned;try{turned=shapes.get('channel').rotate(90,[0,0,0],[0,0,1]);}finally{shapes.forEach(s=>s.delete());}const rotated=runOperation([record('turned',turned)],{...spec,target:'turned'});assert.equal(rotated.analysis.printSupport.wallTies.count,52);assert.equal(rotated.analysis.printSupport.components,1);
const legacyDoc={format:'forma-cad',version:1,features:[...doc.features,feature(old,legacy)]};validateProject(legacyDoc);await fs.writeFile('.sites-runtime/print-support-legacy-walls-fixture.forma.json',JSON.stringify(legacyDoc));
console.log('PASS staggered-layer horizontal ties, connected fins, narrow cut points, adjustable/off/legacy controls, obstacle rejection, zero source penetration, rotated layout, closed STL, persistence and replay');
