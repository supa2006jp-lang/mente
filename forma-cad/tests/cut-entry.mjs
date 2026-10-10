import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {basisFor} from '../src/frames.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const angle=-20.0648326878*Math.PI/180;
const frame={u:[Math.cos(angle),0,-Math.sin(angle)],v:[0,1,0],n:[Math.sin(angle),0,Math.cos(angle)]};
const rounded={u:[.9393050070381455,0,.34308323152417347],v:[0,1,0],n:[-.34308323152417347,0,.9393050070381455]};
const body={...defaults,id:'body',name:'rotated body',kind:'extrusion',plane:'CUSTOM',frame,width:50,height:50,depth:15};
const far={...defaults,id:'far',name:'unaffected body',kind:'extrusion',width:10,height:10,depth:10,x:100};
const n=new THREE.Vector3(...frame.n),origin=n.clone().multiplyScalar(15).addScaledVector(new THREE.Vector3(...rounded.n),-3e-7);
const cut={...defaults,id:'cut',name:'surface cut',kind:'extrusion',profile:'circle',plane:'CUSTOM',frame:rounded,x:origin.x,y:origin.y,z:origin.z,diameter:40,depth:-8.86,operation:'cut',target:'far',targetAllBodies:true};
function rayDepths(output,feature,du=0,dv=0){
 const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3)).setIndex(output.triangles),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,material);
 const b=basisFor(feature),p=new THREE.Vector3(feature.x,feature.y,feature.z).addScaledVector(b.u,du).addScaledVector(b.v,dv);
 mesh.updateMatrixWorld(true);
 try{return new THREE.Raycaster(p.clone().addScaledVector(b.n,20),b.n.clone().negate(),0,100).intersectObject(mesh).map(h=>h.point.clone().sub(p).dot(b.n));}
 finally{g.dispose();material.dispose();}
}
for(const feature of [cut,{...cut,depth:-25,throughAll:true},{...cut,profile:'rect',width:20,height:20},{...cut,taperAngle:10}]){
 const result=runOperation([far,body],{type:'extrusionBatch',features:[feature]}).features[0];
 assert.deepEqual(result.cadResult.outputs.map(o=>o.id),['body']);
 for(const [u,v] of [[0,0],[5,0],[-5,0],[0,5],[0,-5]]){
  const hits=rayDepths(result.cadResult.outputs[0],feature,u,v);
  if(feature.throughAll)assert.equal(hits.length,0,'Through hole must have an open entrance and exit');
  else {assert.ok(hits.length>0);assert.ok(Math.abs(hits[0]+8.86)<1e-4,'No roof at cut entry; blind floor retains the requested depth: '+hits);}
 }
 const shape=R.deserializeShape(result.cadResult.outputs[0].brep).asShape3D(),valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{assert.ok(valid.IsValid());}finally{valid.delete();shape.delete();}
}
// Outward cuts must not become tiny inward cuts due to the entry extension.
const outward={...cut,frame,x:n.x*15,y:0,z:n.z*15,depth:8.86};
assert.throws(()=>runOperation([far,body],{type:'extrusionBatch',features:[outward]}),/重なっていません/);
// Deliberate internal cavities must retain their original upper wall.
const inside={...cut,x:n.x*10,y:0,z:n.z*10,diameter:10,depth:-3};
const internal=runOperation([far,body],{type:'extrusionBatch',features:[inside]}).features[0];
assert.ok(Math.abs(rayDepths(internal.cadResult.outputs[0],inside)[0]-5)<1e-4);
await fs.writeFile('.sites-runtime/cut-entry-fixture.json',JSON.stringify({format:'forma-cad',version:1,features:[far,body,{...cut,id:'sketch',name:'circle',kind:'sketch',operation:'new',groupId:'circle-group',groupNumber:1,groupHidden:false,depth:2,targetAllBodies:false}]}));
console.log('PASS rotated Float32 surface entry, blind/through/rectangle/tapered cuts, preserved floor, all-target selection, outward rejection and intentional internal cavities');

