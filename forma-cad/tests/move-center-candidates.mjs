import assert from 'node:assert/strict';
import * as THREE from 'three';
import {moveCenterCandidates,nearestMoveAxis} from '../src/move-axis-picker.js';
import {solidReferencePoints} from '../src/reference-points.js';
import {bodyEdges} from '../src/body-edges.js';

const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,500);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
function box(x=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,20,10),new THREE.MeshBasicMaterial());mesh.position.set(x,0,5);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial());mesh.add(edges);mesh.userData.references=solidReferencePoints(mesh.geometry,edges.geometry);mesh.updateMatrixWorld(true);return mesh;}
const mesh=box(),options={meshes:[mesh],occluders:[mesh],camera,width:500,height:500};
let candidates=moveCenterCandidates(options);
assert.equal(candidates.length,9,'four visible vertices, four edge midpoints and one top face center');
for(const [name,count]of [['頂点',4],['辺の中点',4],['面の中心',1]])assert.equal(candidates.filter(c=>c.ref.name===name).length,count);
for(const c of candidates){assert.equal(c.kind,'point');assert.ok(Math.abs(c.point.z-10)<1e-7,'hidden bottom and rear centers are excluded');assert.equal(nearestMoveAxis(candidates,c.screen.x,c.screen.y),c,'every displayed point is selectable');}
candidates=moveCenterCandidates({...options,points:[{point:[25,0,0],name:'スケッチ点'},{point:[0,0,0],name:'隠れた点'},{point:[-25,0,0],name:'ヒンジ軸中心',a:[-25,-10,0],b:[-25,10,0]}]});
assert.ok(candidates.some(c=>c.ref.name==='スケッチ点'));assert.ok(candidates.some(c=>c.ref.name==='ヒンジ軸中心'));assert.ok(!candidates.some(c=>c.ref.name==='隠れた点'));
const other=box(30);assert.equal(moveCenterCandidates({...options,meshes:[mesh,other],occluders:[mesh,other]}).length,18,'all target bodies expose center candidates');
other.rotation.z=Math.PI/2;other.position.set(25,5,15);other.updateMatrixWorld(true);
const moved=moveCenterCandidates({...options,meshes:[other],occluders:[other]}).find(c=>c.ref.name==='面の中心');assert.ok(moved.point.distanceTo(new THREE.Vector3(25,5,20))<1e-7,'points follow preview translation and rotation');
const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(10,10,10,64),new THREE.MeshBasicMaterial());const rim=bodyEdges(cylinder.geometry);cylinder.add(new THREE.LineSegments(rim));
assert.ok(!moveCenterCandidates({...options,meshes:[cylinder],occluders:[cylinder]}).some(c=>c.ref.name==='頂点'),'curved rim tessellation points are not presented as vertices');
cylinder.rotation.x=Math.PI/2;cylinder.updateMatrixWorld(true);
assert.ok(moveCenterCandidates({...options,meshes:[cylinder],occluders:[cylinder]}).some(c=>c.ref.name==='円・円弧の中心'&&Math.abs(c.point.z-5)<1e-7),'the visible circular cap center is offered');
for(const body of [mesh,other,cylinder]){body.geometry.dispose();body.children[0].geometry.dispose();}
console.log('PASS visible vertices, edge midpoints, face/circle/sketch/hinge centers, hidden-point rejection, multi-body candidates, transformed previews and curved-rim guards');
