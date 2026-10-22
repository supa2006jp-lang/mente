import {cadPosition,retainCadCoordinates} from './cad-coordinates.js';
import * as THREE from 'three';
import {connectedPlanarGroup} from './connected-planar-faces.js';
import {continuousCylinderGroup} from './continuous-cylinder-faces.js';
import {facetedCylinderGroup,meshCylinderGroup} from './faceted-cylinder-faces.js';
export function cadFaceGroup(geometry,faceIndex){if(!geometry.userData.faceGroups?.length)return meshCylinderGroup(geometry,faceIndex);const group=geometry.userData.faceGroups.find(f=>faceIndex*3>=f.start&&faceIndex*3<f.start+f.count);if(!group)return undefined;const curved=continuousCylinderGroup(geometry,group),surface=curved.cylinder?curved:facetedCylinderGroup(geometry,group);return surface.cylinder?surface:connectedPlanarGroup(geometry,surface);}
export function cadFaceKey(bodyId,group){return bodyId+':face:'+group.faceId;}
export function cadFaceGeometry(geometry,group){
 const p=cadPosition(geometry),ix=geometry.index,positions=[];
 for(const part of group.parts||[group])for(let i=part.start;i<part.start+part.count;i++){const k=ix?ix.getX(i):i;positions.push(p.getX(k),p.getY(k),p.getZ(k));}
 const selected=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));retainCadCoordinates(selected,positions);selected.computeVertexNormals();return selected;
}
export function cadFaceSelections(geometry,group){
 if(!group?.parts||group.parts.length<2)return undefined;
 const p=cadPosition(geometry),ix=geometry.index;
 return group.parts.map(part=>{const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(part.start+j):part.start+j)),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();return {point:a.add(b).add(c).multiplyScalar(1/3).toArray(),normal:normal.toArray()};});
}
export function isFaceSelected(selectedFaces,hit){
 const bodyId=hit.object.userData.bodyId,group=cadFaceGroup(hit.object.geometry,hit.faceIndex);
 // Adjacent CAD faces can be closer than the mesh tolerance, especially at pipe caps.
 if(group)return selectedFaces.some(f=>f.key===cadFaceKey(bodyId,group));
 return selectedFaces.some(f=>{if(f.bodyId!==bodyId)return false;const p=cadPosition(f.geometry),ix=f.geometry.index;for(let i=0;i<(ix?.count??p.count);i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k));if(new THREE.Triangle(...points).closestPointToPoint(hit.point,new THREE.Vector3()).distanceTo(hit.point)<.001)return true;}return false;});
}
