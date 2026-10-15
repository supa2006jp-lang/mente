import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';

// Reconstruct saved opening picks on the source body, not the generated shell.
export function enclosureSelectionHits(mesh,selections){
 const geometry=mesh.geometry,p=cadPosition(geometry),ix=geometry.index,hits=[];
 for(const selection of selections){
  if(selection.bodyId&&selection.bodyId!==mesh.userData.bodyId)continue;
  const point=new THREE.Vector3(...selection.point),normal=selection.normal&&new THREE.Vector3(...selection.normal);let best=null;
  for(let i=0;i<(ix?.count??p.count);i+=3){
   const [a,b,c]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k)),triangle=new THREE.Triangle(a,b,c),n=triangle.getNormal(new THREE.Vector3());
   if(normal&&n.dot(normal)<.3)continue;
   const closest=triangle.closestPointToPoint(point,new THREE.Vector3()),distance=closest.distanceTo(point);
   if(distance<=.2&&(!best||distance<best.distance))best={object:mesh,faceIndex:i/3,face:{normal:n},point:closest,distance};
  }
  if(best)hits.push(best);
 }
 return hits;
}
