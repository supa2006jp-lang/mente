import assert from 'node:assert/strict';
import {replayHistory} from '../src/history-replay.js';
import {historyImpact} from '../src/history-impact.js';
const body=id=>({kind:'extrusion',operation:'new',id,name:id,depth:10});
const cached=(id,target,type)=>({kind:'cadop',id,name:id,spec:{type,id,target},outputs:[{id:target,brep:'cached-'+id}],remove:[]});
const before=[body('a'),body('b'),cached('thread','b','thread'),cached('fillet','b','fillet'),cached('shell','a','shell')];
const next=structuredClone(before);next[0].depth=20;
const calls=[],events=[],run=(prefix,spec)=>{calls.push(spec.type);return {outputs:[{id:spec.target,brep:'new-'+spec.type}],remove:[]};};
const result=replayHistory(before,next,0,run,(a,b,s)=>s,null,e=>events.push(e));
assert.deepEqual(calls,['shell']);assert.deepEqual(result[2],before[2]);assert.deepEqual(result[3],before[3]);assert.equal(events.at(-1).reused,3);
calls.length=0;replayHistory(before,next,1,run,null,null,null,true);assert.deepEqual(calls,['shell'],'a prepared edit must not invalidate an independent first successor');
calls.length=0;replayHistory(before,before,2,run);assert.deepEqual(calls,['thread','fillet'],'an explicitly requested recovery start must still run');
const bChanged=structuredClone(before);bChanged[1].depth=15;calls.length=0;replayHistory(before,bChanged,1,run);assert.deepEqual(calls,['thread','fillet']);
// Unscoped and unknown operations must never receive a speculative cache hit.
for(const type of ['move','printLayout','join','assemblyMate','futureOperation','loft']){const full=[...before,cached('global','b',type)],proposed=structuredClone(full);proposed[0].depth=12;calls.length=0;replayHistory(full,proposed,0,run);assert.ok(calls.includes(type),type);}
const noCache=structuredClone(before);delete noCache[2].outputs;calls.length=0;replayHistory(before,noCache,0,run);assert.ok(calls.includes('thread'));
const empty=structuredClone(before);empty[2].outputs=[];calls.length=0;replayHistory(empty,empty,0,run);assert.ok(calls.includes('thread'),'empty cache must recompute');
const reordered=[before[1],before[0],...before.slice(2)];calls.length=0;replayHistory(before,reordered,0,run);assert.deepEqual(calls,['thread','fillet','shell']);
calls.length=0;replayHistory(before,next,0,run,null,null,null,false,true);assert.deepEqual(calls,['thread','fillet','shell']);
assert.equal(historyImpact(before,'a').affected,1);assert.equal(historyImpact(before,'b').affected,2);
assert.equal(JSON.stringify(before).includes('new-shell'),false);
console.log('PASS unrelated thread/fillet reuse, propagation, missing cache, unknown/global fallback, reorder, forced replay and impact prediction');
