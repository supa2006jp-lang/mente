import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
function direction(a,b){const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta);if(!Number.isFinite(length)||length<1e-6)throw Error('始点と終点は異なる位置を指定してください');return delta.map(v=>v/length);}
// Preview uses retained CAD vertex coordinates; final placement measures the
// native curved surfaces, so tessellation cannot leave a body outside the ends.
export function meshPatternExtent(object,a,b,anchor){
 const axis=new THREE.Vector3(...direction(a,b)),center=new THREE.Vector3(...anchor).dot(axis),point=new THREE.Vector3();let min=Infinity,max=-Infinity;
 object.updateWorldMatrix(true,true);object.traverse(mesh=>{if(!mesh.isMesh)return;const positions=cadPosition(mesh.geometry);if(!positions)return;for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);const value=point.dot(axis)-center;min=Math.min(min,value);max=Math.max(max,value);}});
 return {min,max};
}
export function solidPatternExtent(base,a,b,anchor){
 const axis=direction(a,b),cross=[0,axis[2],-axis[1]],length=Math.hypot(...cross),angle=Math.acos(Math.max(-1,Math.min(1,axis[0])))*180/Math.PI;let rotated,box;
 try{
  rotated=base.clone();if(angle>1e-9)rotated=rotated.rotate(angle,[0,0,0],length>1e-10?cross.map(v=>v/length):[0,1,0]);box=rotated.boundingBox;
  const center=anchor.reduce((sum,v,i)=>sum+v*axis[i],0),bounds=box.bounds;return {min:bounds[0][0]-center,max:bounds[1][0]-center};
 }finally{box?.delete();rotated?.delete();}
}
