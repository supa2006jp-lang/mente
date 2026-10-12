import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,validateFeature,validateProject} from '../src/geometry.js';
import {featureSolid,runOperation,kernelBodies} from '../src/kernel.js';
import {clearBodyCache} from '../src/body-cache.js';
import {basisFor} from '../src/frames.js';
import {batchExtrusionFeature} from '../src/extrusion-targets.js';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {binaryStlReport} from './stl-topology.mjs';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'cylinder',name:'円柱',kind:'extrusion',profile:'circle',diameter:20,depth:10};
const region={id:'triangle',plane:'XY',offset:10,outer:[[0,0],[30,0],[30,30]],holes:[],sourceIds:[],area:450};
const f={...defaults,id:'extension',name:'重なる部分',kind:'extrusion',profile:'region',region,z:10,depth:4,operation:'new',overlapOnly:true,overlapTargets:['cylinder']};
const close=(a,b)=>assert.ok(Math.abs(a-b)<.002,`${a} != ${b}`);
function inspect(shape,expected){
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{assert.ok(check.IsValid());close(R.measureVolume(shape),expected);}finally{check.delete();}
 const box=shape.boundingBox;try{assert.ok(box.bounds[1][0]<=10.00001&&box.bounds[1][1]<=10.00001,'no overhang beyond actual circle');}finally{box.delete();}
}
function manifold(shape){
 const mesh=shape.mesh({tolerance:.02,angularTolerance:.1}),g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3));g.setIndex(mesh.triangles);
 try{const report=binaryStlReport(new STLExporter().parse(new THREE.Mesh(g),{binary:true}));assert.equal(report.boundary,0);assert.equal(report.nonmanifold,0);assert.equal(report.orientation,0);}finally{g.dispose();}
}
const sector=Math.PI*100/8;
for(const operation of ['new','join','cut']){
 const item={...f,operation,target:'cylinder',depth:operation==='cut'?-4:4};validateFeature(item);
 const result=runOperation([base],{type:'extrusion',target:item.target,feature:item});
 const shape=R.deserializeShape(result.outputs[0].brep).asShape3D();
 try{inspect(shape,operation==='new'?sector*4:Math.PI*100*10+(operation==='cut'?-1:1)*sector*4);manifold(shape);}finally{shape.delete();}
}
// Reverse and symmetric distances use the same section, not a projected outline.
const bodies=kernelBodies([base]);
try{
 for(const extra of [{depth:-4},{depth:4,symmetric:true}]){
  const shape=featureSolid({...f,...extra},bodies);try{inspect(shape,sector*4*(extra.symmetric?2:1));}finally{shape.delete();}
 }
 // CAD holes remain empty and an unrelated body away from this plane is ignored.
 const bore={...defaults,id:'bore',kind:'extrusion',profile:'circle',diameter:8,z:0,depth:10,operation:'cut',target:'cylinder'};
 const holed=kernelBodies([base,bore]);try{const shape=featureSolid(f,holed);try{inspect(shape,Math.PI*(100-16)/8*4);}finally{shape.delete();}}finally{for(const body of holed.values())body.delete();}
 const away={...f,region:{...region,offset:20},z:20};assert.throws(()=>featureSolid(away,bodies),/重なる部分がありません/);
 assert.throws(()=>featureSolid({...f,overlapTargets:['missing']},bodies),/見つかりません/);
}finally{for(const body of bodies.values())body.delete();}
// The construction plane controls the section in every orientation, including
// a true interior section through the source, rather than an existing end face.
for(const frame of [{plane:'XZ'},{plane:'YZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}]){
 const n=basisFor(frame).n,parts=kernelBodies([{...base,...frame}]);
 try{for(const offset of [5,10]){
  const item={...f,...frame,x:n.x*offset,y:n.y*offset,z:n.z*offset,region:{...region,...frame,offset}};
  const shape=featureSolid(item,parts);try{close(R.measureVolume(shape),sector*4);manifold(shape);}finally{shape.delete();}
 }}finally{for(const part of parts.values())part.delete();}
}
// A new extrusion keeps its dependency during batch execution, save/reload and replay.
const clipped=runOperation([base],{type:'extrusionBatch',features:[f]}).features[0];
const saved=JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[base,clipped]}));validateProject(saved);
assert.throws(()=>validateProject({...saved,features:[base,{...clipped,overlapTargets:['missing']}]}),/参照/);
const changed=[base,{...clipped,depth:6}],replayed=runOperation(changed,{type:'replay',before:saved.features,start:1}).features;
const output=kernelBodies(replayed);try{inspect(output.get(f.id),sector*6);}finally{for(const body of output.values())body.delete();}
// Cached new bodies must invalidate when their overlap source changes.
for(const diameter of [16,20]){const result=kernelBodies([{...base,diameter},f]);try{inspect(result.get(f.id),Math.PI*(diameter/2)**2/8*4);}finally{for(const body of result.values())body.delete();}}
for(const extra of [{overlapOnly:'true'},{overlapTargets:[]},{overlapTargets:['a','a']},{mode:'thin'}])assert.throws(()=>validateFeature({...f,...extra}));
assert.deepEqual(batchExtrusionFeature({...f,overlapTargets:['cylinder','other']},[{operation:'join',cadResult:{remove:['other'],outputs:[{id:'cylinder'}]}}]).overlapTargets,['cylinder']);
clearBodyCache();
console.log('PASS exact circular overlap, outward join/new and inward cut, holes, signed/symmetric distance, empty/missing target, batch, save/reload, replay and cache dependencies');
