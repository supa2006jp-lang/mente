import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
import {extrusionJoinPlan,restrictExtrusionJoins} from '../src/extrusion-join-plan.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const boxes=[{...defaults,id:'a',kind:'extrusion',name:'押し出し元',width:20,height:20,depth:10},{...defaults,id:'b',kind:'extrusion',name:'途中のボディ',width:20,height:20,z:20,depth:4},{...defaults,id:'c',kind:'extrusion',name:'押し出し先',width:20,height:20,z:40,depth:10},{...defaults,id:'away',kind:'extrusion',name:'接触しないボディ',x:60,width:20,height:20,depth:10}];
const region={id:'top',plane:'XY',offset:10,outer:[[-10,-10],[10,-10],[10,10],[-10,10]],holes:[],bodyId:'a',cadFace:{bodyId:'a',point:[0,0,10],normal:[0,0,1]}};
const f={...defaults,id:'f',kind:'extrusion',name:'結合',profile:'region',region,depth:30,operation:'join',target:'a',targetAllBodies:true};
const joined=runOperation(boxes,{type:'extrusionBatch',features:[f]}),info=joined.features[0].cadResult.analysis.extrusionJoin;assert.deepEqual(info.bodyIds,['a','b','c']);assert.deepEqual(info.endBodyIds,['c']);
const plan=extrusionJoinPlan([f],joined.features,boxes.map(f=>f.id));assert.equal(plan.entries[0].destinationId,'c');const limited=restrictExtrusionJoins([f],plan),result=runOperation(boxes,{type:'extrusionBatch',features:limited});assert.deepEqual(result.features[0].cadResult.remove,['c']);assert.deepEqual(result.features[0].targetBodies,['a','c']);
function check(features,ids){const bodies=kernelBodies(features);try{assert.deepEqual([...bodies.keys()].sort(),ids.sort());for(const body of bodies.values()){const valid=new (R.getOC().BRepCheck_Analyzer)(body.wrapped,true,false);assert.ok(valid.IsValid());valid.delete();}}finally{for(const body of bodies.values())body.delete();}}
check([...boxes,...joined.features],['a','away']);check([...boxes,...result.features],['a','b','away']);
const reversed={...f,id:'back',region:{...region,offset:40,bodyId:'c',cadFace:{bodyId:'c',point:[0,0,40],normal:[0,0,-1]}},target:'c',depth:-30};const reverseResult=runOperation(boxes,{type:'extrusionBatch',features:[reversed]});assert.deepEqual(reverseResult.features[0].cadResult.analysis.extrusionJoin.endBodyIds,['a']);
const reload=JSON.parse(JSON.stringify([...boxes,...result.features]));check(reload,['a','b','away']);const replay=runOperation(reload,{type:'replay',before:reload,start:boxes.length});check(replay.features,['a','b','away']);
// Two adjacent plates reproduce a side/edge contact that used to merge
// silently. The new sweep must count toward the three-body threshold.
const sideBoxes=[{...defaults,id:'floor',kind:'extrusion',name:'隣のプレート',x:15,y:15,width:30,height:30,depth:5},{...defaults,id:'source',kind:'extrusion',name:'押し出し元',x:15,y:-10,width:30,height:20,depth:5}];
const sideRegion={id:'left',plane:'CUSTOM',frame:{u:[0,1,0],v:[0,0,-1],n:[-1,0,0]},offset:0,outer:[[0,0],[-20,0],[-20,-5],[0,-5]],holes:[],bodyId:'source',cadFace:{bodyId:'source',point:[0,-13,2.5],normal:[-1,0,0]}};
const sideFeature={...f,id:'side',region:sideRegion,plane:'CUSTOM',frame:sideRegion.frame,target:'source',depth:10};
const sideAll=runOperation(sideBoxes,{type:'extrusionBatch',features:[sideFeature]}),sidePlan=extrusionJoinPlan([sideFeature],sideAll.features,['floor','source']);assert.ok(sidePlan);assert.deepEqual(sideAll.features[0].cadResult.analysis.extrusionJoin.endBodyIds,[]);assert.equal(sidePlan.entries[0].destinationId,null);
const sideLimited=restrictExtrusionJoins([sideFeature],sidePlan),sideResult=runOperation(sideBoxes,{type:'extrusionBatch',features:sideLimited});assert.deepEqual(sideLimited[0].targetBodies,['source']);assert.deepEqual(sideResult.features[0].cadResult.remove,[]);check([...sideBoxes,...sideResult.features],['floor','source']);
const pair=boxes.filter(f=>f.id!=='b'),pairResult=runOperation(pair,{type:'extrusionBatch',features:[f]}),pairPlan=extrusionJoinPlan([f],pairResult.features,pair.map(f=>f.id));assert.ok(pairPlan);assert.equal(pairPlan.entries[0].destinationId,'c');
const single=boxes.filter(f=>f.id!=='b'&&f.id!=='c'),singleResult=runOperation(single,{type:'extrusionBatch',features:[f]});assert.equal(extrusionJoinPlan([f],singleResult.features,single.map(f=>f.id)),null);
await fs.writeFile('.sites-runtime/extrusion-join-side-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:sideBoxes}));
await fs.writeFile('.sites-runtime/extrusion-join-confirm-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:boxes}));console.log('PASS native three-body contacts, exact tip destination, two-body restricted fuse, preserved incidental body, reverse direction, saved scope and replay');
