import * as THREE from 'three';
import {cadFaceGroup,cadFaceGeometry} from './face-selection.js';
import {cylindricalSelection} from './cylindrical-selection.js';
import {planarFace} from './frames.js';
import {regionFaceGeometry} from './regions.js';
import {fitSelectionBox} from './selection-view.js';

export function selectionCandidateFrame(candidate,features=[]){
 const hit=candidate?.hit,mesh=hit?.mesh||hit?.object;
 if(!mesh?.visible)return null;
 mesh.updateWorldMatrix(true,false);
 const box=new THREE.Box3();let normal=null;
 const append=geometry=>{if(!geometry.boundingBox)geometry.computeBoundingBox();box.union(geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));};
 if(candidate.kind==='body')append(mesh.geometry);
 else if(candidate.kind==='edge'){
  const curve=hit.curve||hit.arc||hit.circle;
  if(curve)for(const point of curve.points)box.expandByPoint(new THREE.Vector3(...point).applyMatrix4(mesh.matrixWorld));
  else for(const point of [hit.a,hit.b])box.expandByPoint(point);
 }else if(candidate.kind==='face'){
  let geometry;
  try{const group=cadFaceGroup(mesh.geometry,hit.faceIndex);geometry=group?cadFaceGeometry(mesh.geometry,group):cylindricalSelection(features,candidate.bodyId,mesh.geometry,hit.faceIndex,hit.point)?.geometry||regionFaceGeometry(planarFace(mesh.geometry,hit.faceIndex));append(geometry);}
  finally{geometry?.dispose();}
  normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
 }else if(['vertex','midpoint','faceCenter'].includes(candidate.kind)){
  const context=new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length();
  box.expandByPoint(hit.point).expandByScalar(Math.max(2,Math.min(20,context*.04)));
 }
 if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))return null;
 return {box,normal:normal?.lengthSq()>1e-12?normal.normalize():null};
}
// Fit an inspection target without modifying the model or current selection.
export function fitSelectionCandidate(camera,candidate,{features=[],width,height}={}){
 if(!(width>0&&height>0))return null;
 const frame=selectionCandidateFrame(candidate,features);if(!frame)return null;
 if(frame.normal){
  const center=frame.box.getCenter(new THREE.Vector3()),normal=frame.normal;
  let up=camera.up.clone().addScaledVector(normal,-camera.up.dot(normal));
  if(up.lengthSq()<1e-8){up=new THREE.Vector3(0,0,1).addScaledVector(normal,-normal.z);if(up.lengthSq()<1e-8)up.set(0,1,0).addScaledVector(normal,-normal.y);}
  camera.up.copy(up.normalize());camera.position.copy(center).addScaledVector(normal,Math.max(180,frame.box.getSize(new THREE.Vector3()).length()*2));camera.lookAt(center);camera.updateMatrixWorld(true);
 }
 const target=fitSelectionBox(camera,frame.box,width,height);if(target){camera.lookAt(target);camera.updateMatrixWorld(true);}return target;
}
