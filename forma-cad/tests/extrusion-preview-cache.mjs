import assert from 'node:assert/strict';
import {ExtrusionPreviewCache} from '../src/extrusion-preview-cache.js';
import {replayHistory} from '../src/history-replay.js';
import {findRegions} from '../src/regions.js';
import {defaults} from '../src/geometry.js';

const cache=new ExtrusionPreviewCache(),history=[{id:'source'}];
const feature={...defaults,id:'preview',kind:'extrusion',name:'プレビュー',barrier:true,barrierGap:.8};
const result={outputs:[{id:'preview',brep:'exact saved geometry',vertices:[0,0,0],triangles:[0,1,2]}],remove:[],removed:[{id:'source',vertices:[1,2,3]}],previewWarnings:[{message:'display only'}]};
cache.store(history,[feature],[{...feature,cadResult:result}]);
const committed=Object.fromEntries(Object.entries({...feature,id:'actual',name:'確定'}).reverse());
const ready=cache.get(history,[committed]);
assert.equal(ready.features[0].id,'actual');assert.equal(ready.features[0].name,'確定');
assert.equal(ready.features[0].cadResult.outputs[0].id,'actual');
assert.equal(ready.features[0].cadResult.outputs[0].brep,'exact saved geometry');
assert.equal(ready.features[0].cadResult.removed,undefined);assert.equal(ready.features[0].cadResult.previewWarnings,undefined);
ready.features[0].cadResult.outputs[0].vertices[0]=99;
result.outputs[0].brep='mutated original';
assert.equal(cache.get(history,[committed]).features[0].cadResult.outputs[0].brep,'exact saved geometry');
assert.equal(cache.get(history,[committed]).features[0].cadResult.outputs[0].vertices[0],0);
for(const patch of [{depth:3},{barrierGap:.55},{operation:'join'},{target:'other'},{region:{outer:[[0,0],[1,0],[0,1]],holes:[]}}])assert.equal(cache.get(history,[{...committed,...patch}]),null);
assert.equal(cache.get([...history],[committed]),null,'model changes invalidate prepared output');
assert.equal(cache.get(history,[committed],'edit'),null,'new and edited operations must not share a result');
cache.store(history,[feature],[{...feature,cadResult:{...result,outputs:[{id:'preview',brep:'edit'}]}}],'edit');
assert.equal(cache.get(history,[feature]),null);assert.equal(cache.get(history,[feature],'edit').features[0].cadResult.outputs[0].brep,'edit');

const a={...feature,id:'a',faceBatch:'a'},b={...feature,id:'b',operation:'join',target:'a',targetBodies:['a','existing'],faceBatch:'a'};
const first={...a,cadResult:{outputs:[{id:'a',brep:'first'}],remove:[]}},second={...b,target:'existing',cadResult:{outputs:[{id:'existing',brep:'joined'}],remove:['a']}};
cache.store(history,[a,b],[first,second]);
const batch=cache.get(history,[{...a,id:'new-a',faceBatch:'new-a'},{...b,id:'new-b',target:'new-a',targetBodies:['new-a','existing'],faceBatch:'new-a'}]).features;
assert.equal(batch[0].cadResult.outputs[0].id,'new-a');assert.equal(batch[1].faceBatch,'new-a');
assert.equal(batch[1].target,'existing','preserve targets resolved by earlier joins in the preview batch');
assert.deepEqual(batch[1].cadResult.remove,['new-a']);assert.equal(batch[1].cadResult.outputs[0].id,'existing');
cache.clear();assert.equal(cache.get(history,[a,b]),null);
cache.store(history,[feature],[{...feature,cadResult:{outputs:[{id:'preview'}],remove:[]}}]);assert.equal(cache.get(history,[feature]),null);
const small=new ExtrusionPreviewCache(20);small.store(history,[feature],[{...feature,cadResult:result}]);assert.equal(small.get(history,[feature]),null,'large results fall back to the kernel');
cache.store(history,[{...feature,barrier:false}],[{...feature,cadResult:result}]);assert.equal(cache.get(history,[feature]),null);

// Starting after an adopted result must still refresh the very first successor.
const sketch={...defaults,id:'sketch',kind:'sketch',width:10,height:10},region=findRegions([sketch])[0];
const extrusion={...defaults,id:'later',kind:'extrusion',profile:'region',region,barrier:true};
let passed;
const replay=replayHistory([sketch,extrusion],[{...sketch,width:20},extrusion],1,(prefix,operation)=>{passed=operation.feature.region;return {outputs:[{id:'later',brep:'refreshed'}],remove:[]};},null,null,null,true);
assert.equal(Math.round(passed.area),200);assert.equal(Math.round(replay[1].region.area),200);
console.log('PASS exact complete preview reuse, IDs/names/batches, resolved join targets, immutable data, invalidation, size limit and first-successor refresh');
