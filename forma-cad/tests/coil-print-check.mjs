import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {analyzeCoilPrint} from '../src/coil-print-check.js';
function box(id,x,y,z,center=[0,0,z/2],rotation){const g=new THREE.BoxGeometry(x,y,z);if(rotation)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation));g.translate(...center);const o={id,vertices:Array.from(g.attributes.position.array),triangles:Array.from(g.index.array)};g.dispose();return o;}
const thin=await analyzeCoilPrint([box('slab',10,10,.4)]);assert.equal(thin.stats.thinTriangles,4,'genuine opposite thin broad faces');assert.equal(thin.stats.unsupportedTriangles,0,'bed excluded');assert.equal(thin.outputs[0].thin.length,36);
const thick=await analyzeCoilPrint([box('cube',10,10,10)]);assert.equal(thick.stats.thinTriangles,0);assert.equal(thick.stats.unsupportedTriangles,0);
const floating=await analyzeCoilPrint([box('floating',10,10,2,[0,0,5])]);assert.equal(floating.stats.unsupportedTriangles,2);assert.equal(floating.outputs[0].unsupported.length,18);
const supported=await analyzeCoilPrint([box('lower',10,10,3),box('upper',10,10,2,[0,0,4.2])]);assert.equal(supported.stats.unsupportedTriangles,0,'support in another output');
const gap=await analyzeCoilPrint([box('lower',10,10,3),box('upper',10,10,2,[0,0,4.4])]);assert.equal(gap.stats.unsupportedTriangles,2);
const rotated=await analyzeCoilPrint([box('rotated',10,10,.4,[0,0,5],new THREE.Euler(Math.PI/2,0,0))]);assert.equal(rotated.stats.thinTriangles,4);assert.equal(rotated.stats.unsupportedTriangles,0,'rotating onto the edge changes bed contact and overhangs');
assert.equal((await analyzeCoilPrint([box('below-bed',10,10,2,[0,0,-5])])).stats.unsupportedTriangles,2,'surfaces below the grid are not bed contact');
const single={id:'open',vertices:[0,0,1,10,0,1,10,10,1],triangles:[0,1,2]};assert.equal((await analyzeCoilPrint([single])).stats.thinTriangles,0);
const tiny={id:'tiny',vertices:[0,0,2,1e-7,0,2,0,1e-7,2],triangles:[0,1,2]},skip=await analyzeCoilPrint([tiny]);assert.equal(skip.stats.degenerate,1);assert.equal(skip.stats.thinTriangles+skip.stats.unsupportedTriangles,0);
let calls=0;await assert.rejects(analyzeCoilPrint([box('cancel',10,10,10)],{shouldCancel:()=>++calls>1}),e=>e.name==='AbortError');
assert.deepEqual((await analyzeCoilPrint([])).outputs,[]);await assert.rejects(analyzeCoilPrint([single],{minThickness:0}));
console.log('PASS thickness, bed exclusion, local support, rotated orientation, open faces, degenerate rejection, cancellation');
const fixture=process.argv[2]||'../修正版/design.forma(26)-内蔵爪・回転止め強化.forma.json';
try{const data=JSON.parse(await fs.readFile(fixture,'utf8')),f=data.features.findLast(f=>f.spec?.type==='coilJoint');if(f){const start=performance.now(),r=await analyzeCoilPrint(f.outputs);assert.ok(r.stats.triangles>1000);assert.ok(r.outputs.every(o=>o.thin.length%9===0&&o.unsupported.length%9===0));console.log(JSON.stringify({fixture,triangles:r.stats.triangles,elapsedMs:Math.round(performance.now()-start),thin:r.stats.thinTriangles,overhang:r.stats.unsupportedTriangles}));}}catch(e){if(e.code!=='ENOENT')throw e;}