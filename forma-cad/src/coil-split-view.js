import * as THREE from 'three';
// Use the same body placement as makeCoilJoint. The separated print pose
// stands the body on XY; other poses preserve the source axis and origin.
export function coilSplitPlacement(q,pose,position=q.split){
 const beside=pose==='分けて並べる',axis=new THREE.Vector3(...(beside?[0,0,1]:q.axis)).normalize(),origin=new THREE.Vector3(...(beside?[q.origin[0],q.origin[1],0]:q.origin)),z=new THREE.Vector3(0,0,1),rotationAxis=z.clone().cross(axis);if(rotationAxis.lengthSq()<1e-12)rotationAxis.set(1,0,0);rotationAxis.normalize();
 const quaternion=new THREE.Quaternion().setFromAxisAngle(rotationAxis,z.angleTo(axis)),radius=(q.outerRadius||q.radius)*1.12,center=origin.clone().addScaledVector(axis,position),handle=new THREE.Vector3(radius,0,position).applyQuaternion(quaternion).add(origin);
 const min=q.minimumSplit??q.wall+1,tail=q.minimumLidHeight??q.neckLength+q.extension+.2+q.wall,max=(q.auto?10000:q.sourceHeight)-tail;
 return {axis,origin,quaternion,radius,center,handle,min,max:Math.max(min,max)};
}
