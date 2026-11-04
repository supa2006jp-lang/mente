import test from 'node:test';
import assert from 'node:assert/strict';
import {namedDimensionBinding,planNamedDimensionChange,readNamedDimensions} from '../src/named-dimensions.js';
import {findMachiningValues} from '../src/machining-value-trials.js';
import {KernelClient} from '../src/kernel-client.js';

test('named values update only linked dimensions and reject dangling references before touching history',()=>{
 const before=readNamedDimensions({壁厚:2,高さ:8});
 const after=readNamedDimensions({壁厚:3,高さ:9});
 const features=[
  {kind:'sketch',name:'元の輪郭'},
  {kind:'extrusion',name:'箱',depth:8,dimensionLinks:{depth:'高さ'}},
  {kind:'cadop',name:'シェル',spec:{type:'shell',thickness:4},dimensionLinks:{thickness:'壁厚 * 2'}},
  {kind:'cadop',name:'溝',spec:{type:'join',combineMode:'切り取り',cutClearance:1},dimensionLinks:{cutClearance:'壁厚 / 2'}}
 ];
 const original=structuredClone(features);
 const plan=planNamedDimensionChange(features,before,after);
 assert.equal(plan.start,1);
 assert.equal(plan.next[0],features[0]);
 assert.equal(plan.next[1].depth,9);
 assert.equal(plan.next[2].spec.thickness,6);
 assert.equal(plan.next[3].spec.cutClearance,1.5);
 assert.throws(()=>planNamedDimensionChange(features,before,readNamedDimensions({高さ:9})),/壁厚/);
 assert.deepEqual(features,original);
 assert.equal(namedDimensionBinding('1e2 / 2',before),null);
 assert.throws(()=>namedDimensionBinding('constructor(1)',before),/constructor/);
});

test('candidate search accepts only full validated bodies and stops at the overall time limit',async()=>{
 const spec={type:'shell',target:'a',thickness:10};
 const runs=[];
 const fake={
  async run(features,request){
   runs.push(request.operation.thickness);
   const output={id:'a',brep:'native',shapeMetrics:{solids:1}};
   return {outputs:[output],analysis:{geometryHealth:{rows:[{id:'a',valid:runs.length>1}]}}};
  },
  reset(){}
 };
 const result=await findMachiningValues([],spec,{isCurrent:()=>true,client:fake});
 assert.deepEqual(runs,[8,6,4]);
 assert.deepEqual(result.map(candidate=>candidate.value),[6,4]);
 assert.equal(spec.thickness,10);
 const stalled=new KernelClient(()=>({postMessage(){},terminate(){}}));
 const timed=await findMachiningValues([],spec,{isCurrent:()=>true,client:stalled,budgetMs:20});
 assert.deepEqual(timed,[]);
 assert.equal(stalled.pending.size,0);
});
