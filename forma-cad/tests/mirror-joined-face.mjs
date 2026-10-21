import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies,featureSolid} from '../src/kernel.js';
import {defaults,rebuild,validateProject} from '../src/geometry.js';
import {cadFaceGroup,cadFaceGeometry} from '../src/face-selection.js';
import {selectedConnectedPlanarFace} from '../src/cad-planar-face.js';
import {planarFace} from '../src/frames.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const out='outputs/mirror-joined-face/';await fs.mkdir(out,{recursive:true});
const outer=[[0,0],[30,0],[30,40],[20,40],[20,15],[0,15]],area=1400;
const right={...defaults,kind:'extrusion',profile:'region',id:'right',name:'右半分',depth:10,region:{id:'half-u',plane:'XY',offset:0,outer,holes:[],area:area/2,sourceIds:[]}};
function mirrorJoin(features,target){const ms={type:'mirror',id:'left',target,plane:'YZ',offset:0,mirrorMode:'複製'},m={kind:'cadop',id:'left',name:'左半分をミラー',spec:ms,...runOperation(features,ms)},js={type:'join',id:'joined',target,others:['left'],combineMode:'結合'},f=[...features,m],join={kind:'cadop',id:'joined',name:'左右を結合',spec:js,...runOperation(f,js)};return [...f,join];}
const features=mirrorJoin([right],'right'),document={format:'forma-cad',version:1,units:'mm',features};validateProject(document);await fs.writeFile(out+'fixture.forma.json',JSON.stringify(document));
const bodies=kernelBodies(features),body=bodies.get('right'),geo=rebuild(features).get('right').geometry;
let topTriangles=[];const p=geo.attributes.position,ix=geo.index;
for(let i=0;i<ix.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+2)),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(n.z>.9999&&Math.abs(a.z-10)<1e-6)topTriangles.push(i/3);}
const groups=new Set(topTriangles.map(i=>cadFaceGroup(geo,i)));assert.equal(groups.size,1,'either half must map to the same selectable plane');const group=[...groups][0];assert.equal(group.parts.length,2,'fixture must retain its original native mirror seam');
const highlight=cadFaceGeometry(geo,group),triangleArea=g=>{const p=g.attributes.position;let sum=0;for(let i=0;i<p.count;i+=3)sum+=new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j))).getArea();return sum;};assert(Math.abs(triangleArea(highlight)-area)<1e-6);highlight.dispose();
const region=planarFace(geo,topTriangles[0]);region.bodyId='right';region.cadFace={bodyId:'right',point:[10,5,10],normal:[0,0,1]};
for(const point of [[10,5,10],[-10,5,10]]){const face=selectedConnectedPlanarFace(body,{point,normal:[0,0,1]});assert(Math.abs(R.measureArea(face)-area)<1e-6);face.delete();}
for(const [operation,depth,expected]of [['new',3,area*3],['join',3,area*13],['cut',-2,area*8]]){const f={...defaults,kind:'extrusion',profile:'region',id:'extrude',name:'全面押し出し',target:'right',operation,depth,region},r=runOperation(features,{type:'extrusion',target:'right',feature:f}),shape=R.deserializeShape(r.outputs[0].brep).asShape3D();assert(Math.abs(R.measureVolume(shape)-expected)<1e-5,`${operation}: ${R.measureVolume(shape)}`);shape.delete();}
const thin={...defaults,kind:'extrusion',profile:'region',id:'thin',name:'薄い押し出し',target:'right',operation:'new',mode:'thin',wall:2,depth:3,region},native=featureSolid(thin,bodies),plain=featureSolid({...thin,region:{...region,bodyId:undefined,cadFace:undefined}},bodies);assert(Math.abs(R.measureVolume(native)-R.measureVolume(plain))<1e-4);native.delete();plain.delete();
// Native arcs and a hole crossing the mirror line must remain exact.
const box=R.makeBox([0,-15,0],[20,15,10]),hole=R.makeCylinder(4,12,[0,0,-1]),half=box.cut(hole),seed=[{kind:'cadop',id:'seed',name:'穴のある右半分',outputs:[{id:'right',brep:half.serialize(),...half.mesh()}],remove:[]}],holed=mirrorJoin(seed,'right'),h=kernelBodies(holed),face=selectedConnectedPlanarFace(h.get('right'),{point:[10,0,10],normal:[0,0,1]});assert(Math.abs(R.measureArea(face)-(1200-Math.PI*16))<1e-6);const holes=face.clone().innerWires();assert.equal(holes.length,1);holes.forEach(w=>w.delete());face.delete();
const holeRegion={id:'holed',plane:'XY',offset:10,outer:[[-20,-15],[20,-15],[20,15],[-20,15]],holes:[],bodyId:'right',cadFace:{bodyId:'right',point:[10,0,10],normal:[0,0,1]}};
for(const capHoles of [false,true]){const f={...defaults,kind:'extrusion',profile:'region',id:'hole-extrude',name:'穴付き全面',target:'right',operation:'new',depth:3,region:holeRegion,capHoles},r=runOperation(holed,{type:'extrusion',target:'right',feature:f}),shape=R.deserializeShape(r.outputs[0].brep).asShape3D();assert(Math.abs(R.measureVolume(shape)-(1200-(capHoles?0:Math.PI*16))*3)<1e-5);shape.delete();}
// Neither an island at the same elevation nor a parallel ledge is included.
const island=R.makeBox([50,0,0],[60,10,10]),shelf=R.makeBox([0,50,0],[10,60,12]),islands=R.makeCompound([body.clone(),island.clone(),shelf.clone()]),only=selectedConnectedPlanarFace(islands,{point:[10,5,10],normal:[0,0,1]});assert(Math.abs(R.measureArea(only)-area)<1e-6);only.delete();
// Display meshes can split one seam into multiple collinear segments.
const positions=[],indices=[],faceGroups=[];
for(const [i,[x0,y0,x1,y1,z]]of [[0,0,1,2,0],[1,0,2,1,0],[1,1,2,2,0],[2,2,3,3,0],[1,0,2,1,.01]].entries()){const base=positions.length/3,start=indices.length;positions.push(x0,y0,z,x1,y0,z,x1,y1,z,x0,y1,z);indices.push(base,base+1,base+2,base,base+2,base+3);faceGroups.push({start,count:6,faceId:i+1});}
const junction=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setIndex(indices);junction.userData.faceGroups=faceGroups;junction.userData.planarFaces=faceGroups.map(f=>f.faceId);const joinedGroup=cadFaceGroup(junction,0);assert.equal(joinedGroup.parts.length,3);assert.equal(cadFaceGroup(junction,4),joinedGroup);assert.notEqual(cadFaceGroup(junction,6),joinedGroup);assert.notEqual(cadFaceGroup(junction,8),joinedGroup);junction.dispose();
for(const map of [bodies,h])for(const b of map.values())b.delete();for(const s of [box,hole,half,island,shelf,islands])s.delete();geo.dispose();
console.log('PASS mirrored joined U: full-plane selection from either half; native extrusion/join/cut/thin; exact curved hole and cap; old BREP seams; disconnected and parallel faces excluded');
