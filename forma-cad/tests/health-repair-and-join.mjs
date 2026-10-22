import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {cadMesh} from '../src/cad-mesh.js';
import {inspectOperationHealth,healthBudget} from '../src/geometry-health.js';
import {classifyHealthFindings} from '../src/geometry-health-delta.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/health-repair-and-join/';await fs.mkdir(dir,{recursive:true});
const owned=[],own=s=>(owned.push(s),s),box=(a,b)=>own(R.makeBox(a,b)),output=(s,id)=>({id,...cadMesh(s),brep:s.serialize(),cadCoordinatePrecision:true}),doc=(a,b)=>[{kind:'cadop',id:'initial',name:'検査用',outputs:[output(a,'a'),output(b,'b')],remove:[]}];
try{
 const a=box([0,0,0],[20,20,10]),b=box([20.005,0,0],[30,20,10]),features=doc(a,b),snapshot=JSON.stringify(features),spec={type:'geometryGapRepair',id:'repair',target:'a',other:'b',expectedGap:.005,threshold:.01};
 const result=runOperation(features,spec);assert.equal(JSON.stringify(features),snapshot);assert(Math.abs(result.spec.x-.005)<1e-10);assert(result.afterGap<1e-7);assert.equal(result.result.outputs.length,1);assert.deepEqual(result.result.remove,[]);assert(!result.spec.contactMove);
 const moved=[...features,{kind:'cadop',id:'repair',name:'隙間の修正',spec:result.spec,...result.result}],bodies=kernelBodies(moved);try{assert.equal(bodies.size,2);assert(R.measureDistanceBetween(bodies.get('a'),bodies.get('b'))<1e-7);assert(Math.abs(R.measureVolume(bodies.get('a'))-4000)<1e-7);}finally{bodies.forEach(s=>s.delete());}
 const joined=runOperation(moved,{type:'join',id:'join',target:'a',other:'b',combineMode:'結合'});assert.equal(joined.analysis.connectionCheck.bodies[0].count,1);
 const separate=runOperation(features,{type:'join',id:'join',target:'a',other:'b',combineMode:'結合'});assert.equal(separate.analysis.connectionCheck.bodies[0].count,2);assert.equal(separate.analysis.connectionCheck.bodies[0].parts.length,2);
 const reverse=runOperation(features,{...spec,target:'b',other:'a'});assert(Math.abs(reverse.spec.x+.005)<1e-10);
 const angle=30,obliqueA=own(a.clone().rotate(angle,[0,0,0],[0,0,1])),obliqueB=own(b.clone().rotate(angle,[0,0,0],[0,0,1])),oblique=runOperation(doc(obliqueA,obliqueB),spec);assert(Math.abs(oblique.spec.x-.005*Math.cos(Math.PI/6))<1e-9);assert(Math.abs(oblique.spec.y-.0025)<1e-9);
 assert.throws(()=>runOperation(features,{...spec,expectedGap:.006}),/状態が変わり/);assert.throws(()=>runOperation(features,{...spec,threshold:.001}),/状態が変わり/);assert.throws(()=>runOperation(features,{...spec,other:'a'}),/選び直し/);
 const obstruction=box([20.002,0,0],[20.003,20,10]),blocked=[{...features[0],outputs:[...features[0].outputs,output(obstruction,'c')]}];assert.throws(()=>runOperation(blocked,spec),/途中に別/);
 const slotTool=box([9.9975,-1,2],[10.0025,21,11]),slot=own(a.cut(slotTool)),budget=healthBudget(true),row=inspectOperationHealth(slot,{id:'a',before:a,bodies:new Map([['a',a]]),spec:{type:'extrusion',target:'a'},threshold:.01,detailed:true,budget});assert(row.findings.some(f=>f.code==='micro-gap'&&f.change==='new'));
 const thin=box([0,0,0],[20,.002,10]),same=inspectOperationHealth(thin,{id:'a',before:thin,bodies:new Map([['a',thin]]),spec:{type:'join',target:'a'},threshold:.01,detailed:true,budget:healthBudget(true)});assert(same.findings.some(f=>f.change==='existing'));assert(!same.findings.some(f=>f.change==='new'));
 const finding={code:'short-edge',size:.002,bounds:[[0,0,0],[.002,0,0]]},unknown=classifyHealthFindings({findings:[finding]},[{findings:[],partial:true}]);assert.equal(unknown.findings[0].change,'unknown');
 const stable=classifyHealthFindings({findings:[{...finding,edge:9}]},[{findings:[{...finding,edge:1}],partial:false}]);assert.equal(stable.findings[0].change,'existing');
 const deltaDoc=[{kind:'cadop',id:'initial',name:'元の板',outputs:[output(a,'a')],remove:[]},{kind:'cadop',id:'slot',name:'溝加工',outputs:[output(slot,'a')],remove:[],analysis:{geometryHealth:{rows:[row]}}}];
 const third=box([30,0,0],[40,20,10]);await fs.writeFile(dir+'three.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[{...features[0],outputs:[output(a,'a'),output(box([20,0,0],[30,20,10]),'b'),output(third,'c')]}]}));
 await fs.writeFile(dir+'existing.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[{kind:'cadop',id:'thin',name:'薄い板',outputs:[output(thin,'a')],remove:[],analysis:{geometryHealth:{rows:[same]}}}]}));
 await fs.writeFile(dir+'gap.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));await fs.writeFile(dir+'touch.forma.json',JSON.stringify({format:'forma-cad',version:1,features:moved}));await fs.writeFile(dir+'delta.forma.json',JSON.stringify({format:'forma-cad',version:1,features:deltaDoc}));
 const proof={precisePreview:true,previewImmutable:true,rigidMovePreservesVolume:true,bodiesRemainSeparate:true,joinOneSolid:true,disconnectedPartsBounds:true,reverseCandidate:true,obliqueCandidate:true,staleRejected:true,obstacleRejected:true,newSlot:true,existingThinFace:true,incompleteComparisonUnknown:true,stableMatchingWithoutFaceIndices:true};await fs.writeFile(dir+'native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{owned.reverse().forEach(s=>s.delete());}
