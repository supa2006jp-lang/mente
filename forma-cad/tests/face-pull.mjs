import assert from 'node:assert/strict';import fs from 'node:fs/promises';import * as R from 'replicad';import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';import {defaults} from '../src/geometry.js';
const oc=await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')});R.setOC(oc);
const box={...defaults,id:'b',name:'box',width:30,height:30,depth:8};
const cylinder={...defaults,id:'c',name:'cylinder',profile:'circle',diameter:10,depth:5};
const getVolume=output=>R.measureVolume(R.deserializeShape(output.brep).asShape3D());
let result=runOperation([box],{type:'pull',distance:-.2,faces:[{bodyId:'b',point:[0,0,8],normal:[0,0,1]},{bodyId:'b',point:[15,0,4],normal:[1,0,0]}]});
assert.ok(getVolume(result.outputs[0])<30*30*8);console.log('PASS multiple planar face pull');
result=runOperation([cylinder],{type:'pull',distance:-.1,faces:[{bodyId:'c',point:[5,0,2],normal:[1,0,0]}]});
assert.ok(getVolume(result.outputs[0])<Math.PI*25*5);console.log('PASS cylinder face pull');
for(const internal of [false,true]){
 const initial=internal?[box,{...cylinder,id:'h',operation:'cut',target:'b',z:8,depth:-8}]:[cylinder],target=internal?'b':'c';
 const spec={type:'thread',target,surfacePoint:[5,0,4],profile:'metric60',pitch:1.5,fullLength:true};
 const thread=runOperation(initial,spec),features=[...initial,{kind:'cadop',id:'thread',name:'thread',spec,...thread}],base=kernelBodies(features).get(target);base.mesh();
 const faces=[];
 for(const face of base.faces.filter(f=>f.geomType==='BSPLINE_SURFACE')){
  const m=face.triangulation();if(!m?.trianglesIndexes?.length)continue;
  let largest=null;
  for(let i=0;i<m.trianglesIndexes.length;i+=3){const [a,b,c]=m.trianglesIndexes.slice(i,i+3).map(j=>new THREE.Vector3(...m.vertices.slice(j*3,j*3+3))),normal=b.clone().sub(a).cross(c.clone().sub(a)),area=normal.length();if(!largest||area>largest.area)largest={area,point:a.add(b).add(c).multiplyScalar(1/3).toArray(),normal:normal.normalize().toArray()};}
  if(largest)faces.push({bodyId:target,point:largest.point,normal:largest.normal});
 }
 assert.ok(faces.length>=2,'Thread must have selectable curved faces');
 const automatic=runOperation(features,{type:'pull',distance:-.1,allThreadFaces:true,target});
 assert.ok(getVolume(automatic.outputs[0])<R.measureVolume(base)-.1,'Automatic pull reduces thread material without face selection');
 assert.deepEqual(automatic.outputs[0].threadSource.spec.threadFaceOffsets,[-.1,-.1,-.1,0]);
 const automaticSaved=JSON.parse(JSON.stringify([...features,{kind:'cadop',id:'auto',name:'auto pull',spec:{type:'pull'},...automatic}]));
 const repeated=runOperation(automaticSaved,{type:'pull',distance:-.03,allThreadFaces:true,target});
 assert.ok(getVolume(repeated.outputs[0])<getVolume(automatic.outputs[0]),'Automatic selection survives saving and repeated pull');
 assert.throws(()=>runOperation(features,{type:'pull',distance:-100,allThreadFaces:true,target}),/40%/);
 console.log('PASS automatic thread pull and repeated saved pull',internal?'internal':'external');
 const pulled=runOperation(features,{type:'pull',distance:-.1,faces});
 assert.ok(getVolume(pulled.outputs[0])<R.measureVolume(base)-.1,'Negative pull must reduce thread material');
 assert.ok(pulled.outputs[0].threadSource,'Preserve editable thread source for repeated pulls');
 const saved=[...features,{kind:'cadop',id:'pull1',name:'pull',spec:{type:'pull'},...pulled}];
 const second=runOperation(saved,{type:'pull',distance:-.03,faces});
 assert.ok(getVolume(second.outputs[0])<getVolume(pulled.outputs[0]),'Saved thread can be pulled repeatedly');
 const check=new oc.BRepCheck_Analyzer(R.deserializeShape(pulled.outputs[0].brep).wrapped,true,false);assert.ok(check.IsValid());check.delete();
 console.log('PASS thread curved face multi-pull',internal?'internal':'external',faces.length);
}
