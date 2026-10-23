import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {extrusionObliqueView} from '../src/extrusion-auto-view.js';
const dir='outputs/extrusion-auto-view/';await fs.mkdir(dir,{recursive:true});
for(const normal of [[0,0,1],[1,0,0],[0,1,0],[.6,0,.8]].map(v=>new THREE.Vector3(...v)))for(const sign of [1,-1]){
 const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,1000),target=new THREE.Vector3(5,10,8),pivot=new THREE.Vector3(9,12,8);camera.zoom=2.4;camera.position.copy(target).addScaledVector(normal,sign*180);camera.up.copy(Math.abs(normal.z)>.8?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1));camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const projected=pivot.clone().project(camera),distance=camera.position.distanceTo(target),result=extrusionObliqueView(camera,target,normal,pivot);assert.ok(result);camera.position.copy(result.position);camera.up.copy(result.up);camera.lookAt(result.target);camera.updateMatrixWorld(true);assert.ok(projected.distanceTo(pivot.clone().project(camera))<1e-9);assert.ok(Math.abs(camera.position.distanceTo(result.target)-distance)<1e-9);assert.equal(camera.zoom,2.4);assert.ok(result.angle>35&&result.angle<75);assert.ok(Math.abs(Math.abs(camera.getWorldDirection(new THREE.Vector3()).dot(normal))-Math.cos(result.angle*Math.PI/180))<1e-9);assert.equal(extrusionObliqueView(camera,result.target,normal,pivot),null);
}
const proof={frontAndBack:true,arbitrarySketchPlanes:true,profileScreenAnchorPreserved:true,zoomAndDistancePreserved:true,referenceIsometricView:true,alreadyObliqueUnchanged:true};await fs.writeFile(dir+'native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
