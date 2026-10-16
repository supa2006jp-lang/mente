import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {sectionBasis,sectionFaceOrientation,sectionSplitSpec,sectionCenter,sectionBodyStyles} from '../src/section-split.js';
import {sectionSegments,sectionCap} from '../src/section-view.js';
import {runOperation} from '../src/kernel.js';
import {validateProject} from '../src/geometry.js';
import {splitDisplayOffsets} from '../src/body-display.js';

const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
for(const plane of ['XY','XZ','YZ']){
 assert.equal(sectionFaceOrientation({plane}).plane,plane);
 const {u,v,n}=sectionBasis(plane),reverse={u:u.toArray(),v:v.negate().toArray(),n:n.negate().toArray()};
 assert.equal(sectionFaceOrientation({frame:reverse}).plane,plane);
}
assert.equal(sectionFaceOrientation(null),null);
assert.throws(()=>sectionBasis('CUSTOM',{u:[1,0,0],v:[0,1,0],n:[0,0,2]}),/平面/);
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const rotation=new THREE.Matrix4().makeRotationY(35*Math.PI/180),frame=Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3(...[[1,0,0],[0,1,0],[0,0,1]][i]).transformDirection(rotation).toArray()]));
assert.equal(sectionFaceOrientation({frame}).plane,'CUSTOM');
const source=R.makeBox([-10,-8,-6],[10,8,6]).rotate(35,[0,0,0],[0,1,0]).translate([55,0,12]),axis=R.makeBox([-15,-10,0],[15,10,20]);
const output=(id,shape)=>({id,...shape.mesh({tolerance:.08,angularTolerance:.15}),planarFaces:shape.faces.map(f=>{try{return f.hashCode;}finally{f.delete();}}),brep:shape.serialize()});
const seed={kind:'cadop',id:'seed',name:'断面方向テスト',remove:[],outputs:[output('axis',axis),output('tilted',source)]},features=[seed],original=JSON.stringify(features);
const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float64Array(seed.outputs[1].vertices),3)).setIndex(seed.outputs[1].triangles),mesh=new THREE.Mesh(g),n=new THREE.Vector3(...frame.n),center=sectionCenter(mesh,'CUSTOM',frame);
near(center,n.dot(new THREE.Vector3(55,0,12)));
const plane=new THREE.Plane(n,-center),segments=sectionSegments(g,plane),cap=sectionCap(segments,plane,{precision:true});assert.ok(cap.attributes.position.count);for(const value of Array.from({length:cap.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(cap.attributes.position,i)))near(plane.distanceToPoint(value),0);cap.dispose();
for(const keep of ['both','positive','negative']){
 const spec=sectionSplitSpec({target:'tilted',plane:'CUSTOM',frame,offset:center,keep},mesh,'split'),result=runOperation(features,spec);
 assert.equal(result.outputs.length,keep==='both'?2:1);let volume=0;
 for(const o of result.outputs){const shape=R.deserializeShape(o.brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());volume+=R.measureVolume(shape);const dots=o.vertices.reduce((a,_,i)=>i%3?a:[...a,new THREE.Vector3(...o.vertices.slice(i,i+3)).dot(n)],[]);if(keep==='positive'||o.id==='split')near(Math.min(...dots),center,1e-4);else near(Math.max(...dots),center,1e-4);}finally{check.delete();shape.delete();}}
 near(volume,keep==='both'?3840:1920,1e-3);
 const document={format:'forma-cad',version:1,features:[seed,{kind:'cadop',id:'split',name:'断面で分離',spec,...result}]};validateProject(JSON.parse(JSON.stringify(document)));
 assert.ok(sectionBodyStyles(document.features).get('tilted'));
 if(keep==='both'){const offsets=splitDisplayOffsets(document.features);near(offsets.get('split').dot(n),10);near(offsets.get('tilted').dot(n),-10);const updated=structuredClone(document.features);updated[1].spec.offset=center+1;const replay=runOperation(updated,{type:'replay',before:document.features,start:1}).features;near(replay[1].spec.offset,center+1);}
}
// Exact projections reject planes outside the rotated shape, inside its AABB.
assert.throws(()=>sectionSplitSpec({target:'tilted',plane:'CUSTOM',frame,offset:center+6.1},mesh),/内部/);
mesh.position.set(0,0,10);near(sectionCenter(mesh,'CUSTOM',frame),center+10*n.z);assert.doesNotThrow(()=>sectionSplitSpec({target:'tilted',plane:'CUSTOM',frame,offset:center+10*n.z},mesh));
for(const plane of ['XY','XZ','YZ']){const box=new THREE.Mesh(new THREE.BoxGeometry(20,16,12));near(sectionCenter(box,plane),0);assert.doesNotThrow(()=>sectionSplitSpec({target:'box',plane,offset:0},box));box.geometry.dispose();}
assert.equal(JSON.stringify(features),original);await fs.writeFile('.sites-runtime/section-selected-face-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));g.dispose();source.delete();axis.delete();
console.log('PASS selected XYZ/reversed/slanted orientations, central offset, section caps, exact custom-plane split and keep sides, save/replay, colors/explode, projected bounds and unchanged model');
