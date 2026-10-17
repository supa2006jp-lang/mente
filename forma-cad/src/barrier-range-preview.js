import * as THREE from 'three';
import {makeGeometry} from './geometry.js';

// Immediate requested volume, without doing obstacle offsets or booleans.
// Exact barrier results replace this guide after the prepared preview finishes.
export function barrierRangePreview(batch){
 const group=new THREE.Group();group.userData.barrierRangePreview=true;
 try{
  for(const feature of batch){
   const geometry=makeGeometry(feature),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x47bdd3,transparent:true,opacity:.12,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
   mesh.renderOrder=4;group.add(mesh);
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,25),new THREE.LineBasicMaterial({color:0x1598b3,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));edges.renderOrder=5;mesh.add(edges);
  }
  return group;
 }catch(error){disposeBarrierRange(group);throw error;}
}
export function disposeBarrierRange(group){
 group.traverse(item=>{item.geometry?.dispose();for(const material of [].concat(item.material||[]))material.dispose();});group.removeFromParent();
}
export function clearBarrierRangePreview(parent){
 for(const child of [...parent.children])if(child.userData.barrierRangePreview)disposeBarrierRange(child);
}
export function barrierPreviewAction({barrier,manual=false,force=false,dragging=false}){
 return !barrier?'normal':manual&&!force?'manual':dragging?'range':'calculate';
}
