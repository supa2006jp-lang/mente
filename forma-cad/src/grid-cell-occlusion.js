import * as THREE from 'three';
import {basisFor} from './frames.js';

function clipPolygon(points,distance){
 const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=distance(a),db=distance(b);if(da>=0)result.push(a);if((da>=0)!==(db>=0))result.push(a.clone().lerp(b,da/(da-db)));}return result;
}
// Project only triangles between the working grid and the camera. Their union
// is the part of the cell hidden by solids, including diagonal cut boundaries.
export function gridCellOccluders(face,point,step,meshes,camera,{shift=new THREE.Vector3(),displayOffset=()=>new THREE.Vector3()}={}){
 const basis=basisFor(face),direction=camera.getWorldDirection(new THREE.Vector3()),denominator=direction.dot(basis.n),offset=face.offset+shift.dot(basis.n),sign=Math.sign(-denominator);
 if(Math.abs(denominator)<1e-8)return [];
 const distance=p=>(p.dot(basis.n)-offset)*sign,cellMin=point.map(v=>Math.floor(v/step)*step),cellMax=cellMin.map(v=>v+step),polygons=[];
 const project=p=>{let q;if(camera.isPerspectiveCamera){const ray=p.clone().sub(camera.position),scale=(offset-camera.position.dot(basis.n))/ray.dot(basis.n);q=camera.position.clone().addScaledVector(ray,scale);}else q=p.clone().addScaledVector(direction,(offset-p.dot(basis.n))/denominator);q.sub(shift);return new THREE.Vector3(q.dot(basis.u),q.dot(basis.v),0);};
 for(const mesh of meshes){
  if(!mesh.visible)continue;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(materials.every(m=>m.visible===false||m.depthWrite===false))continue;
  mesh.updateWorldMatrix(true,false);const displacement=displayOffset(mesh.userData.bodyId),position=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:position.count,at=i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld).add(displacement);
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox,corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).add(displacement));if(Math.max(...corners.map(distance))<=.02)continue;
  if(!camera.isPerspectiveCamera){const projected=corners.map(project);if([0,1].some(axis=>Math.max(...projected.map(p=>p.getComponent(axis)))<=cellMin[axis]||Math.min(...projected.map(p=>p.getComponent(axis)))>=cellMax[axis]))continue;}
  for(let i=0;i<count;i+=3){
   const triangle=[at(i),at(i+1),at(i+2)];
   // Coplanar supporting faces must remain available for extrusion. Match the
   // small surface offset used to draw the purple grid without self-occlusion.
   if(Math.max(...triangle.map(distance))<=.02)continue;
   let polygon=clipPolygon(triangle,distance);for(const plane of materials[0].clippingPlanes||[]){polygon=clipPolygon(polygon,p=>plane.distanceToPoint(p));if(!polygon.length)break;}if(polygon.length<3)continue;
   polygon=polygon.map(project);if(polygon.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
   if([0,1].some(axis=>Math.max(...polygon.map(p=>p.getComponent(axis)))<=cellMin[axis]||Math.min(...polygon.map(p=>p.getComponent(axis)))>=cellMax[axis]))continue;
   // Clip each triangle to the one requested cell before boolean processing.
   for(const axis of [0,1])for(const edge of [0,1])polygon=clipPolygon(polygon,p=>edge?cellMax[axis]-p.getComponent(axis):p.getComponent(axis)-cellMin[axis]);
   if(polygon.length>=3)polygons.push(polygon.map(p=>[p.x,p.y]));
  }
 }
 return polygons;
}
