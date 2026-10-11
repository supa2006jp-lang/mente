import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {ballJointDefaults,ballJointSavedDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
const info={radius:12,height:40},expected=ballJointDefaults(info);
for(const height of [1,10,25,40,60,100]){
 const i={...info,height},p=ballJointDefaults(i),s=ballJointSettings(i,p);
 for(const k of ['ballDiameter','neckDiameter','wall','threadPitch'])assert.equal(p[k],expected[k],k+' is independent of cylinder height');
 assert.ok(s.ballBaseHeight>=2-1e-7&&s.socketBaseHeight>=2-1e-7);
 assert.equal(s.ballBaseStart,-s.baseExtensions.ball||0);
 assert.equal(s.socketBaseEnd,height+s.baseExtensions.socket);
 if(height<25)assert.ok(s.baseExtensions.ball>0&&s.baseExtensions.socket>0);
}
assert.equal(expected.ballDiameter,15.6);assert.equal(expected.neckDiameter,6.24);
assert.equal(ballJointDefaults({radius:15,height:40}).ballDiameter,19.5);
assert.equal(ballJointSettings(info,{}).ballDiameter,14.4);
assert.equal(ballJointSettings(info,{}).autoExtend,false);
assert.equal(ballJointSavedDefaults(info).neckDiameter,5.76);
assert.throws(()=>ballJointSettings({...info,height:10},{...ballJointDefaults({...info,height:10}),autoExtend:false}),/長さが足りません/);
assert.throws(()=>ballJointSettings(info,{...expected,autoExtend:'yes'}),/自動延長/);
console.log('PASS diameter-only defaults, both free-end extensions, opt-out and legacy dimensions');
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function sizes(shape){const faces=shape.faces,spheres=[],rods=[];try{for(const face of faces){if(!['SPHERE','CYLINDRE'].includes(face.geomType))continue;const surface=face.surface,a=face.geomType==='SPHERE'?surface.wrapped.Sphere():surface.wrapped.Cylinder();try{(face.geomType==='SPHERE'?spheres:rods).push(a.Radius()*2);}finally{a.delete();surface.delete();}}return {sphere:Math.max(...spheres),rods};}finally{faces.forEach(f=>f.delete());}}
for(const [height,bent,tilt] of [[40,false,false],[10,true,false],[1,true,true]]){
 const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:height},p={...ballJointDefaults({...info,height}),type:'ballJoint',id:'joint',target:'c',pose:'print',neckBend:bent,neckBaseTilt:tilt,neckExtension:bent?15:0};
 const result=runOperation([source],p),settings=ballJointSettings({...info,height},p);
 assert.ok(result.analysis.overlap.every(v=>v<1e-5));
 for(const [i,output]of result.outputs.entries()){const shape=R.deserializeShape(output.brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));assert.ok(Math.abs(output.vertices.reduce((m,v,j)=>j%3===2?Math.min(m,v):m,Infinity))<1e-5);if(!i){const a=sizes(shape);assert.ok(Math.abs(a.sphere-expected.ballDiameter)<1e-7);assert.ok(a.rods.some(d=>Math.abs(d-expected.neckDiameter)<1e-7));}}finally{solids.forEach(s=>s.delete());check.delete();shape.delete();}}
 const feature={kind:'cadop',name:'ボール接合',id:'joint',spec:p,...result},history=[source,feature];validateProject({format:'forma-cad',version:1,features:history});
 const replay=runOperation(history,{type:'replay',before:history,start:1});assert.deepEqual(replay.features[1].analysis.baseExtensions,result.analysis.baseExtensions);assert.equal(replay.features[1].analysis.ballDiameter,expected.ballDiameter);
 assert.deepEqual(ballJointSettings({...info,height},p).baseExtensions,settings.baseExtensions,'recomputation must not accumulate growth');
 console.log('PASS real CAD radius, complete single solids, bed placement and replay', {height,bent,tilt,extensions:result.analysis.baseExtensions});
}
