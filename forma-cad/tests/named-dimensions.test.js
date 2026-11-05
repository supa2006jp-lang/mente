import test from 'node:test';
import assert from 'node:assert/strict';
import {namedDimensionBinding,planNamedDimensionChange,readNamedDimensions} from '../src/named-dimensions.js';
import {findMachiningValues} from '../src/machining-value-trials.js';
import {KernelClient} from '../src/kernel-client.js';
import {filletRadiusChange} from '../src/fillet-history.js';
import {readFavoriteCommands} from '../src/favorite-commands.js';

test('one named edit updates every linked shape dimension, hole and fillet without changing unlinked values',()=>{
 const before={幅:40,穴径:8,丸み:1},after={幅:50,穴径:10,丸み:.8};
 const features=[
  {id:'rect',kind:'sketch',profile:'rect',width:40,height:20,dimensionLinks:{width:'幅',height:'幅 / 2'}},
  {id:'circle',kind:'sketch',profile:'circle',diameter:8,dimensionLinks:{diameter:'穴径'}},
  {id:'hole',name:'穴',kind:'extrusion',profile:'circle',hole:true,counterbore:true,diameter:8,depth:-4,counterboreDiameter:12,counterboreDepth:2,dimensionLinks:{diameter:'穴径',counterboreDiameter:'穴径+4'}},
  {id:'fillet',kind:'cadop',spec:{type:'fillet',radius:1,target:'body'},dimensionLinks:{radius:'丸み'}},
 ];
 const original=structuredClone(features),plan=planNamedDimensionChange(features,before,after);
 assert.equal(plan.start,0);assert.deepEqual([plan.next[0].width,plan.next[0].height,plan.next[1].diameter],[50,25,10]);
 assert.deepEqual([plan.next[2].diameter,plan.next[2].counterboreDiameter,plan.next[2].depth],[10,14,-4]);
 assert.equal(plan.next[3].spec.radius,.8);assert.deepEqual(features,original);
 assert.throws(()=>planNamedDimensionChange(features,before,{...after,穴径:-1}),/範囲外/);
 assert.throws(()=>planNamedDimensionChange(features,before,{幅:50,穴径:10}),/丸み/);
 assert.deepEqual(features,original);
 const linked=filletRadiusChange(features,'fillet',.8,'丸み');assert.equal(linked.features[3].dimensionLinks.radius,'丸み');
 const manual=filletRadiusChange(features,'fillet',2);assert.equal(manual.features[3].dimensionLinks,undefined);
});

test('favorite settings accept unique stable command IDs and discard malformed storage data',()=>{
 assert.deepEqual(readFavoriteCommands(null),{favorites:[],hidden:[],collapsed:false,autoSort:false,colors:{}});
 assert.deepEqual(readFavoriteCommands({favorites:['solid-tool','solid-tool',null,'<script>','move-tool'],hidden:['direct-fillet'],collapsed:true}),{favorites:['solid-tool','move-tool'],hidden:['direct-fillet'],collapsed:true,autoSort:false,colors:{}});
});

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
