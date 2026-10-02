import * as THREE from 'three';

// The body stays in its source pose except when the parts are laid out for
// printing. The lid's optional flipped pose does not move this stop face.
export function coilStopFacePlacement(q,pose,setback=q.stopFaceSetback??0){
 const face=q.stopFacePreview;
 if(!face)return null;
 const beside=pose==='分けて並べる',axis=new THREE.Vector3(...(beside?[0,0,1]:q.axis)).normalize();
 const origin=new THREE.Vector3(...(beside?[q.origin[0],q.origin[1],0]:q.origin));
 const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),axis);
 const hand=q.leftHand?-1:1,co=Math.cos(face.angle),si=Math.sin(face.angle);
 const radial=new THREE.Vector3(co,si,0),normal=new THREE.Vector3(-hand*si,hand*co,0);
 const direction=normal.clone().negate().applyQuaternion(quaternion).normalize();
 const local=(radius,z)=>radial.clone().multiplyScalar(radius).addScaledVector(normal,-setback).setZ(z);
 const world=(radius,z)=>local(radius,z).applyQuaternion(quaternion).add(origin);
 const bottom=q.split-.1,top=q.split+face.height,anchor=world((face.inner+face.outer)/2,(bottom+top)/2);
 const corners=[world(face.inner,bottom),world(face.outer,bottom),world(face.outer,top),world(face.inner,top)];
 return {anchor,direction,corners,min:0,max:1};
}
