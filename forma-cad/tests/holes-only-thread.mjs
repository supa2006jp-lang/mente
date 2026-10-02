import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {featureSolid,runOperation,kernelBodies} from '../src/kernel.js';import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const body={...defaults,id:'b',profile:'circle',diameter:20,depth:30,x:0,y:0,z:0};
const hole={...body,id:'h',diameter:10,z:30,depth:-30.01,operation:'cut',target:'b',hole:true};
const threaded=runOperation([body,hole],{type:'thread',target:'b',surfacePoint:[5,0,20],pitch:1.5,profile:'metric60',threadVersion:2,fullLength:true});
const ring=r=>Array.from({length:128},(_,i)=>[r*Math.cos(i*Math.PI/64),r*Math.sin(i*Math.PI/64)]);
const f={...defaults,id:'plug',profile:'region',mode:'solid',operation:'new',holesOnly:true,depth:-15,region:{plane:'XY',offset:30,outer:ring(10),holes:[ring(5).reverse()],cadFace:{bodyId:'b',point:[7,0,30],normal:[0,0,1]}}};
for(const withThread of [false,true]){
 const bodies=kernelBodies(withThread?[{kind:'cadop',...threaded}]:[body,hole]);
 const plug=featureSolid(f,bodies),source=bodies.get('b'),overlap=plug.intersect(source),v=R.measureVolume(plug);
 assert.ok(Math.abs(R.measureVolume(overlap))<1e-5,'Plug must not overlap source');
 if(withThread)assert.ok(v<Math.PI*25*15-10,'Thread must be copied into plug');else assert.ok(Math.abs(v-Math.PI*25*15)<.01);
 const check=new (R.getOC().BRepCheck_Analyzer)(plug.wrapped,true,false);assert.ok(check.IsValid());check.delete();
 console.log('PASS hole copy',withThread?'threaded':'plain',v);overlap.delete();plug.delete();for(const b of bodies.values())b.delete();
}
