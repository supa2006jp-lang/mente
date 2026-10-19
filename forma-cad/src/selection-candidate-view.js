import * as THREE from 'three';
import {cadFaceGroup,cadFaceGeometry} from './face-selection.js';
import {cylindricalSelection} from './cylindrical-selection.js';
import {planarFace} from './frames.js';
import {regionFaceGeometry} from './regions.js';
import {fitSelectionBox} from './selection-view.js';

// Keep world-space framing; viewport size and clipping planes remain live.
export function captureSelectionView(camera,target,label=''){
 return {position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),zoom:camera.zoom,target:target.toArray(),label};
}
export function restoreSelectionView(camera,view){
 if(!view||!['position','quaternion','up','target'].every(key=>Array.isArray(view[key])&&view[key].length===(key==='quaternion'?4:3)&&view[key].every(Number.isFinite))||!Number.isFinite(view.zoom)||view.zoom<=0)return null;
 if(new THREE.Vector3(...view.up).lengthSq()<1e-12||new THREE.Quaternion(...view.quaternion).lengthSq()<1e-12||new THREE.Vector3(...view.position).distanceToSquared(new THREE.Vector3(...view.target))<1e-12)return null;
 camera.position.fromArray(view.position);camera.quaternion.fromArray(view.quaternion).normalize();camera.up.fromArray(view.up);camera.zoom=view.zoom;
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return new THREE.Vector3(...view.target);
}

function bodyBounds(mesh){if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);}
function candidateNormal(candidate,mesh,anchor){
 const hit=candidate.hit,matrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
 if(['face','body'].includes(candidate.kind)&&hit.face?.normal)return hit.face.normal.clone().applyNormalMatrix(matrix).normalize();
 // Reference-point normals already use world coordinates. Vertex references
 // instead carry a default Z axis, so recover their actual adjacent faces.
 if(candidate.kind==='faceCenter'&&hit.reference?.normal)return new THREE.Vector3(...hit.reference.normal).normalize();
 if(!anchor)return null;
 const geometry=mesh.geometry,p=geometry.attributes.position,ix=geometry.index,point=anchor.clone().applyMatrix4(mesh.matrixWorld.clone().invert()),triangle=new THREE.Triangle(),corners=[triangle.a,triangle.b,triangle.c],nearest=new THREE.Vector3(),normal=new THREE.Vector3();
 const tolerance=Math.max(1e-5,geometry.boundingBox.getSize(new THREE.Vector3()).length()*1e-6),samples=[],normals=[];let distance=Infinity;
 for(let i=0;i<(ix?.count??p.count);i+=3){
  for(let j=0;j<3;j++)corners[j].fromBufferAttribute(p,ix?ix.getX(i+j):i+j);
  const d=triangle.closestPointToPoint(point,nearest).distanceTo(point);
  if(d>distance+tolerance)continue;
  if(d<distance-tolerance)samples.length=0;distance=Math.min(distance,d);triangle.getNormal(normal);
  if(normal.lengthSq())samples.push({distance:d,normal:normal.clone()});
 }
 for(const sample of samples)if(sample.distance<=distance+tolerance&&!normals.some(n=>n.dot(sample.normal)>.9999))normals.push(sample.normal);
 const sum=normals.reduce((s,n)=>s.add(n),new THREE.Vector3());
 return sum.lengthSq()>1e-12?sum.applyNormalMatrix(matrix).normalize():null;
}

export function selectionCandidateFrame(candidate,features=[]){
 const hit=candidate?.hit,mesh=hit?.mesh||hit?.object;
 if(!mesh?.visible)return null;
 mesh.updateWorldMatrix(true,false);
 const box=new THREE.Box3(),bodyBox=bodyBounds(mesh);let normal=null;
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
 const anchor=hit.point?.clone()||(['edge'].includes(candidate.kind)&&hit.a&&hit.b?hit.a.clone().add(hit.b).multiplyScalar(.5):box.getCenter(new THREE.Vector3()));
 normal=candidateNormal(candidate,mesh,anchor)||normal;
 return {box,bodyBox,normal:normal?.lengthSq()>1e-12?normal.normalize():null};
}
// Inspect from the target side while retaining the complete visible model.
export function fitSelectionCandidate(camera,candidate,{features=[],width,height,meshes=[]}={}){
 if(!(width>0&&height>0))return null;
 const frame=selectionCandidateFrame(candidate,features);if(!frame)return null;
 const box=frame.bodyBox.clone();for(const mesh of meshes){if(!mesh.visible)continue;mesh.updateWorldMatrix(true,false);box.union(bodyBounds(mesh));}
 const center=box.getCenter(new THREE.Vector3()),normal=frame.normal||camera.getWorldDirection(new THREE.Vector3()).negate(),up=new THREE.Vector3(0,0,1),current=camera.getWorldDirection(new THREE.Vector3()).negate();
 let tangent=up.clone().addScaledVector(normal,-up.dot(normal));
 if(tangent.lengthSq()<1e-8){tangent=current.clone().addScaledVector(normal,-current.dot(normal));if(tangent.lengthSq()<1e-8)tangent.set(1,-1,0);}
 else{tangent.normalize();const side=normal.clone().cross(tangent).normalize();tangent.multiplyScalar(.8).addScaledVector(side,current.dot(side)<0?-.6:.6);}
 const angle=THREE.MathUtils.degToRad(25),direction=normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent.normalize(),Math.sin(angle)).normalize();
 camera.up.copy(up);camera.position.copy(center).addScaledVector(direction,Math.max(180,box.getSize(new THREE.Vector3()).length()*2));camera.lookAt(center);camera.updateMatrixWorld(true);
 const target=fitSelectionBox(camera,box,width,height);if(target){camera.zoom*=1.25/1.4;camera.updateProjectionMatrix();camera.lookAt(target);camera.updateMatrixWorld(true);}return target;
}
