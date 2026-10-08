import * as THREE from 'three';

// Keep the grid axes horizontal/vertical, choosing the up axis closest to the
// current screen-up. A face's V axis can point downward (for example on Y+).
export function sketchViewUp(camera,basis){
 const screenUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 const axis=Math.abs(screenUp.dot(basis.u))>Math.abs(screenUp.dot(basis.v))?basis.u:basis.v;
 return axis.clone().multiplyScalar(screenUp.dot(axis)<0?-1:1);
}
