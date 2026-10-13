import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,rebuild,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {runOperation} from '../src/kernel.js';
import {cadFaceGroup,cadFaceKey,cadFaceGeometry,cadFaceSelections,isFaceSelected} from '../src/face-selection.js';
import {cylindricalSelection} from '../src/cylindrical-selection.js';
import {selectionCandidates} from '../src/selection-candidates.js';
import {selectedCadFaces} from '../src/face-pull.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const sketches=[{...defaults,id:'circle',name:'円',kind:'sketch',profile:'circle',diameter:60,groupHidden:true},{...defaults,id:'divider',name:'直径線',kind:'sketch',profile:'line',mode:'thin',width:80,groupHidden:true}];
const region=findRegions(sketches).find(r=>r.outer.some(p=>p[1]>29));
const feature={...defaults,id:'half',name:'半円の押し出し',kind:'extrusion',profile:'region',region,depth:30};
feature.cadResult=runOperation(sketches,{type:'extrusion',feature});
const source=[...sketches,feature];
function check(features,id,origin,direction){
 const mesh=rebuild(features).get(id);mesh.userData.bodyId=id;const geometry=mesh.geometry;
 assert.equal(geometry.userData.circularWalls.length,0,'a semicircle has no full-circle recipe');
 const hit=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(mesh)[0];assert.ok(hit);
 const group=cadFaceGroup(geometry,hit.faceIndex);assert.ok(group.cylinder,'a single hit recovers the cylindrical side');assert.ok(Math.abs(group.cylinder.radius-30)<.001);assert.equal(group.cylinder.internal,false);assert.equal(group.parts.length,64,'all 64 chord faces belong to one curved side');
 const key=cadFaceKey(id,group),highlight=cadFaceGeometry(geometry,group),entry={key,bodyId:id,geometry:highlight};
 for(const part of group.parts){const g=cadFaceGroup(geometry,part.start/3);assert.equal(cadFaceKey(id,g),key);assert.ok(isFaceSelected([entry],{object:mesh,faceIndex:part.start/3}));}
 assert.equal(selectionCandidates([hit],[],{mode:'face',features})[0].label.split(' — ')[0],'曲面');
 const curved=cylindricalSelection(features,id,geometry,hit.faceIndex,hit.point);assert.equal(curved.geometry.attributes.position.count,highlight.attributes.position.count);
 const solid=R.deserializeShape(features.at(-1).cadResult?.outputs[0].brep||features.at(-1).outputs[0].brep).asShape3D(),faces=selectedCadFaces(solid,cadFaceSelections(geometry,group));assert.equal(faces.length,64);faces.forEach(f=>f.delete());solid.delete();
 const planes=geometry.userData.faceGroups.filter(p=>!group.parts.includes(p));assert.equal(planes.length,3,'top, bottom and flat closing wall remain separate');for(const part of planes)assert.equal(cadFaceGroup(geometry,part.start/3).cylinder,undefined);
 highlight.dispose();curved.geometry.dispose();geometry.dispose();
}
check(source,'half',[0,50,15],[0,-1,0]);
check(validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:source}))),'half',[20,50,15],[0,-1,0]);
const spec={type:'move',target:'half',x:70,y:10,z:25,rotation:[35,0,20],pivot:[0,0,0]},moved=runOperation(source,spec),transform=new THREE.Matrix4().makeRotationX(35*Math.PI/180).premultiply(new THREE.Matrix4().makeRotationZ(20*Math.PI/180)),origin=new THREE.Vector3(0,50,15).applyMatrix4(transform).add(new THREE.Vector3(70,10,25)),direction=new THREE.Vector3(0,-1,0).transformDirection(transform);
check([...source,{kind:'cadop',id:'move',name:'移動',spec,...moved}],'half',origin.toArray(),direction.toArray());
const imported=[{kind:'cadop',id:'import',name:'インポート',outputs:feature.cadResult.outputs,remove:[]}];check(imported,'half',[0,50,15],[0,-1,0]);
// Elliptical and coarse polygon walls must not be merged into cylinders.
for(const profile of ['ellipse','hexagon']){
 const n=profile==='ellipse'?128:6,points=Array.from({length:n},(_,i)=>[30*Math.cos(i*2*Math.PI/n)*(profile==='ellipse'?1.5:1),30*Math.sin(i*2*Math.PI/n)]),f={...defaults,id:'guard',name:profile,kind:'extrusion',profile:'polyline',points,closed:true,depth:30};f.cadResult=runOperation([],{type:'extrusion',feature:f});const geometry=rebuild([f]).get('guard').geometry;
 for(const part of geometry.userData.faceGroups)assert.equal(cadFaceGroup(geometry,part.start/3).cylinder,undefined,profile+' remains separate');geometry.dispose();
}
await fs.mkdir('outputs/cylinder-selection',{recursive:true});await fs.writeFile('outputs/cylinder-selection/semicircle-extrusion.forma.json',JSON.stringify({format:'forma-cad',version:1,features:source}));
console.log('PASS single-click semicircle selection: 64 facets become one curved face, separate planes, save/reload, moved/imported solids, full edit references and ellipse/polygon guards');
