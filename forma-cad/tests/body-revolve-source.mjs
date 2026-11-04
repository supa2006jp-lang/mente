import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'base',kind:'extrusion',profile:'circle',diameter:70,depth:10};
const source={...base,id:'source',diameter:10,depth:4,x:23,z:10};
const features=[base,source];
const sweep={id:'sweep',type:'revolve',sourceBody:source.id,bodySweep:true,origin:[0,0,0],axisVector:[0,0,1],angle:360,direction:'片側'};

for(const [operation,target,outputId] of [['new',undefined,'sweep'],['join','base','base'],['join','source','source']]){
 const spec={...sweep,operation,target,keepSourceBody:false};
 const result=runOperation(features,spec);
 assert.equal(result.outputs[0].id,outputId);
 assert.deepEqual(result.remove,target==='source'?[]:['source']);
 const history=[...features,{kind:'cadop',id:spec.id,spec,...result}];
 const bodies=kernelBodies(history);
 try{
  assert.equal(bodies.has('source'),target==='source');
  const body=bodies.get(outputId),faces=body.faces;
  try{
   const ringVolume=Math.PI*(28**2-18**2)*source.depth;
   const expected=ringVolume+(target==='base'?Math.PI*35**2*base.depth:0);
   assert(Math.abs(R.measureVolume(body)-expected)<.001);
   assert.equal(faces.length,target==='base'?7:4);
  }finally{faces.forEach(face=>face.delete());}
  assert(inspectCadStl(result.outputs[0]).report.ok);
 }finally{bodies.forEach(body=>body.delete());}
 if(target==='base'){
  const replay=runOperation(history,{type:'replay',before:history,start:features.length,forceFull:true});
  assert.deepEqual(replay.features.at(-1).remove,['source']);
 }
}

for(const setting of [{},{keepSourceBody:true}]){
 const result=runOperation(features,{...sweep,operation:'join',target:'base',...setting});
 assert.deepEqual(result.remove,[]);
}
const cut=runOperation([{...base,depth:13},source],{...sweep,operation:'cut',target:'base',keepSourceBody:false});
assert.deepEqual(cut.remove,[]);
assert(cut.outputs[0].shapeMetrics.volume<Math.PI*35**2*13);
console.log('PASS revolved cylinder replaces its source, stays closed, replays and can keep the source');
