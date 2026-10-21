import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {applyProjectDisplayRepairs} from '../src/project-display-data.js';
import {displayMeasures} from '../src/project-display-repair.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/model-reliability/';await fs.mkdir(dir,{recursive:true});
const radius=20,height=12.020725388601036,x=10*Math.sqrt(3),outer=Array.from({length:6},(_,i)=>[radius*Math.cos((i*60-90)*Math.PI/180),radius*Math.sin((i*60-90)*Math.PI/180)]),seed={...defaults,id:'seed',name:'六角形',kind:'extrusion',profile:'region',depth:height,region:{id:'hex',plane:'XY',offset:0,outer,holes:[],area:600*Math.sqrt(3),sourceIds:[]}},before=[seed];
const spec={type:'mirror',id:'mirror',target:'seed',mirrorMode:'コピー',plane:'FACE',offset:0,mirrorNormal:[1,0,0],mirrorOrigin:[Math.fround(x),0,0],mirrorFace:{bodyId:'seed',point:[Math.fround(x),0,height/2],normal:[1,0,0]}},snapshot=JSON.stringify(spec),result=runOperation(before,spec);
assert.equal(JSON.stringify(spec),snapshot,'native plane resolution must not mutate input commands');assert(Math.abs(result.analysis.mirrorPlane.mirrorOrigin[0]-x)<1e-12,'native plane must replace rounded display coordinate');
const mirror={kind:'cadop',id:'mirror',name:'ミラー',spec:{...spec,...result.analysis.mirrorPlane},...result};delete mirror.spec.mirrorFace;
const offsetResult=runOperation(before,{...spec,offset:2.5}),offsetShape=R.deserializeShape(offsetResult.outputs[0].brep).asShape3D(),offsetBox=offsetShape.boundingBox;try{assert(Math.abs(offsetBox.bounds[0][0]-(x+5))<1e-5,'an intentional mirror offset must be retained');}finally{offsetBox.delete();offsetShape.delete();}
const joinedSpec={type:'join',id:'joined',target:'seed',others:['mirror'],combineMode:'結合'},joinedResult=runOperation([...before,mirror],joinedSpec);assert.equal(joinedResult.analysis.connectionCheck.bodies[0].count,1,'face-based mirror joins without an artificial gap');
const live=[...before,mirror,{kind:'cadop',id:'joined',name:'結合',spec:joinedSpec,...joinedResult}];
const healthy=runOperation(live,{type:'repairProjectDisplay'});assert.equal(healthy.records.length,0);assert.equal(healthy.checked,1);assert.deepEqual(healthy.warnings,[]);
const broken=structuredClone(live),output=broken.at(-1).outputs[0];output.triangles.splice(output.triangles.length-3,3);const brokenSnapshot=JSON.stringify(broken),repair=runOperation(broken,{type:'repairProjectDisplay'});assert.equal(repair.records.length,1);assert.equal(JSON.stringify(broken),brokenSnapshot,'checking must not mutate live input');
const fixed=applyProjectDisplayRepairs(broken,repair.records);assert.equal(fixed.length,broken.length);assert.deepEqual(fixed.slice(0,-1),broken.slice(0,-1));assert.equal(fixed.at(-1).outputs[0].brep,output.brep);assert.deepEqual(fixed.at(-1).spec,broken.at(-1).spec);const shape=R.deserializeShape(output.brep).asShape3D(),measures=displayMeasures(fixed.at(-1).outputs[0]);assert(Math.abs(measures.area-R.measureArea(shape))<.001);assert(Math.abs(measures.volume-R.measureVolume(shape))<.001);shape.delete();assert.equal(runOperation(fixed,{type:'repairProjectDisplay'}).records.length,0,'loading a repaired save is idempotent');
const shiftedSpec={...spec,id:'far',mirrorOrigin:[40,0,0]};delete shiftedSpec.mirrorFace;const far={kind:'cadop',id:'far',name:'離れたミラー',spec:shiftedSpec,...runOperation(before,shiftedSpec)},gapSpec={...joinedSpec,others:['far']},gapResult=runOperation([...before,far],gapSpec);assert.equal(gapResult.analysis.connectionCheck.bodies[0].count,2,'separate solids must be reported truthfully');
const gapFeatures=[...before,far,{kind:'cadop',id:'joined',name:'結合',spec:gapSpec,...gapResult}];
const bridge={...defaults,id:'bridge',name:'接続',kind:'extrusion',profile:'rect',width:80,height:10,x:40,depth:height,operation:'join',target:'seed',targetAllBodies:true};const bridged=runOperation(gapFeatures,{type:'extrusionBatch',features:[bridge]});assert.equal(bridged.features[0].cadResult.analysis.connectionCheck.bodies[0].count,1,'connecting extrusion must clear the disconnected result');
const badBrep=structuredClone(live);badBrep.at(-1).outputs[0].brep='invalid';const warning=runOperation(badBrep,{type:'repairProjectDisplay'});assert.equal(warning.warnings.length,1);assert.equal(warning.records.length,0);
for(const [name,features]of [['broken',broken],['fixed',fixed],['disconnected',gapFeatures],['connected',live]]){const doc={format:'forma-cad',version:1,units:'mm',features};validateProject(doc);await fs.writeFile(dir+name+'.forma.json',JSON.stringify(doc));}
const proof={loadRepair:true,exactBrepAndHistoryPreserved:true,repairIdempotent:true,mirrorUsesNativePlane:true,mirroredJoinSolids:1,disconnectedJoinSolids:2,connectingExtrusionSolids:1,invalidBrepPreservedWithWarning:true};await fs.writeFile(dir+'kernel-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
