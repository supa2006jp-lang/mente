import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,rebuild,volume} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {cylindricalSelection} from '../src/cylindrical-selection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));

const body={...defaults,id:'tube',name:'tube',profile:'circle',diameter:20,depth:30,x:0,y:0,z:0};
const hole={...body,id:'hole',diameter:10,z:30,depth:-30.01,operation:'cut',target:'tube',hole:true};
for(const leftHand of [false,true]){
 const result=runOperation([body,hole],{type:'thread',target:'tube',surfacePoint:[5,0,20],pitch:1.5,profile:'metric60',threadVersion:2,fullLength:!leftHand,length:15.4,leftHand}).outputs[0];
 let min=Infinity;
 for(let i=0;i<result.triangles.length;i+=3)for(let j=0;j<3;j++){
  const a=result.vertices.slice(result.triangles[i+j]*3,result.triangles[i+j]*3+3),b=result.vertices.slice(result.triangles[i+(j+1)%3]*3,result.triangles[i+(j+1)%3]*3+3);
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy||1)));
  min=Math.min(min,Math.hypot(a[0]+t*dx,a[1]+t*dy));
 }
 assert.ok(min>4.1,'Thread triangles must not span the open bore: '+min);
 console.log('PASS thread bore tessellation',leftHand?'partial left hand':'full length',min);
}
