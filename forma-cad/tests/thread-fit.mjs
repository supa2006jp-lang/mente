import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {defaults} from '../src/geometry.js';import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const shape=o=>R.deserializeShape(o.brep).asShape3D();
for(const [diameter,pitch,depth,leftHand,fullLength] of [[10,1.5,5,false,true],[10,1.5,5,true,true],[30,4,12,false,false]]){
 const c={...defaults,id:'male',profile:'circle',diameter,depth},box={...defaults,id:'female',width:diameter*2,height:diameter*2,depth},hole={...c,id:'hole',operation:'cut',target:'female',z:depth,depth:-depth,hole:true};
 const spec={type:'thread',profile:'metric60',threadVersion:2,fullLength,length:7,offset:3,pitch,leftHand,surfacePoint:[diameter/2,0,depth*.7]};
 const male=runOperation([c],{...spec,target:'male'}),female=runOperation([box,hole],{...spec,target:'female'}),m=male.outputs[0],f=female.outputs[0];
 let radius=0;for(let i=0;i<m.vertices.length;i+=3)radius=Math.max(radius,Math.hypot(m.vertices[i],m.vertices[i+1]));
 assert.ok(radius<=diameter/2+.0001,'Male maximum diameter stays nominal');
 assert.ok(R.measureVolume(shape(m))<Math.PI*(diameter/2)**2*depth-1,'Male thread removes material');
 const overlap=Math.abs(R.measureVolume(shape(m).intersect(shape(f))));console.log('overlap',leftHand,overlap,'volumes',R.measureVolume(shape(m)),R.measureVolume(shape(f)),m.threadSource.spec.threadInternal,f.threadSource.spec.threadInternal);assert.ok(overlap<.001,'Same size male/female have complementary thread profiles');
 const features=[c,{id:'thread',kind:'cadop',spec:{...spec,target:'male'},...male}];
 const pulled=runOperation(features,{type:'pull',target:'male',allThreadFaces:true,distance:-.05});
 assert.ok(R.measureVolume(shape(pulled.outputs[0]))<R.measureVolume(shape(m)),'Negative pull adds male clearance');
 const pulledOverlap=Math.abs(R.measureVolume(shape(pulled.outputs[0]).intersect(shape(f))));assert.ok(pulledOverlap<.001);
 console.log('PASS nominal male/female fit and clearance',leftHand?'left':'right');
}
