import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {defaults} from '../src/geometry.js';import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const shape=o=>R.deserializeShape(o.brep).asShape3D();
// Exactly complementary threads can have an empty native common. The convenience
// Compound.intersect path tries to cast that null result as a solid.
function overlap(a,b){const oc=R.getOC(),left=a.solids,right=b.solids;let volume=0;try{for(const l of left)for(const r of right){const builder=new oc.BRepAlgoAPI_Common(l.wrapped,r.wrapped);let raw,common;try{builder.Build();assert.ok(builder.IsDone()&&!builder.HasErrors());builder.SimplifyResult(true,true,.001);raw=builder.Shape();if(raw.IsNull())continue;common=R.cast(raw);volume+=Math.abs(R.measureVolume(common));}finally{common?.delete();raw?.delete();builder.delete();}}return volume;}finally{[...left,...right].forEach(s=>s.delete());a.delete();b.delete();}}

// Classify actual trimmed surface samples against the other body's solids.
// This remains meaningful for exactly touching partial cylinders, where OCCT's
// common operation may fail, and detects deliberately misphased thread flanks.
function surfaceInterference(source,target){
 const oc=R.getOC(),own=new oc.BRepExtrema_DistShapeShape(),other=new oc.BRepExtrema_DistShapeShape(),faces=source.faces,solids=target.solids;let checked=0,inside=0;
 try{for(const face of faces){own.LoadS2(face.wrapped);for(const u of [.2,.5,.8])for(const v of [.2,.5,.8]){const p=face.pointOnSurface(u,v),vertex=R.makeVertex(p.toTuple());try{own.LoadS1(vertex.wrapped);own.Perform();assert.ok(own.IsDone());if(own.Value()>1e-6)continue;checked++;for(const solid of solids){other.LoadS1(vertex.wrapped);other.LoadS2(solid.wrapped);other.Perform();assert.ok(other.IsDone());if(other.InnerSolution()){inside++;break;}}}finally{vertex.delete();p.delete();}}}return {checked,inside};}
 finally{faces.forEach(f=>f.delete());solids.forEach(s=>s.delete());own.delete();other.delete();source.delete();target.delete();}
}

for(const [diameter,pitch,depth,leftHand,fullLength] of [[10,1.5,5,false,true],[10,1.5,5,true,true],[30,4,12,false,false]]){
 const c={...defaults,id:'male',profile:'circle',diameter,depth},box={...defaults,id:'female',width:diameter*2,height:diameter*2,depth},hole={...c,id:'hole',operation:'cut',target:'female',z:depth,depth:-depth,hole:true};
 const spec={type:'thread',profile:'metric60',threadVersion:2,fullLength,length:7,offset:3,pitch,leftHand,surfacePoint:[diameter/2,0,depth*.7]};
 const male=runOperation([c],{...spec,target:'male'}),female=runOperation([box,hole],{...spec,target:'female'}),m=male.outputs[0],f=female.outputs[0];
 let radius=0;for(let i=0;i<m.vertices.length;i+=3)radius=Math.max(radius,Math.hypot(m.vertices[i],m.vertices[i+1]));
 assert.ok(radius<=diameter/2+.0001,'Male maximum diameter stays nominal');
 assert.ok(R.measureVolume(shape(m))<Math.PI*(diameter/2)**2*depth-1,'Male thread removes material');
 const interference=fullLength?overlap(shape(m),shape(f)):null;console.log('overlap',leftHand,interference,'volumes',R.measureVolume(shape(m)),R.measureVolume(shape(f)),m.threadSource.spec.threadInternal,f.threadSource.spec.threadInternal);if(fullLength)assert.ok(interference<.001,'Same size male/female have complementary thread profiles');for(const [a,b] of [[m,f],[f,m]]){const probe=surfaceInterference(shape(a),shape(b));assert.ok(probe.checked>50);assert.equal(probe.inside,0,'complementary flanks must not penetrate the other solid');}
 assert.ok(surfaceInterference(shape(m).rotate(30,[0,0,0],[0,0,1]),shape(f)).inside>0,'the interference check detects deliberately misaligned flanks');
 const features=[c,{id:'thread',kind:'cadop',spec:{...spec,target:'male'},...male}];
 const pulled=runOperation(features,{type:'pull',target:'male',allThreadFaces:true,distance:-.05});
 assert.ok(R.measureVolume(shape(pulled.outputs[0]))<R.measureVolume(shape(m)),'Negative pull adds male clearance');
 if(fullLength)assert.ok(overlap(shape(pulled.outputs[0]),shape(f))<.001);assert.equal(surfaceInterference(shape(pulled.outputs[0]),shape(f)).inside,0);
 console.log('PASS nominal male/female fit and clearance',leftHand?'left':'right');
}
