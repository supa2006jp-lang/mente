import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,makeGeometry} from '../src/geometry.js';
import {featureSolid,runOperation} from '../src/kernel.js';
import {extrusionCutMatches} from '../src/extrusion-auto-cut.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const outer=[[-20,-10],[20,-10],[20,10],[-20,10]],holes=[[[-19,-9],[-19,9],[19,9],[19,-9]]];
const region={id:'outline',plane:'XY',offset:0,outer,holes:[],sourceIds:[],area:800};
const base={...defaults,id:'source',kind:'extrusion',name:'元',profile:'region',region,depth:10};
const hollow={...base,region:{...region,holes,area:116}};
const floor={...defaults,id:'floor',name:'底',kind:'extrusion',width:40,height:20,depth:2};
const above={...floor,id:'above',name:'上の障害物',z:12,depth:3};
const face={...region,offset:10,bodyId:'source',cadFace:{bodyId:'source',point:[19.5,0,10],normal:[0,0,1]}};
const template={...defaults,id:'os',kind:'extrusion',name:'OS',profile:'region',region:face,profileOffset:-2,capHoles:true,z:10};
for(const [history,depth,expected] of [
 [[base],-3,['source']],[[base],3,[]],[[hollow],-3,[]],[[hollow,floor],-9,['floor']],[[base,above],5,['above']]
]){
 const shapes=history.map(feature=>({id:feature.id,shape:featureSolid(feature,new Map())})),meshes=new Map();
 try{
  const native=[{kind:'cadop',id:'bodies',outputs:shapes.map(({id,shape})=>({id,brep:shape.serialize()})),remove:[]}];
  const input={...template,depth};
  assert.deepEqual(runOperation(native,{type:'nativeExtrusionProbe',feature:input,source:'source'}).matches.map(m=>m.id),expected,'native OS actual overlap at '+depth);
  for(const feature of history){const mesh=new THREE.Mesh(makeGeometry(feature));mesh.updateMatrixWorld(true);meshes.set(feature.id,mesh);}
  assert.deepEqual(extrusionCutMatches(input,meshes,'source').map(m=>m.id),expected,'mesh OS actual overlap at '+depth);
 }finally{for(const {shape} of shapes)shape.delete();for(const mesh of meshes.values()){mesh.geometry.dispose();mesh.material.dispose();}}
}
// OS=0 still uses actual filled outer profile, even if the original face is hollow.
const input={...template,profileOffset:0,depth:-3};
assert.equal(runOperation([hollow],{type:'nativeExtrusionProbe',feature:input,source:'source'}).matches[0].id,'source');
console.log('PASS OS automatic cut for native and mesh bodies, outward restore, cavity rejection, floor/other-body hits and zero offset');
