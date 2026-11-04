import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {closestGridBoundaryIntersection,createGridBoundarySnap,gridBoundaryPointVisible} from '../src/grid-boundary-snap.js';
import {createSketchBoundarySnap} from '../src/sketch-boundary-snap.js';
import {basisFor} from '../src/frames.js';import {scopedFaceGrid} from '../src/face-grid.js';
import {solidVertexPoints} from '../src/vertex-points.js';import {retainCadCoordinates} from '../src/cad-coordinates.js';
const v=p=>new THREE.Vector3(...p),seg=(a,b)=>[v(a),v(b)],project=p=>({x:p.x*10,y:p.y*10}),near=(a,b)=>assert.ok(a.distanceTo(v(b))<1e-7,JSON.stringify(a.toArray()));
test('grid crossing snaps to a finite oblique boundary even when the other coordinate is between grid vertices',()=>{
 const boundary=[seg([0,3,0],[20,13,0])],grid=[seg([10,-10,0],[10,20,0])],hit=v([10.3,8.2,0]);near(closestGridBoundaryIntersection(boundary,grid,hit,project),[10,8,0]);
 assert.equal(closestGridBoundaryIntersection(boundary,grid,v([11,8,0]),project),null);
 assert.equal(closestGridBoundaryIntersection([seg([0,3,0],[9,7.5,0])],grid,hit,project),null);
 assert.equal(closestGridBoundaryIntersection(boundary,[seg([10,-10,0],[10,7,0])],hit,project),null);
 assert.equal(closestGridBoundaryIntersection(boundary,grid,hit,project,{accept:()=>false}),null);
});
test('parallel lines, off-plane silhouettes and incompatible numeric directions do not create crossings',()=>{
 const boundary=[seg([0,3,0],[20,13,0])],grid=[seg([10,-10,0],[10,20,0])],hit=v([10.3,8.2,0]);
 assert.equal(closestGridBoundaryIntersection(boundary,[seg([0,3,0],[20,13,0])],hit,project),null);
 assert.equal(closestGridBoundaryIntersection(boundary,[seg([10,-10,1],[10,20,1])],hit,project),null);
 assert.equal(closestGridBoundaryIntersection(boundary,grid,hit,project,{origin:v([0,0,0]),direction:v([1,0,0])}),null);
 near(closestGridBoundaryIntersection(boundary,grid,hit,project,{origin:v([0,8,0]),direction:v([1,0,0])}),[10,8,0]);
 assert.equal(closestGridBoundaryIntersection(boundary,grid,hit,project,{origin:v([0,8,0]),direction:v([-1,0,0])}),null);
});
test('actual purple grid extents, holes, transformed planes and visual lift are respected',()=>{
 const resolver=createGridBoundarySnap(),face={outer:[[0,0],[30,0],[30,30],[0,30]],holes:[[[8,6],[8,14],[12,14],[12,6]]]},grid=scopedFaceGrid(face,'face',10).grid,basis=basisFor({plane:'XY'});
 grid.applyMatrix4(new THREE.Matrix4().makeBasis(basis.u,basis.n.clone().negate(),basis.v));grid.position.z=.02;
 const edges=[seg([2,8,0],[28,8,0])];assert.equal(resolver.snap(grid,edges,basis,0,v([10,8,0]),project),null,'no grid line inside the hole');near(resolver.snap(grid,edges,basis,0,v([20.2,8.1,0]),project),[20,8,0]);
 grid.visible=false;assert.equal(resolver.snap(grid,edges,basis,0,v([20,8,0]),project),null);grid.visible=true;grid.position.z=2;assert.equal(resolver.snap(grid,edges,basis,0,v([20,8,0]),project),null);grid.geometry.dispose();grid.material.dispose();
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.6,.2)),b=Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3().setComponent(i,1).applyQuaternion(q)])),world=p=>b.u.clone().multiplyScalar(p[0]).addScaledVector(b.v,p[1]).addScaledVector(b.n,17),g=scopedFaceGrid({...face,holes:[]},'face',10).grid;g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.u,b.n.clone().negate(),b.v));g.position.copy(b.n).multiplyScalar(17.02);
 const result=resolver.snap(g,[[world([0,3]),world([20,13])]],b,17,world([10.3,8.2]),p=>({x:p.dot(b.u)*10,y:p.dot(b.v)*10}));assert.ok(result.distanceTo(world([10,8]))<1e-7);g.geometry.dispose();g.material.dispose();
});
test('occluded crossings are rejected while clipped-away front surfaces do not block them',()=>{
 const camera=new THREE.OrthographicCamera(-30,30,30,-30,.1,1000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshBasicMaterial());mesh.updateMatrixWorld(true);const point=v([0,0,0]);assert.equal(gridBoundaryPointVisible(point,camera,[mesh]),false);mesh.material.clippingPlanes=[new THREE.Plane(v([0,0,-1]),0)];assert.equal(gridBoundaryPointVisible(point,camera,[mesh]),true);mesh.visible=false;assert.equal(gridBoundaryPointVisible(point,camera,[mesh]),true);mesh.geometry.dispose();mesh.material.dispose();
});
test('a scoped grid ending on a slanted edge tolerates GPU rounding and returns the precise boundary',()=>{
 const angle=Math.PI/6,rotate=([x,y])=>[40+x*Math.cos(angle)-y*Math.sin(angle),30+x*Math.sin(angle)+y*Math.cos(angle)],outer=[[-30,-15],[30,-15],[30,15],[-30,15]].map(rotate),basis=basisFor({plane:'XY'}),grid=scopedFaceGrid({outer,holes:[]},'face',10).grid;
 grid.applyMatrix4(new THREE.Matrix4().makeBasis(basis.u,basis.n.clone().negate(),basis.v));grid.position.z=10.02;const edges=outer.map((a,i)=>seg([...a,10],[...outer[(i+1)%outer.length],10])),expected=[50,30+10*Math.tan(angle)-15/Math.cos(angle),10];
 near(createGridBoundarySnap().snap(grid,edges,basis,10,v([50.2,18.55,10]),project),expected);grid.geometry.dispose();grid.material.dispose();
});
test('true vertex snapping refreshes when precise CAD coordinates replace display coordinates',()=>{
 const geometry=new THREE.BufferGeometry().setFromPoints([v([0,0,0]),v([10,0,0])]);assert.equal(solidVertexPoints(geometry)[1][0],10);retainCadCoordinates(geometry,[0,0,0,10.000000123,0,0]);assert.equal(solidVertexPoints(geometry)[1][0],10.000000123);geometry.dispose();
});
test('a straight solid edge is extended in 3D to the sketch plane and tracks changes of plane and body',()=>{
 const snap=createSketchBoundarySnap(),basis=basisFor({plane:'XY'});
 const mesh=new THREE.Object3D(),geometry=new THREE.BufferGeometry().setFromPoints([v([2,3,6]),v([4,6,12])]);
 mesh.add(new THREE.Object3D());mesh.children[0].geometry=geometry;
 const at=(x,y,z,options)=>snap.extension([mesh],basis,z,v([x,y,z]),project,options);
 try{
  const result=at(.2,.1,0,{sourceVisible:p=>p.z>=6});
  assert.equal(result.kind,'edgeExtension');near(result.point,[0,0,0]);near(result.segments[0][0],[2,3,6]);
  near(at(1,1.5,3).point,[1,1.5,3]);
  assert.equal(at(3,4.5,9),null,'a finite crossing is not a virtual extension');
  assert.equal(at(0,0,0,{sourceVisible:()=>false}),null);
  assert.equal(at(0,0,0,{origin:v([-5,1,0]),direction:v([1,0,0])}),null);
  mesh.position.set(3,4,0);near(at(3,4,0).point,[3,4,0]);
  mesh.visible=false;assert.equal(at(3,4,0),null);mesh.visible=true;
  geometry.userData.arcEdges=new Map([[0,{}]]);snap.clear();
  assert.equal(at(3,4,0),null,'an arc chord must not act as a straight edge');
 }finally{geometry.dispose();}
});
test('a parallel solid edge projects and extends to the finite sketch-plane boundary',()=>{
 const snap=createSketchBoundarySnap(),basis=basisFor({plane:'XY'}),mesh=new THREE.Object3D();
 const geometry=new THREE.BufferGeometry().setFromPoints([v([2.5,17,8]),v([2.5,27,8])]);
 mesh.add(new THREE.Object3D());mesh.children[0].geometry=geometry;
 const at=(x,y,boundary,options)=>snap.extension([mesh],basis,0,v([x,y,0]),project,{boundaries:[boundary],...options});
 const boundary=seg([-35,0,0],[35,0,0]);
 try{
  const result=at(2.8,.1,boundary,{sourceVisible:p=>p.z===8});
  assert.equal(result.projected,true);near(result.point,[2.5,0,0]);near(result.segments[0][0],[2.5,17,0]);
  assert.equal(at(2.8,.1,seg([2.6,0,0],[35,0,0])),null);
  assert.equal(at(2.8,22.1,seg([-35,22,0],[35,22,0])),null);
  assert.equal(at(2.8,.1,boundary,{sourceVisible:()=>false}),null);
  mesh.position.z=-8;near(at(2.8,.1,boundary).point,[2.5,0,0]);
 }finally{geometry.dispose();}
});
test('a projected front lip catches a partially covered oblique edge at its visible break',()=>{
 const snap=createSketchBoundarySnap(),basis=basisFor({plane:'XY'});
 const bodies=[[[2.5,-6,4],[2.5,26,7]],[[-35,0,10],[35,0,10]]].map(points=>{
  const body=new THREE.Object3D(),edge=new THREE.Object3D();
  edge.geometry=new THREE.BufferGeometry().setFromPoints(points.map(v));body.add(edge);
  return body;
 });
 const at=sourceVisible=>snap.extension(bodies,basis,0,v([2.8,-.1,0]),project,{sourceVisible});
 try{
  const visible=p=>p.z===10||p.y>=0;
  for(let i=0;i<2;i++){
   const result=at(visible);
   near(result.point,[2.5,0,0]);near(result.segments[0][0],[2.5,26,0]);
  }
  assert.equal(at(()=>true),null,'two visible edges crossing in projection do not count as an extension');
  assert.equal(at(p=>p.z===10),null,'a fully hidden source does not snap');
  assert.equal(at(p=>p.z<10&&p.y>=0),null,'a hidden lip does not snap');
 }finally{for(const body of bodies)body.children[0].geometry.dispose();}
});
