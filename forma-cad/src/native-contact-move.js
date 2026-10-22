import * as THREE from 'three';
import {cadMesh} from './cad-mesh.js';
import {faceMoveContact} from './face-move-contact.js';

// Render buffers are Float32, including legacy/raw bodies. Resolve the final
// planar contact from native doubles for every member of the rigid selection.
export function resolveContactMove(bodies,spec,onProgress){
 const request=spec.contactMove,ids=[...new Set(spec.targets||[spec.target])],selected=new Set(ids);
 if(spec.reverseCopy||!request||!Array.isArray(request.normal)||request.normal.length!==3||request.normal.some(v=>!Number.isFinite(v))||Math.hypot(...request.normal)<1e-8||!Array.isArray(request.start)||request.start.length!==3||request.start.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)||!Array.isArray(request.obstacles)||!request.obstacles.length||request.obstacles.length>100||request.obstacles.some(id=>!bodies.has(id)||selected.has(id))||ids.some(id=>!bodies.has(id)))throw Error('接触移動の対象を選び直してください');
 const source=new THREE.Group(),targets=[],geometries=[];
 function mesh(shape,id){const data=cadMesh(shape),g=new THREE.BufferGeometry();geometries.push(g);g.setAttribute('position',new THREE.BufferAttribute(new Float64Array(data.vertices),3));g.setIndex(data.triangles);const m=new THREE.Mesh(g,null);m.userData.bodyId=id;return m;}
 try{
  onProgress?.({stage:'CADの精密な座標で接触位置を確認しています'});
  for(const id of ids){let shape=bodies.get(id).clone();try{
   for(let i=0;i<3;i++)if(spec.rotation?.[i]){const rotated=shape.rotate(spec.rotation[i],spec.pivot||[0,0,0],[[1,0,0],[0,1,0],[0,0,1]][i]);if(rotated!==shape)shape.delete();shape=rotated;}
   const m=mesh(shape,id);m.position.fromArray(request.start);source.add(m);
  }finally{shape.delete();}}
  for(const id of new Set(request.obstacles))targets.push(mesh(bodies.get(id),id));
  const hit=faceMoveContact(source,targets,request.normal,{allowTouching:true});if(!hit)throw Error('その方向に接触する別ボディがありません。移動方向を選び直してください');
  const translation=request.start.map((v,i)=>v+hit.translation[i]);if(translation.some(v=>!Number.isFinite(v)||Math.abs(v)>10000))throw Error('接触位置が移動できる範囲を超えています');
  return {transform:{x:translation[0],y:translation[1],z:translation[2]},target:hit.mesh.userData.bodyId,distance:hit.distance};
 }finally{geometries.forEach(g=>g.dispose());}
}
