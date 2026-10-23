import * as THREE from 'three';

// Keep the picked profile anchored in screen space and retain the current zoom.
export function extrusionObliqueView(camera,target,normal,pivot,{threshold=8}={}){
 const axis=normal.clone().normalize(),direction=camera.getWorldDirection(new THREE.Vector3());
 if(!axis.lengthSq()||Math.abs(direction.dot(axis))<Math.cos(threshold*Math.PI/180))return null;
 const facing=axis.multiplyScalar(direction.dot(axis)<0?1:-1),desired=new THREE.Vector3(1,-1.3,1).normalize();
 if(desired.dot(facing)<0)desired.addScaledVector(facing,-2*desired.dot(facing));
 if(desired.dot(facing)>.85||desired.dot(facing)<.3){const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);desired.copy(facing).multiplyScalar(1.3).add(right).add(up).normalize();}
 const view=camera.clone();view.position.copy(desired);view.up.set(0,0,1);view.lookAt(new THREE.Vector3());const rotation=view.quaternion.multiply(camera.quaternion.clone().invert()),rotate=point=>point.clone().sub(pivot).applyQuaternion(rotation).add(pivot),angle=Math.acos(Math.min(1,desired.dot(facing)))*180/Math.PI;
 return {position:rotate(camera.position),target:rotate(target),up:new THREE.Vector3(0,0,1),angle,style:'isometric'};
}
