import {Vector3} from 'three';

export function drawingFrontFrame(normal){
 const outward=new Vector3().fromArray(normal).normalize();
 const up=Math.abs(outward.z)>.999999?new Vector3(0,1,0):new Vector3(0,0,1);
 up.addScaledVector(outward,-up.dot(outward)).normalize();
 return {
  u:up.clone().cross(outward).toArray(),
  v:outward.negate().toArray(),
  n:up.toArray(),
 };
}

export function sameDrawingFront(a,b){
 const standard={u:[1,0,0],v:[0,1,0],n:[0,0,1]};
 return ['u','v','n'].every(axis=>(a??standard)[axis].every((value,index)=>
  Math.abs(value-(b??standard)[axis][index])<1e-7));
}
