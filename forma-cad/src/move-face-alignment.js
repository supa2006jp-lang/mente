import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
import {cadFaceGeometry,cadFaceGroup} from './face-selection.js';
import {planarFace} from './frames.js';
import {regionFaceGeometry} from './regions.js';

export function rotationToParallelFaces(axis,source,target){
 const from=source.clone().addScaledVector(axis,-source.dot(axis));
 const to=target.clone().addScaledVector(axis,-target.dot(axis));
 const tolerance=1e-6;
 if(source.clone().cross(target).length()<=tolerance)return 0;
 if(from.lengthSq()<tolerance**2||to.lengthSq()<tolerance**2)return null;
 const angle=Math.atan2(axis.dot(from.clone().cross(to)),from.dot(to));
 const opposite=angle>0?angle-Math.PI:angle+Math.PI;
 for(const candidate of [angle,opposite].sort((a,b)=>Math.abs(a)-Math.abs(b))){
  if(source.clone().applyAxisAngle(axis,candidate).cross(target).length()<=tolerance)return candidate;
 }
 return null;
}

export function movePlanarFace(hit){
 const mesh=hit.object,geometry=mesh.geometry,group=cadFaceGroup(geometry,hit.faceIndex);
 if(group?.cylinder||group&&geometry.userData.planarFaces&&!geometry.userData.planarFaces.includes(group.faceId))return null;
 const position=cadPosition(geometry),{a,b,c}=hit.face;
 const points=[a,b,c].map(i=>new THREE.Vector3().fromBufferAttribute(position,i));
 const localNormal=new THREE.Triangle(...points).getNormal(new THREE.Vector3());
 if(!localNormal.lengthSq())return null;
 const key=mesh.uuid+':'+(group?.faceId??[...localNormal.toArray(),localNormal.dot(points[0])].map(value=>Math.round(value*1e6)).join(','));
 return {key,mesh,get normal(){
  mesh.updateWorldMatrix(true,false);
  return localNormal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
 },outline:()=>group?cadFaceGeometry(geometry,group):regionFaceGeometry(planarFace(geometry,hit.faceIndex))};
}
