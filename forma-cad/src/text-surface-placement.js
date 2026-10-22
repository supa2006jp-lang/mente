import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
import {cadFaceGroup} from './face-selection.js';

// Use the actual planar face and CAD coordinates, not a curved face's display triangle.
export function textSurfacePlacement(hit,referenceFrame){
 const mesh=hit?.object,geometry=mesh?.geometry;if(!geometry||!Number.isInteger(hit.faceIndex))return null;
 const group=cadFaceGroup(geometry,hit.faceIndex),planar=geometry.userData.planarFaces;
 if(group?.cylinder||group&&planar&&!planar.includes(group.faceId))return null;
 const position=cadPosition(geometry),index=geometry.index,vertex=i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i):i);
 const points=[0,1,2].map(j=>vertex(hit.faceIndex*3+j)),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
 if(normal.lengthSq()<1e-20)return null;normal.normalize();const offset=normal.dot(points[0]);
 for(const part of group?.parts||group&&[group]||[])for(let i=part.start;i<part.start+part.count;i++)if(Math.abs(normal.dot(vertex(i))-offset)>1e-5)return null;
 mesh.updateWorldMatrix(true,false);const n=normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)),a=points[0].applyMatrix4(mesh.matrixWorld),worldOffset=n.dot(a);
 let u=new THREE.Vector3(...referenceFrame.u).addScaledVector(n,-new THREE.Vector3(...referenceFrame.u).dot(n));
 if(u.lengthSq()<1e-10)u=new THREE.Vector3(...referenceFrame.v).cross(n);
 if(u.lengthSq()<1e-10){u=Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);u.addScaledVector(n,-u.dot(n));}
 u.normalize();const v=n.clone().cross(u).normalize(),point=hit.point.clone().addScaledVector(n,worldOffset-n.dot(hit.point));
 return {placement:{plane:'CUSTOM',frame:{u:u.toArray(),v:v.toArray(),n:n.toArray()},offset:worldOffset,bodyId:mesh.userData.bodyId,faceIndex:hit.faceIndex,label:'ソリッドの表面'},point};
}

export function createTextSurfacePicker({camera,canvas,getMeshes=()=>[],getName=id=>id}){
 const ray=new THREE.Raycaster();
 return ({clientX,clientY,frame})=>{
  const rect=canvas.getBoundingClientRect();if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return null;
  const meshes=getMeshes().filter(mesh=>{for(let object=mesh;object;object=object.parent)if(!object.visible)return false;return true;});
  for(const mesh of meshes)mesh.updateWorldMatrix(true,false);
  ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
  const hit=ray.intersectObjects(meshes,false).find(hit=>{const materials=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material],material=materials[hit.face?.materialIndex||0]||materials[0];return !(material?.clippingPlanes||[]).some(plane=>plane.distanceToPoint(hit.point)<-1e-6);});
  const surface=textSurfacePlacement(hit,frame);if(surface){const name=getName(surface.placement.bodyId);surface.placement.label='表面'+(name?'：'+name:'');}return surface;
 };
}

export function textLocalCenter(layout){const x=(layout.localBounds.min[0]+layout.localBounds.max[0])/2,y=(layout.localBounds.min[1]+layout.localBounds.max[1])/2,a=layout.angle*Math.PI/180;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];}
export function textMoveToSurface(layout,surface,{enabled=false,step=0,shift=false}={}){
 const center=textLocalCenter(layout),snap=n=>enabled&&!shift&&step>0?(Math.round(n/step)*step||0):n,coordinate=axis=>surface.point.dot(new THREE.Vector3(...surface.placement.frame[axis]));
 return {u:snap(coordinate('u')-center[0]),v:snap(coordinate('v')-center[1]),height:layout.height,spacing:layout.spacing,scale:1};
}
export function textPlacementMatrix(initial,source,values,target=source){
 const basis=placement=>new THREE.Matrix4().makeBasis(...['u','v','n'].map(key=>new THREE.Vector3(...placement.frame[key])));
 return basis(target).multiply(new THREE.Matrix4().makeTranslation(values.u,values.v,target.offset)).multiply(new THREE.Matrix4().makeRotationZ(((values.angle??initial.angle)-initial.angle)*Math.PI/180)).multiply(new THREE.Matrix4().makeScale(values.scale,values.scale,values.scale)).multiply(new THREE.Matrix4().makeTranslation(-initial.u,-initial.v,-source.offset)).multiply(basis(source).invert());
}
