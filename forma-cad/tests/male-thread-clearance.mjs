import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {offsetThreadProfile} from '../src/thread-pull.js';
const pitch=1.5,h=pitch*.541266,s=.325/.561266,a=pitch*(.05+.02*s),b=pitch*(.375+.04*s);
const profile=[[-pitch*.02,-b],[h+pitch*.02,-a],[h+pitch*.02,a],[-pitch*.02,b]];
assert.equal(offsetThreadProfile(profile,[-.1,-.1,-.1,0]).length,4);
assert.equal(offsetThreadProfile(profile,[-.2,-.2,-.2,0]).length,3);
assert.throws(()=>offsetThreadProfile(profile,[-.6,-.6,-.6,0]),/ねじ山/);
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const cylinder={...defaults,id:'c',profile:'circle',diameter:10,depth:20};
const spec={type:'thread',target:'c',profile:'metric60',threadVersion:2,pitch,fullLength:true,surfacePoint:[5,0,14]};
const original=runOperation([cylinder],spec),shape=o=>R.deserializeShape(o.brep).asShape3D();
let previous=R.measureVolume(shape(original.outputs[0]));
for(const distance of [-.2,-.3]){
 const features=[cylinder,{id:'thread',kind:'cadop',spec,...original}];
 const output=runOperation(features,{type:'pull',target:'c',allThreadFaces:true,distance}).outputs[0];
 const solid=shape(output),volume=R.measureVolume(solid);
 assert.equal(solid.solids.length,1);
 assert.ok(solid.faces.some(f=>f.geomType==='BSPLINE_SURFACE'));
 assert.ok(volume<previous);previous=volume;
 console.log('PASS diameter 10, length 20, pitch 1.5, pull',distance,volume);
}
const created=runOperation([cylinder],{...spec,threadFaceOffsets:[-.2,-.2,-.2,0]}).outputs[0];
assert.equal(shape(created).solids.length,1);
console.log('PASS create-time automatic pull -0.2');
