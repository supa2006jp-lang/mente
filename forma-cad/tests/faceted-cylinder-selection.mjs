import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,rebuild} from '../src/geometry.js';
import {cadFaceGroup,cadFaceKey,cadFaceGeometry,cadFaceSelections,isFaceSelected} from '../src/face-selection.js';
import {selectionCandidates,faceCandidateKey} from '../src/selection-candidates.js';
import {cylindricalSelection} from '../src/cylindrical-selection.js';
import {selectedCadFaces} from '../src/face-pull.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function polygonWire(radius,z,reverse=false){let points=Array.from({length:128},(_,i)=>[radius*Math.cos(i*Math.PI/64),radius*Math.sin(i*Math.PI/64),z]);if(reverse)points.reverse();const edges=points.map((p,i)=>R.makeLine(p,points[(i+1)%points.length]));try{return R.assembleWire(edges);}finally{edges.forEach(e=>e.delete());}}
function legacyCylinder(z,height,inner){const outer=polygonWire(35,z),hole=inner?polygonWire(inner,z,true):null,face=R.makeFace(outer,hole?[hole]:[]),vector=new R.Vector([0,0,height]);try{return R.basicFaceExtrusion(face,vector);}finally{outer.delete();hole?.delete();face.delete();vector.delete();}}
const base=legacyCylinder(0,2),wall=legacyCylinder(2,20,32),joined=base.fuse(wall),tool=R.makeBox([-45,-45,2],[45,0,27]),shape=joined.cut(tool);
const features=[{...defaults,kind:'extrusion',id:'base',name:'底板',profile:'circle',diameter:70,depth:2},{...defaults,kind:'extrusion',id:'wall',name:'半円壁',profile:'circle',diameter:70,depth:20,z:2,mode:'thin',wall:3,operation:'join',target:'base'},{...defaults,kind:'extrusion',id:'cut',name:'半分を切り取り',width:90,height:45,y:-22.5,z:2,depth:25,operation:'cut',target:'base',cadResult:{outputs:[{id:'base',...shape.mesh({tolerance:.08,angularTolerance:.15}),planarFaces:shape.faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep:shape.serialize()}],remove:[]}}];
const mesh=rebuild(features).get('base');mesh.userData.bodyId='base';const g=mesh.geometry;
function hit(origin,direction){const h=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(mesh)[0];assert.ok(h);return h;}
const outerHit=hit([50,0,1],[-1,0,0]),outerGroup=cadFaceGroup(g,outerHit.faceIndex),innerHit=hit([0,0,10],[0,1,0]),innerGroup=cadFaceGroup(g,innerHit.faceIndex);
assert.ok(outerGroup.parts.length>100,'whole connected outer side includes low base and tall half wall');
assert.ok(innerGroup.parts.length>50,'half inner side is one selection');
assert.equal(outerGroup.cylinder.radius,35);assert.equal(outerGroup.cylinder.internal,false);assert.equal(innerGroup.cylinder.radius,32);assert.equal(innerGroup.cylinder.internal,true);
assert.notEqual(cadFaceKey('base',outerGroup),cadFaceKey('base',innerGroup));
const keys=new Set();for(const part of outerGroup.parts)keys.add(cadFaceKey('base',cadFaceGroup(g,part.start/3)));assert.equal(keys.size,1,'every outer strip uses the same selection key');
const curved=cylindricalSelection(features,'base',g,outerHit.faceIndex,outerHit.point),highlight=cadFaceGeometry(g,outerGroup);assert.equal(curved.geometry.attributes.position.count,highlight.attributes.position.count);
const entries=[{key:cadFaceKey('base',outerGroup),bodyId:'base',geometry:highlight}];assert.ok(isFaceSelected(entries,outerHit));assert.ok(!isFaceSelected(entries,innerHit));
assert.equal(faceCandidateKey(outerHit,features),entries[0].key);
const candidates=selectionCandidates([outerHit,innerHit],[],{mode:'face',features});assert.equal(candidates.length,2);assert.ok(candidates.every(c=>c.label.startsWith('曲面')),'faceted sides must not offer planar centers');
const cap=hit([0,-15,30],[0,0,-1]);assert.equal(cadFaceGroup(g,cap.faceIndex).cylinder,undefined);assert.equal(cylindricalSelection(features,'base',g,cap.faceIndex,cap.point),null);
const selections=cadFaceSelections(g,outerGroup);assert.equal(selections.length,outerGroup.parts.length);const faces=selectedCadFaces(shape,selections);assert.equal(faces.length,outerGroup.parts.length,'editing receives all selected CAD patches');faces.forEach(f=>f.delete());
// A disconnected copy on the same axis must remain independent.
const data=features.at(-1).cadResult.outputs[0],count=data.vertices.length/3,copy=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([...data.vertices,...data.vertices.map((v,i)=>i%3===2?v+40:v)],3)).setIndex([...data.triangles,...data.triangles.map(i=>i+count)]);
copy.userData={faceGroups:[...data.faceGroups,...data.faceGroups.map(p=>({...p,start:p.start+data.triangles.length,faceId:p.faceId+1000000000}))],planarFaces:[...data.planarFaces,...data.planarFaces.map(id=>id+1000000000)],circularWalls:[...g.userData.circularWalls,...g.userData.circularWalls.map(h=>({...h,origin:h.origin.clone().add(new THREE.Vector3(0,0,40))}))]};
assert.equal(cadFaceGroup(copy,outerHit.faceIndex).parts.length,outerGroup.parts.length);
assert.notEqual(cadFaceKey('base',cadFaceGroup(copy,outerHit.faceIndex)),cadFaceKey('base',cadFaceGroup(copy,outerHit.faceIndex+data.triangles.length/3)));
copy.dispose();curved.geometry.dispose();highlight.dispose();g.dispose();
const narrow=new THREE.CylinderGeometry(35,35,10,4,1,false,0,Math.PI/32);narrow.userData.faceGroups=narrow.groups.map((p,i)=>({...p,faceId:i}));narrow.userData.planarFaces=[1,2];assert.ok(Math.abs(cadFaceGroup(narrow,0).cylinder.radius-35)<.001,'short true cylindrical arcs remain curved');narrow.dispose();
const noRecipe=rebuild(features).get('base').geometry;delete noRecipe.userData.circularWalls;assert.ok(cadFaceGroup(noRecipe,outerHit.faceIndex).cylinder,'matching circular rims recover saved solids without a circular recipe');noRecipe.dispose();
await fs.mkdir('outputs/cylinder-selection',{recursive:true});await fs.writeFile('outputs/cylinder-selection/legacy-half-cylinder.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));
for(const resource of [base,wall,joined,tool,shape])resource.delete();
console.log('PASS legacy faceted half cylinder: continuous outer/inner side, stable keys, curved candidates, planar caps, full editing selection and disconnected guards');
