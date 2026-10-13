import assert from 'node:assert/strict';
import * as THREE from 'three';
import {constrainMoveDelta,cursorMovePlane,cursorMovePoint,movePointKind,movePreviewChildMatrix,createMoveGhost,disposeMoveGhost} from '../src/move-cursor.js';
import {movePointCandidates} from '../src/move-axis-picker.js';
const delta=new THREE.Vector3(30,-7,12);
for(const [direction,expected]of [['free',[30,-7,12]],['X',[30,0,0]],['Y',[0,-7,0]],['Z',[0,0,12]],['XY',[30,-7,0]]])assert.deepEqual(constrainMoveDelta(delta,direction).toArray(),expected);
assert.deepEqual(delta.toArray(),[30,-7,12],'constraints must not mutate the requested point');
assert.equal(movePointKind({kind:'center',name:'スケッチ点'}),'sketch');
assert.equal(movePointKind({name:'原点'}),'center');
const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,500);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
const rect={left:100,top:50,width:500,height:500},plane=new THREE.Plane(new THREE.Vector3(0,0,1),-12);
const anchor=cursorMovePoint(camera,rect,350,300,plane),next=cursorMovePoint(camera,rect,500,240,plane);
assert.ok(anchor.distanceTo(new THREE.Vector3(0,0,12))<1e-8);
assert.ok(next.clone().sub(anchor).distanceTo(new THREE.Vector3(30,12,0))<1e-8,'cursor offsets are in the view plane');
camera.position.set(80,-100,60);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
for(const normal of [[0,0,1],[0,1,0],[1,0,0]]){
 const position=new THREE.Vector3(4,5,12),reference=cursorMovePlane(position,normal);
 const first=cursorMovePoint(camera,rect,350,300,reference),second=cursorMovePoint(camera,rect,420,280,reference);
 assert.ok(first&&second);assert.ok(Math.abs(reference.distanceToPoint(first))<1e-8&&Math.abs(reference.distanceToPoint(second))<1e-8,'oblique views intersect the chosen reference plane through the body');
 const movement=second.clone().sub(first);assert.ok(movement.length()>1);assert.ok(Math.abs(movement.dot(reference.normal))<1e-8,'XY/XZ/YZ preserve the normal coordinate');
 for(const direction of ['free','X','Y','Z','XY']){const constrained=constrainMoveDelta(delta,direction,reference.normal);assert.ok(Math.abs(constrained.dot(reference.normal))<1e-8);for(const axis of ['x','y','z'])if(direction!=='free'&&!direction.toLowerCase().includes(axis))assert.equal(constrained[axis],0);}
}
const customNormal=new THREE.Vector3(1,2,3).normalize(),custom=constrainMoveDelta(delta,'XY',customNormal);assert.ok(Math.abs(custom.dot(customNormal))<1e-8&&custom.z===0,'direction and plane constraints are intersected');
camera.position.set(100,0,12);camera.lookAt(0,0,12);camera.updateMatrixWorld(true);
assert.equal(cursorMovePoint(camera,rect,350,300,cursorMovePlane(new THREE.Vector3(4,5,12),[0,0,1])),null,'edge-on reference planes do not produce huge jumps');
assert.equal(cursorMovePoint(camera,{...rect,width:0},350,300,plane),null);
camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const points=[{point:[0,0,0],name:'スケッチ点',kind:'center'},{point:[0,0,0],name:'頂点',kind:'vertex'},{point:[20,0,0],name:'辺の中点',kind:'midpoint'},{point:[-20,0,0],name:'原点'}];
const options={meshes:[],occluders:[],points,camera,width:500,height:500,source:true};
for(const kind of ['vertex','midpoint','center','sketch']){
 const candidates=movePointCandidates({...options,pointKinds:[kind]});assert.equal(candidates.length,1);assert.equal(movePointKind(candidates[0].ref),kind,'filter before coincident-point deduplication');
}
assert.equal(movePointCandidates({...options,pointKinds:[]}).length,0);
const proxy=new THREE.Group(),child=new THREE.Group();proxy.position.set(4,8,10);proxy.rotation.z=.3;child.matrixAutoUpdate=false;proxy.add(child);
const geometries=[],materials=[];
for(let i=0;i<2;i++){const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material);mesh.position.x=i*10;child.add(mesh);geometries.push(geometry);materials.push(material);}
proxy.updateMatrixWorld(true);const ghost=createMoveGhost(proxy);
assert.equal(ghost.children[0].children.length,2,'multi-body ghosts retain all selected bodies');
let disposed=0;ghost.traverse(object=>{if(object.isMesh){assert.equal(object.geometry,geometries[object.position.x/10]);assert.notEqual(object.material,materials[object.position.x/10]);assert.equal(object.material.transparent,true);assert.equal(object.material.depthWrite,false);object.material.addEventListener('dispose',()=>disposed++);}});
disposeMoveGhost(ghost);assert.equal(disposed,2);
const base=new THREE.Matrix4().makeTranslation(2,3,4),center=new THREE.Vector3(),position=new THREE.Vector3(30,0,0),q=new THREE.Quaternion();
assert.deepEqual(movePreviewChildMatrix(base,position,center,q,false).elements,base.elements);
const mirrored=movePreviewChildMatrix(base,position,center,q,true);
assert.ok(new THREE.Vector3(5,0,0).applyMatrix4(mirrored).distanceTo(new THREE.Vector3(-7,3,4))<1e-8,'ghost reflection follows the proposed movement direction');
assert.deepEqual(movePreviewChildMatrix(base,center,center,q,true).elements,base.elements,'zero displacement does not reflect');
for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
console.log('PASS movement constraints, category filtering before deduplication, orthographic/oblique cursor planes, grouped translucent ghosts and mirrored-copy preview matrices');
