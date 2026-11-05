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
 const normal=new THREE.Triangle(...[a,b,c].map(i=>new THREE.Vector3().fromBufferAttribute(position,i)))
  .getNormal(new THREE.Vector3()).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
 if(!normal.lengthSq())return null;
 return {normal,mesh,outline:()=>group?cadFaceGeometry(geometry,group):regionFaceGeometry(planarFace(geometry,hit.faceIndex))};
}
