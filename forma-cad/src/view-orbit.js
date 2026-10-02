import * as THREE from 'three';

// Rotate the whole view about a pivot, preserving its framing and distance.
export function orbitView(start,dx,dy){
 const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-dx*.008);
 const right=start.target.clone().sub(start.position).cross(start.up).normalize().applyQuaternion(yaw);
 const pitch=new THREE.Quaternion().setFromAxisAngle(right,-dy*.008);
 const rotation=pitch.multiply(yaw),pivot=start.origin?new THREE.Vector3():start.target;
 const rotate=p=>p.clone().sub(pivot).applyQuaternion(rotation).add(pivot);
 return {position:rotate(start.position),target:rotate(start.target),up:start.up.clone().applyQuaternion(rotation)};
}
