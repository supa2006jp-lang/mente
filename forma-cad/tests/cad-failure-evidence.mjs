import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'base',kind:'extrusion',name:'base',width:10,height:10,depth:10};
for(const x of [10,30]){
 const tool={...base,id:'tool',x},history=[base,tool],before=JSON.stringify(history);
 const cut={type:'join',target:'base',other:'tool',combineMode:'切り取り',keepTools:'削除'},feature={...tool,id:'cut',operation:'cut',target:'base'};
 for(const operation of [cut,{type:'extrusion',target:'base',feature}])for(const spec of [operation,{type:'preview',operation}])assert.throws(()=>runOperation(history,spec),error=>{
  assert.equal(error.code,'no-material-removal');assert.equal(error.diagnostics.certainty,'measured');assert.deepEqual(error.diagnostics.bodyIds,['base']);const issue=error.diagnostics.issues[0];assert.equal(issue.code,x===10?'no-material-change':'separated-tool');assert.ok(Math.abs(issue.distance-(x-10))<1e-6);assert.equal(issue.bounds.length,2);return true;
 });assert.equal(JSON.stringify(history),before);
}
console.log('PASS native measured separation vs zero-distance contact for boolean/extrusion preview and commit; unchanged input');
