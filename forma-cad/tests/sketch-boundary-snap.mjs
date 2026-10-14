import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSketchBoundarySnap,closestBoundaryPoint} from '../src/sketch-boundary-snap.js';
import {defaults,makeGeometry} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';

const near=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const resolver=createSketchBoundarySnap(),xy=basisFor({plane:'XY'}),project=p=>({x:p.x*10,y:p.y*10});
const box=new THREE.Mesh(new THREE.BoxGeometry(20,30,10));box.position.z=5;
const snap=(point,offset=10,meshes=[box],options)=>resolver.snap(meshes,xy,offset,new THREE.Vector3(...point),project,options);
for(const z of [0,5,10]){
 const p=snap([10.6,3.7,z],z);assert.ok(p);near(p.x,10);near(p.y,3.7);near(p.z,z);
 assert.equal(snap([11,3.7,z],z),null,'attraction is limited to eight pixels');
 assert.equal(snap([.2,.2,z],z),null,'triangle diagonals are not solid boundaries');
}
assert.equal(snap([10.2,3.7,11],11),null,'a projected off-plane solid is not a boundary');
box.visible=false;assert.equal(snap([10.2,3.7,10]),null);box.visible=true;
let clones=0;const clone=box.geometry.clone.bind(box.geometry);box.geometry.clone=()=>{clones++;return clone();};
resolver.clear();snap([10.2,2,10]);snap([10.2,3,10]);assert.equal(clones,1,'mouse movement reuses the same plane section');
box.position.x=7;near(snap([17.2,3,10]).x,17);assert.equal(clones,2,'moving the body invalidates the section');
box.geometry=new THREE.BoxGeometry(30,30,10);near(snap([22.2,3,10]).x,22);
const locked=snap([22.4,3.4,10],10,[box],{origin:new THREE.Vector3(7,3,10),direction:new THREE.Vector3(1,0,0)});near(locked.x,22);near(locked.y,3);
assert.equal(snap([22.4,3.4,10],10,[box],{origin:new THREE.Vector3(7,3,10),direction:new THREE.Vector3(-1,0,0)}),null,'locked direction does not reverse');
const shape=new THREE.Shape([[-10,-10],[10,-10],[10,10],[-10,10]].map(p=>new THREE.Vector2(...p)));
shape.holes.push(new THREE.Path([[-2,-2],[-2,2],[2,2],[2,-2]].map(p=>new THREE.Vector2(...p))));
const holed=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:10,bevelEnabled:false}));
for(const z of [0,5,10]){const p=snap([2.4,.7,z],z,[holed]);near(p.x,2);near(p.y,.7);}
for(const plane of ['XY','XZ','YZ']){
 const basis=basisFor({plane}),mesh=new THREE.Mesh(makeGeometry({...defaults,kind:'extrusion',profile:'circle',diameter:20,depth:10,plane}));
 const angle=.431,u=Math.cos(angle),v=Math.sin(angle),hit=basis.u.clone().multiplyScalar(10.4*u).addScaledVector(basis.v,10.4*v).addScaledVector(basis.n,10);
 const projection=p=>({x:p.dot(basis.u)*10,y:p.dot(basis.v)*10});
 const p=resolver.snap([mesh],basis,10,hit,projection);assert.ok(p);near(p.dot(basis.n),10);near(Math.hypot(p.dot(basis.u),p.dot(basis.v)),10,.01);
 mesh.geometry.dispose();
}
// Screen distance, rather than a fixed millimetre tolerance, governs snapping.
const edges=[[new THREE.Vector3(0,0,0),new THREE.Vector3(0,10,0)]],hit=new THREE.Vector3(.9,3.1,0);
assert.equal(closestBoundaryPoint(edges,hit,project),null);
near(closestBoundaryPoint(edges,hit,p=>({x:p.x,y:p.y})).y,3.1);
box.geometry.dispose();holed.geometry.dispose();resolver.clear();
console.log('PASS arbitrary edge positions, section planes, holes and circular contours, no triangle seams or off-plane silhouettes, hidden bodies, pixel tolerance, angle constraints and cache invalidation');
