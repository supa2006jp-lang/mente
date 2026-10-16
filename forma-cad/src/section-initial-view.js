import * as THREE from 'three';

// Nested parts (including a screw inside a clearance hole) need inspection even
// when their material does not intersect. Compare their displayed envelopes;
// opening a section must not run an expensive CAD intersection operation.
export function sectionInitialView(meshes,targetId,normal,offset,camera){
 const target=meshes.get(targetId),bounds=mesh=>{
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  mesh.updateWorldMatrix(true,false);return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
 },volume=box=>{const size=box.getSize(new THREE.Vector3());return size.x*size.y*size.z;};
 if(!target?.visible)return null;
 const base=bounds(target),baseVolume=volume(base);if(!(baseVolume>1e-9))return null;
 let overlap=null,best=0;
 for(const [id,mesh] of meshes){
  if(id===targetId||!mesh.visible)continue;
  const other=bounds(mesh),intersection=base.clone().intersect(other);if(intersection.isEmpty())continue;
  const shared=volume(intersection),smaller=Math.min(baseVolume,volume(other));
  if(smaller>1e-9&&shared>1e-9&&shared/smaller>=.5&&shared>best){best=shared;overlap=intersection;}
 }
 if(!overlap)return null;
 const center=overlap.getCenter(new THREE.Vector3()),half=overlap.getSize(new THREE.Vector3()).multiplyScalar(.5),middle=center.dot(normal),span=Math.abs(normal.x)*half.x+Math.abs(normal.y)*half.y+Math.abs(normal.z)*half.z;
 // Keep the selected section if it already crosses the shared region.
 const position=offset>middle-span+1e-6&&offset<middle+span-1e-6?offset:middle;
 return {offset:position,reverse:normal.dot(camera.getWorldDirection(new THREE.Vector3()))<0};
}
