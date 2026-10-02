import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {kernelBodies,runOperation} from '../src/kernel.js';import {bodyCacheStats,clearBodyCache} from '../src/body-cache.js';import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const f={...defaults,id:'a',width:10,height:10,depth:10};
function volume(features){const b=kernelBodies(features);try{return R.measureVolume(b.get('a'));}finally{for(const s of b.values())s.delete();}}
clearBodyCache();assert.equal(Math.round(volume([f])),1000);const misses=bodyCacheStats.misses;assert.equal(Math.round(volume([f])),1000);assert.equal(bodyCacheStats.misses,misses);assert.ok(bodyCacheStats.hits>0);
const moved=runOperation([f],{type:'move',target:'a',angle:0,x:20,y:0,z:0});assert.equal(Math.round(volume([f])),1000);const b=kernelBodies([f]);assert.ok(b.get('a').boundingBox.bounds[1][0]<15);b.get('a').delete();
const before=bodyCacheStats.hits;assert.equal(Math.round(volume([f,{kind:'cadop',remove:[],outputs:moved.outputs}])),1000);assert.ok(bodyCacheStats.hits>before);
assert.equal(Math.round(volume([{...f,depth:20}])),2000);assert.equal(Math.round(volume([f])),1000);
const tool={...f,id:'tool',operation:'cut',target:'a',width:5};const original=volume([f,tool]);assert.notEqual(volume([{...f,depth:20},tool]),original);assert.equal(volume([f,tool]),original);
for(let i=1;i<60;i++)volume([{...f,depth:i}]);assert.equal(Math.round(volume([f])),1000);clearBodyCache();console.log('PASS cache hits, emitted shape reuse, mutation isolation, dimension changes, dependent cuts, undo and eviction');
