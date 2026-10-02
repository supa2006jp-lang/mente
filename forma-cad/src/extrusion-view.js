import {Vector3} from 'three';
// Only tilt views within three degrees of the sketch's face-on direction.
export function extrusionView(camera,target,normal){
 const direction=camera.position.clone().sub(target),distance=direction.length();
 if(!distance||Math.abs(direction.clone().normalize().dot(normal))<Math.cos(Math.PI/60))return null;
 const right=new Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new Vector3(0,1,0).applyQuaternion(camera.quaternion);
 // Low oblique view: roughly 14 degrees above the plane, with upright verticals.
 const viewUp=normal.clone().multiplyScalar(Math.sign(direction.dot(normal)));
 const tilted=direction.normalize().addScaledVector(right,-1.2).addScaledVector(up,-3.8).normalize();
 return {position:target.clone().addScaledVector(tilted,distance),up:viewUp};
}
