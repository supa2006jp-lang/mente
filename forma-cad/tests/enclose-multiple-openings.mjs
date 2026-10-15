import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseBody} from '../src/enclose.js';
import {enclosureSelectionHits} from '../src/enclosure-selection.js';
import {cadFaceGroup,cadFaceKey} from '../src/face-selection.js';
import {cadMesh} from '../src/cad-mesh.js';
import {retainCadCoordinates} from '../src/cad-coordinates.js';
import {runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=R.makeBox([0,0,0],[30,20,40]),brep=source.serialize();
const top={bodyId:'source',point:[15,10,40],normal:[0,0,1]},front={bodyId:'source',point:[15,0,20],normal:[0,-1,0]},bottom={bodyId:'source',point:[15,10,0],normal:[0,0,-1]};
const valid=s=>{const check=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}};
const openingEmpty=(s,lo,hi)=>{const probe=R.makeBox(lo,hi),overlap=s.intersect(probe);try{assert.ok(Math.abs(R.measureVolume(overlap))<1e-5);}finally{overlap.delete();probe.delete();}};
for(const boxMode of [false,true])for(const roundedCorners of [false,true])for(const faces of [[top,front],[top,bottom],[top,front,bottom]]){
 const shell=encloseBody(source,3,{clearance:.4,boxMode,roundedCorners,faces});
 valid(shell);openingEmpty(shell,[5,5,39],[25,15,45]);
 if(faces.includes(front))openingEmpty(shell,[5,-5,5],[25,1,35]);
 if(faces.includes(bottom))openingEmpty(shell,[5,5,-5],[25,15,1]);
 const reread=R.deserializeShape(shell.serialize()).asShape3D();valid(reread);reread.delete();shell.delete();
}
assert.equal(source.serialize(),brep,'source geometry unchanged');
const meshData=cadMesh(source,{tolerance:.08,angularTolerance:.15}),geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute(meshData.vertices,3));geometry.setIndex(meshData.triangles);geometry.userData.faceGroups=meshData.faceGroups;retainCadCoordinates(geometry,meshData.vertices);
const mesh=new THREE.Mesh(geometry);mesh.userData.bodyId='source';
const hits=enclosureSelectionHits(mesh,[top,front,bottom]);assert.equal(hits.length,3);
assert.equal(new Set(hits.map(hit=>cadFaceKey('source',cadFaceGroup(geometry,hit.faceIndex)))).size,3,'saved openings restore distinct face selections');
assert.equal(enclosureSelectionHits(mesh,[{...top,bodyId:'other'},{...top,point:[500,500,500]}]).length,0,'do not restore picks on another body or far from a face');
const features=[{kind:'cadop',id:'seed',outputs:[{id:'source',brep}],remove:[]}],spec={type:'enclose',id:'shell',target:'source',thickness:3,clearance:.4,faces:[top,front,bottom],boxMode:true};
const result=runOperation(features,spec);assert.equal(result.outputs.length,1);assert.deepEqual(result.remove,[]);
const saved=JSON.parse(JSON.stringify([...features,{kind:'cadop',id:'shell',spec,...result}]));
const edited=runOperation(saved.slice(0,-1),{...saved.at(-1).spec,faces:saved.at(-1).spec.faces.filter(face=>face.normal[2]!==-1)});
const reread=R.deserializeShape(edited.outputs[0].brep).asShape3D();valid(reread);openingEmpty(reread,[5,-5,5],[25,1,35]);
const restoredBottom=R.makeBox([5,5,-3],[25,15,-1]),overlap=reread.intersect(restoredBottom);assert.ok(R.measureVolume(overlap)>0,'removed opening becomes a wall again');
overlap.delete();restoredBottom.delete();reread.delete();geometry.dispose();mesh.material.dispose();source.delete();
console.log('PASS 2/3 openings, adjacent/opposite faces, BOX/model-following, rounded/sharp, saved selection restoration and add/remove roundtrip, unchanged source');
