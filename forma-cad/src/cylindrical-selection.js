import * as THREE from 'three';
import {cadFaceGroup,cadFaceGeometry} from './face-selection.js';
import {matchingExtrusionWall} from './extrusion-circular-walls.js';

// Recover cylindrical faces before treating tessellated walls as planar patches.
export function cylindricalSelection(features,bodyId,geometry,faceIndex,point){
 const pos=geometry.attributes.position,index=geometry.index;
 const vertex=i=>new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i):i);
 const normalAt=i=>{const a=vertex(i),b=vertex(i+1),c=vertex(i+2);return b.sub(a).cross(c.sub(a)).normalize();};
 const hitNormal=normalAt(faceIndex*3);
 const planar=geometry.userData.planarFaces;
 let group=cadFaceGroup(geometry,faceIndex);
 if(group?.cylinder)return {geometry:cadFaceGeometry(geometry,group),...group.cylinder};
 let cylinder=null;
 for(const f of [...features].reverse()){
  if(f.kind==='sketch'||f.kind==='plane'||f.kind==='cadop'||(f.operation==='new'?f.id!==bodyId:f.target!==bodyId))continue;
  const wall=matchingExtrusionWall(f,point,hitNormal);if(!wall)continue;
  const radial=point.clone().sub(wall.origin);radial.addScaledVector(wall.axis,-radial.dot(wall.axis));
  cylinder={...wall,internal:hitNormal.dot(radial)<0};break;
 }
 if(!cylinder&&!(group&&planar&&!planar.includes(group.faceId)))return null;
 // A legacy faceted cylinder spans many planar CAD faces.
 if(cylinder&&planar?.includes(group?.faceId))group=null;
 const positions=[];
 for(let i=group?.start||0,end=group?group.start+group.count:(index?index.count:pos.count);i<end;i+=3){
  if(group){if(i<group.start||i>=group.start+group.count)continue;}
  else{
   const {origin,axis,radius,min,max,tolerance}=cylinder;
   if(Math.abs(normalAt(i).dot(axis))>.05)continue;
   if(![0,1,2].every(k=>{const d=vertex(i+k).sub(origin),h=d.dot(axis);return h>=min-tolerance&&h<=max+tolerance&&Math.abs(d.addScaledVector(axis,-h).length()-radius)<=tolerance;}))continue;
  }
  for(let k=0;k<3;k++)positions.push(...vertex(i+k).toArray());
 }
 if(!positions.length)return null;
 const highlight=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 highlight.computeVertexNormals();
 return {geometry:highlight,internal:cylinder?.internal,radius:cylinder?.radius};
}
