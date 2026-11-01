import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sketchPlaneReferencePick} from '../src/sketch-plane-reference-pick.js';
import {solidReferencePoints} from '../src/reference-points.js';

const rect={left:30,top:40,width:600,height:600};
function fixture(){
 const geometry=new THREE.BoxGeometry(20,20,10),edges=new THREE.EdgesGeometry(geometry),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
 mesh.add(new THREE.LineSegments(edges));mesh.userData.bodyId='box';mesh.userData.references=solidReferencePoints(geometry,edges);
 const camera=new THREE.OrthographicCamera(-30,30,30,-30,.1,1000);camera.position.set(40,-50,80);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 return {mesh,camera};
}
function cursor(point,camera){const p=point.clone().project(camera);return [rect.left+(p.x+1)*300,rect.top+(1-p.y)*300];}
test('working-grid reference picking uses real visible vertices and straight-edge midpoints',()=>{
 const {mesh,camera}=fixture();for(const [point,kind] of [[new THREE.Vector3(10,-10,5),'vertex'],[new THREE.Vector3(0,-10,5),'midpoint']]){
  const hit=sketchPlaneReferencePick([mesh],camera,rect,...cursor(point,camera));assert.equal(hit.kind,kind);assert.equal(hit.bodyId,'box');assert.ok(hit.point.distanceTo(point)<1e-8);
 }
 mesh.geometry.dispose();mesh.children[0].geometry.dispose();mesh.material.dispose();
});
test('reference picking respects transforms, occlusion, visibility and canvas boundaries',()=>{
 const {mesh,camera}=fixture();mesh.position.set(2,3,1);mesh.rotation.z=.3;mesh.updateMatrixWorld(true);
 const point=new THREE.Vector3(0,-10,5).applyMatrix4(mesh.matrixWorld),xy=cursor(point,camera),hit=sketchPlaneReferencePick([mesh],camera,rect,...xy);assert.equal(hit.kind,'midpoint');assert.ok(hit.point.distanceTo(point)<1e-8);
 const cover=new THREE.Mesh(new THREE.BoxGeometry(6,6,6),new THREE.MeshBasicMaterial());cover.position.copy(point).add(camera.position.clone().sub(point).normalize().multiplyScalar(15));cover.updateMatrixWorld(true);
 assert.equal(sketchPlaneReferencePick([mesh,cover],camera,rect,...xy),null);mesh.visible=false;assert.equal(sketchPlaneReferencePick([mesh],camera,rect,...xy),null);assert.equal(sketchPlaneReferencePick([mesh],camera,rect,rect.left-1,rect.top),null);
 for(const m of [mesh,cover]){m.geometry.dispose();m.material.dispose();}mesh.children[0].geometry.dispose();
});
