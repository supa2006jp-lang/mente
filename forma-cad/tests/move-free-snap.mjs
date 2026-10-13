import assert from 'node:assert/strict';
import * as THREE from 'three';
import {findFreeMoveSnap,freeSnapPosition,snapshotMoveReferences,transformedMoveReferences} from '../src/move-free-snap.js';
import {solidReferencePoints} from '../src/reference-points.js';
import {bodyEdges} from '../src/body-edges.js';
const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,500);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
const vector=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),candidate=(point,name='頂点',key='point')=>({point:new THREE.Vector3(...point),ref:{name,key}});
const options={camera,width:1000,height:1000,position:vector(3,4,5),pivot:vector(),sources:[candidate([10,20,0],'頂点','source')],targets:[candidate([10.4,20.3,0],'辺の中点','target')]};
let snap=findFreeMoveSnap(options);
assert.ok(snap.position.distanceTo(vector(3.4,4.3,5))<1e-9);assert.equal(snap.target,'辺の中点');
for(const normal of [vector(0,0,1),vector(0,1,0),vector(1,0,0)]){
 const allowed=normal.x?vector(0,.3,0):vector(.3,0,0),source=options.sources[0].point;
 assert.ok(freeSnapPosition({source,target:source.clone().add(allowed),position:options.position,pivot:vector(),planeNormal:normal}));
 assert.equal(freeSnapPosition({source,target:source.clone().addScaledVector(normal,.1),position:options.position,pivot:vector(),planeNormal:normal}),null,'nearby points cannot pull free movement out of its reference plane');
}
assert.equal(findFreeMoveSnap({...options,planeNormal:vector(0,0,1),targets:[candidate([10.4,20.3,.1])]}),null,'the magnetic solver rejects small normal-axis jumps as well as large depth jumps');
assert.equal(findFreeMoveSnap({...options,direction:'X'}),null,'unreachable points must not break a direction constraint');
snap=findFreeMoveSnap({...options,direction:'X',targets:[candidate([10.4,20,0])]});assert.ok(snap.position.distanceTo(vector(3.4,4,5))<1e-9);
assert.equal(findFreeMoveSnap({...options,targets:[candidate([10,20,20])]}),null,'projected coincidence cannot jump to a different depth');
assert.equal(findFreeMoveSnap({...options,targets:[candidate([12,20,0])]}),null,'points outside the pixel radius do not attract');
snap=findFreeMoveSnap({...options,targets:[candidate([10.9,20,0],'新しい点','new'),candidate([11,20,0],'保持中の点','held')],previous:{type:'point',sourceKey:'source',targetKey:'held'}});assert.equal(snap.target,'保持中の点','hysteresis avoids flickering between close candidates');
for(const name of ['頂点','辺の中点','面の中心','円・円弧の中心','スケッチ点'])assert.equal(findFreeMoveSnap({...options,targets:[candidate([10.4,20,0],name)]}).target,name);
const grid={...options,sources:[],targets:[],grid:{enabled:true,step:10,plane:'XY'},gridSource:{point:vector(9.7,3.2,7),name:'移動中心'}};
snap=findFreeMoveSnap(grid);assert.ok(snap.position.distanceTo(vector(3.3,4,5))<1e-9);assert.deepEqual(snap.axes,['x']);assert.equal(snap.point.z,7,'grid preserves height');
snap=findFreeMoveSnap({...grid,gridSource:{point:vector(9.7,20.4,7)}});assert.ok(snap.position.distanceTo(vector(3.3,3.6,5))<1e-9);assert.deepEqual(snap.axes,['x','y']);
assert.equal(findFreeMoveSnap({...grid,direction:'Z'}),null,'XY grid cannot change a Z-only move');
assert.equal(findFreeMoveSnap({...grid,grid:{...grid.grid,enabled:false}}),null);
assert.equal(findFreeMoveSnap({...grid,grid:{...grid.grid,step:.1}}),null,'dense grids are not magnetic at this zoom');
assert.equal(findFreeMoveSnap({...grid,gridSource:{point:vector(7,3,7)}}),null,'far grid lines do not attract');
assert.equal(findFreeMoveSnap({...grid,grid:{...grid.grid,plane:'XZ'}}).axes.join(','),'x','edge-on grid axes are not offered');
const offset=vector(2,1,0),raw=vector(10,3,0),next=vector(10.2,3.1,0);
const reflected=(displacement,a)=>{const normal=displacement.clone().normalize();return displacement.clone().add(a).addScaledVector(normal,-2*a.dot(normal));};
const source=reflected(raw,offset),target=reflected(next,offset),mirrored=freeSnapPosition({source,target,position:raw,pivot:vector(),mirrored:true});
assert.ok(mirrored.distanceTo(next)<1e-9,'mirrored copies solve the final reflection plane');assert.ok(reflected(mirrored,offset).distanceTo(target)<1e-9);
const xOnly=vector(10.2,3,0),xTarget=reflected(xOnly,offset);assert.ok(freeSnapPosition({source,target:xTarget,position:raw,pivot:vector(),direction:'X',mirrored:true}).distanceTo(xOnly)<1e-9);
assert.equal(freeSnapPosition({source,target,position:raw,pivot:vector(),direction:'X',mirrored:true}),null);
const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,16,12)),edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry));mesh.add(edges);mesh.userData.references=solidReferencePoints(mesh.geometry,edges.geometry);mesh.position.set(10,2,6);mesh.updateMatrixWorld(true);
const cached=snapshotMoveReferences([mesh]),before=transformedMoveReferences(cached);mesh.position.add(vector(12,-3,7));mesh.rotation.z=Math.PI/2;mesh.updateMatrixWorld(true);const after=transformedMoveReferences(cached);
assert.deepEqual(after.map(r=>r.key),before.map(r=>r.key),'source identities survive translation/rotation');for(let i=0;i<after.length;i++){const expected=cached[0].refs[i].local.clone().applyMatrix4(mesh.matrixWorld);assert.ok(new THREE.Vector3(...after[i].point).distanceTo(expected)<1e-9);}
const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(10,10,10,64));cylinder.add(new THREE.LineSegments(bodyEdges(cylinder.geometry)));assert.equal(snapshotMoveReferences([cylinder])[0].refs.filter(ref=>ref.kind==='vertex').length,0,'circular tessellation points are never snap references');
for(const object of [mesh,cylinder]){object.geometry.dispose();object.material.dispose();object.children[0].geometry.dispose();object.children[0].material.dispose();}
console.log('PASS point kinds, proximity/depth guards, direction constraints, hysteresis, grid planes/zoom/height, mirrored-copy solutions, stable transformed references and smooth circular rims');
