import * as THREE from 'three';
export function cadFaceGroup(geometry,faceIndex){return geometry.userData.faceGroups?.find(f=>faceIndex*3>=f.start&&faceIndex*3<f.start+f.count);}
export function cadFaceKey(bodyId,group){return bodyId+':face:'+group.faceId;}
export function cadFaceGeometry(geometry,group){
 const p=geometry.attributes.position,ix=geometry.index,positions=[];
 for(let i=group.start;i<group.start+group.count;i++){const k=ix?ix.getX(i):i;positions.push(p.getX(k),p.getY(k),p.getZ(k));}
 const selected=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));selected.computeVertexNormals();return selected;
}
export function isFaceSelected(selectedFaces,hit){
 const bodyId=hit.object.userData.bodyId,group=cadFaceGroup(hit.object.geometry,hit.faceIndex);
 // Adjacent CAD faces can be closer than the mesh tolerance, especially at pipe caps.
 if(group)return selectedFaces.some(f=>f.key===cadFaceKey(bodyId,group));
 return selectedFaces.some(f=>{if(f.bodyId!==bodyId)return false;const p=f.geometry.attributes.position,ix=f.geometry.index;for(let i=0;i<(ix?.count??p.count);i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k));if(new THREE.Triangle(...points).closestPointToPoint(hit.point,new THREE.Vector3()).distanceTo(hit.point)<.001)return true;}return false;});
}
