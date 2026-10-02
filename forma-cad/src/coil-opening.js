import * as THREE from 'three';
export function coilOpeningLimit(q){return q.neckLength/q.pitch+1;}
export function coilOpening(q,value){
 const turns=Number(value),max=coilOpeningLimit(q);if(!Number.isFinite(turns)||turns<0||turns>max+1e-8)throw Error('開く回転数は0〜'+max.toFixed(2)+'回転で指定してください');
 return {turns,max,angle:(q.leftHand?-1:1)*turns*Math.PI*2,travel:turns*q.pitch};
}
// Geometry is in world coordinates; rotate about the cylinder axis at its origin.
export function coilOpeningTransform(q,value){const opening=coilOpening(q,value),axis=new THREE.Vector3(...q.axis).normalize(),origin=new THREE.Vector3(...q.origin),quaternion=new THREE.Quaternion().setFromAxisAngle(axis,opening.angle),position=origin.clone().sub(origin.clone().applyQuaternion(quaternion)).addScaledVector(axis,opening.travel);return {...opening,position,quaternion};}
