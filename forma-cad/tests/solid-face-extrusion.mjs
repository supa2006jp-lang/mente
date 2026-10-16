import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {planarFace} from '../src/frames.js';
import {faceExtrusionRegions,regionExtrusions} from '../src/region-extrusions.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function seed(shapes){return [{id:'seed',name:'テスト用ソリッド',kind:'cadop',outputs:shapes.map(([id,shape])=>({id,brep:shape.serialize(),...shape.mesh()})),remove:[]}];}
function entry(shape,bodyId,normal){
 const mesh=shape.mesh(),g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float64Array(mesh.vertices),3));g.setIndex(mesh.triangles);
 try{for(let i=0;i<mesh.triangles.length;i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,mesh.triangles[i+j])),n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();if(n.distanceTo(new THREE.Vector3(...normal))>1e-6)continue;const point=points[0].add(points[1]).add(points[2]).multiplyScalar(1/3).toArray(),plane={...planarFace(g,i/3),bodyId,cadFace:{bodyId,point,normal}};return {key:bodyId+normal.join(','),bodyId,plane};}throw Error('face missing');}finally{g.dispose();}
}
function batch(entries,depth,operation='join') {return regionExtrusions({...defaults,profile:'region',kind:'extrusion',name:'押し出し',depth,operation,target:entries[0].bodyId,targetAllBodies:operation!=='new'},faceExtrusionRegions(entries));}
function check(features,expected){const bodies=kernelBodies(features);try{assert.equal(bodies.size,Object.keys(expected).length);for(const [id,volume]of Object.entries(expected)){const shape=bodies.get(id),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(Math.abs(R.measureVolume(shape)-volume)<1e-5,`${id}: ${R.measureVolume(shape)} != ${volume}`);}finally{check.delete();solids.forEach(s=>s.delete());}}}finally{for(const b of bodies.values())b.delete();}}
const a=R.makeBox([0,0,0],[10,10,10]),b=R.makeBox([30,0,0],[40,10,20]),base=seed([['a',a],['b',b]]),snapshot=JSON.stringify(base);
const top=entry(a,'a',[0,0,1]),side=entry(a,'a',[1,0,0]),other=entry(b,'b',[0,0,1]);
assert.throws(()=>faceExtrusionRegions([top,{bodyId:'a',plane:null}]),/曲面/,'mixed curved selections must not be silently reduced');assert.equal(top.plane.bodyId,'a');
const different=runOperation(base,{type:'extrusionBatch',features:batch([top,other],3)}).features;check([...base,...different],{a:1300,b:2300});
const adjacent=runOperation(base,{type:'extrusionBatch',features:batch([top,side],3)}).features;check([...base,...adjacent],{a:1600,b:2000});assert.equal(adjacent[1].faceBatch,adjacent[0].id);
const cut=runOperation(base,{type:'extrusionBatch',features:batch([top,side],-2,'cut')}).features;check([...base,...cut],{a:640,b:2000});
const newBodies=runOperation(base,{type:'extrusionBatch',features:batch([top,other],3,'new')}).features;check([...base,...newBodies],{a:1000,b:2000,[newBodies[0].id]:300,[newBodies[1].id]:300});
const saved={format:'forma-cad',version:1,features:JSON.parse(JSON.stringify([...base,...adjacent]))};validateProject(saved);check(saved.features,{a:1600,b:2000});
const proposed=structuredClone(saved.features);proposed.slice(-2).forEach(f=>{f.depth=4;});const replay=runOperation(proposed,{type:'replay',before:saved.features,start:base.length}).features;check(replay,{a:1800,b:2000});
const neighbour=R.makeBox([13,0,0],[23,10,10]),near=seed([['a',a],['neighbour',neighbour]]),merged=runOperation(near,{type:'extrusionBatch',features:batch([side,entry(neighbour,'neighbour',[0,0,1])],3)}).features;
assert.deepEqual(merged[0].cadResult.remove,['neighbour']);check([...near,...merged],{a:2600});
const cylinder=R.makeCylinder(2,10,[5,5,0]),ring=a.cut(cylinder),hole=seed([['ring',ring],['b',b]]),holed=runOperation(hole,{type:'extrusionBatch',features:batch([entry(ring,'ring',[0,0,1]),other],3)}).features;check([...hole,...holed],{ring:(100-Math.PI*4)*13,b:2300});
assert.equal(JSON.stringify(base),snapshot,'native batch calculations preserve input history');
await fs.writeFile('.sites-runtime/solid-face-extrusion-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:base}));
for(const shape of [a,b,neighbour,ring,cylinder])shape.delete();
console.log('PASS multiple bodies, adjacent face snapshot, per-face normals, cut, separate new bodies, merged source IDs, holes, save/replay and input preservation');
