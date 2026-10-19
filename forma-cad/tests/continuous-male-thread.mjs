import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';
import {verifyThreadRidges} from '../src/thread-ridge-coverage.js';
import {headedThreadSeed} from './continuous-thread-fixture.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const seed=headedThreadSeed(),before=JSON.stringify(seed),spec={type:'thread',target:'bolt',id:'thread',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,surfacePoint:[5,0,30]},stages=[];
let cuts=0,proto=R.Solid.prototype;while(!Object.hasOwn(proto,'cut'))proto=Object.getPrototypeOf(proto);const original=proto.cut;proto.cut=function(...args){cuts++;return original.apply(this,args);};
let result;const started=performance.now();try{result=runOperation([seed],spec,p=>stages.push(p.stage));}finally{proto.cut=original;}
const elapsedMs=Math.round(performance.now()-started);assert.ok(elapsedMs<85000,'headed M10 x 40 must finish within the worker deadline');assert.ok(cuts<6,'avoid repeated whole-thread retention cuts');assert.ok(!stages.includes('ねじ山を結合し直しています'));assert.equal(JSON.stringify(seed),before);
const output=result.outputs[0],shape=R.deserializeShape(output.brep).asShape3D(),solids=shape.solids,checker=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);assert.ok(checker.IsValid());checker.delete();assert.equal(solids.length,1);solids.forEach(s=>s.delete());
const volume=R.measureVolume(shape);assert.ok(volume>5100&&volume<5300,'retain the head and every turn of the ridge');let crestChecks=0;
for(let i=0;i<output.vertices.length;i+=3){const z=output.vertices[i+2];if(z>10.001&&z<49.999){const radius=Math.hypot(output.vertices[i],output.vertices[i+1]);assert.ok(radius>=4.158101-.001&&radius<=5.001,'no exposed buried ridge faces');}}
for(let z=.375;z<39.75;z+=.375){const angle=Math.PI+2*Math.PI*z/1.5,point=R.makeVertex([5*Math.cos(angle),5*Math.sin(angle),10+z]);try{assert.ok(R.measureDistanceBetween(shape,point)<.001,'missing crest at '+z);crestChecks++;}finally{point.delete();}}
const headRegion=R.makeBox([-20,-20,-1],[20,20,9.999]),head=shape.intersect(headRegion);assert.ok(Math.abs(R.measureVolume(head)-3*Math.sqrt(3)/2*100*9.999)<.001);head.delete();headRegion.delete();
const core=R.makeCylinder(4.158101,40,[0,0,10]);assert.throws(()=>verifyThreadRidges(core,[shape],{origin:new THREE.Vector3(0,0,10),normal:new THREE.Vector3(0,0,1)},4.158101,40),/ねじ山を保持/);core.delete();shape.delete();
const proof={elapsedMs,cuts,crestChecks,volume,triangles:output.triangles.length/3,stages,sourceUnchanged:true};console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/continuous-male-thread-proof.json',JSON.stringify(proof,null,2));
