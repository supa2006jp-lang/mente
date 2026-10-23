import * as THREE from 'three';

// Keep the picked profile anchored in screen space and retain the current zoom.
export function extrusionObliqueView(camera,target,normal,pivot,{threshold=8,angle=25}={}){
 const axis=normal.clone().normalize(),direction=camera.getWorldDirection(new THREE.Vector3());
 if(!axis.lengthSq()||Math.abs(direction.dot(axis))<Math.cos(threshold*Math.PI/180))return null;
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),rotation=new THREE.Quaternion().setFromAxisAngle(right.multiplyScalar(.8).addScaledVector(up,.6).normalize(),angle*Math.PI/180),rotate=point=>point.clone().sub(pivot).applyQuaternion(rotation).add(pivot);
 return {position:rotate(camera.position),target:rotate(target),up:camera.up.clone().applyQuaternion(rotation),angle};
}
