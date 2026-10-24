import * as THREE from 'three';
import {threadCylinderInfo} from './thread-cylinder.js';
import {assemblyTargets} from './assembly-state.js';
import {selectedConnectedPlanarFace} from './cad-planar-face.js';
import {assemblyAnchors,assemblyBasis,assemblyAdjustment} from './assembly-placement.js';
const vector=v=>{try{return new THREE.Vector3(...v.toTuple());}finally{v.delete();}};
const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function assemblyReference(bodies,ref,mode,planeAlignment='center'){
 if(!ref||!valid(ref.point)||!['plane','axis'].includes(mode))throw Error('位置合わせの基準面を選択してください');
 const shape=bodies.get(ref.bodyId);if(!shape)throw Error('基準のボディがありません。面を選び直してください');
 if(mode==='axis'){
  const cylinder=threadCylinderInfo(shape,ref.point);if(!cylinder)throw Error('同軸にする円筒面を選択してください');
  let n=cylinder.normal.clone();const major=[0,1,2].reduce((a,i)=>Math.abs(n.getComponent(i))>Math.abs(n.getComponent(a))?i:a,0);if(n.getComponent(major)<0)n.negate();
  return {...ref,anchor:cylinder.origin.clone().addScaledVector(cylinder.normal,cylinder.height/2).toArray(),normal:n.toArray(),radius:cylinder.radius};
 }
 if(!['center','picked','boundary'].includes(planeAlignment))throw Error('面の位置合わせの基準を選択してください');
 let face;try{face=selectedConnectedPlanarFace(shape,ref);}catch(error){throw Error((error.message||'平面を選び直してください').replace('押し出し元の面','位置合わせする平面'));}
 try{
  const normal=vector(face.normalAt()).normalize(),center=vector(face.center),anchor=planeAlignment!=='picked'?center.clone():new THREE.Vector3(...ref.point);
  anchor.addScaledVector(normal,center.clone().sub(anchor).dot(normal));
  return {...ref,anchor:anchor.toArray(),normal:normal.toArray()};
 }finally{face.delete();}
}
function boundaryAnchor(shape,ref,mode,rotation,basis){
 if(!assemblyAnchors.some(([id])=>id===mode))throw Error('端・角の基準を選択してください');
 if(mode==='center')return ref.anchor;
 const center=new THREE.Vector3(...ref.anchor),matrix=new THREE.Matrix4().makeBasis(basis.u,basis.v,basis.n),toPlane=new THREE.Quaternion().setFromRotationMatrix(matrix).invert().multiply(rotation),euler=new THREE.Euler().setFromQuaternion(toPlane,'ZYX');
 let face=selectedConnectedPlanarFace(shape,ref);const change=fn=>{const next=fn(face);if(next!==face)face.delete();face=next;};
 try{
  change(f=>f.translate(center.clone().negate().toArray()));for(let i=0;i<3;i++)if(euler.toArray()[i])change(f=>f.rotate(euler.toArray()[i]*180/Math.PI,[0,0,0],[[1,0,0],[0,1,0],[0,0,1]][i]));
  const box=face.boundingBox;let bounds;try{bounds=box.bounds;}finally{box.delete();}
  const coordinate=(axis,key)=>mode.includes(key+'-')?bounds[0][axis]:mode.includes(key+'+')?bounds[1][axis]:(bounds[0][axis]+bounds[1][axis])/2;
  return center.add(basis.u.clone().multiplyScalar(coordinate(0,'u')).addScaledVector(basis.v,coordinate(1,'v')).applyQuaternion(rotation.clone().invert())).toArray();
 }finally{face.delete();}
}
export function assemblyPlan(features,bodies,spec){
 const available=new Set(bodies.keys()),targets=assemblyTargets(features,[spec.source?.bodyId],available);
 if(spec.destination?.bodyId&&targets.includes(spec.destination.bodyId))throw Error('すでに一緒に固定された部品です。固定を解除してから位置を合わせてください');
 // Missing metadata identifies saved placements made before center alignment.
 // Preserve those coordinates during replay; new commands explicitly use center.
 const planeAlignment=spec.planeAlignment??'picked';
 let source=assemblyReference(bodies,spec.source,spec.mode,planeAlignment),destination=assemblyReference(bodies,spec.destination,spec.mode,planeAlignment);
 const offset=spec.offset??0;if(!Number.isFinite(offset)||Math.abs(offset)>10000)throw Error('間隔は−10000〜10000 mmで指定してください');
 const n=new THREE.Vector3(...destination.normal),direction=n.clone().multiplyScalar(spec.mode==='plane'&&!spec.flip?-1:1);
 if(spec.mode==='axis'&&spec.flip)direction.negate();
 const basis=assemblyBasis(destination.normal),adjustment=spec.mode==='plane'?assemblyAdjustment(spec):{u:0,v:0,angle:0},align=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...source.normal),direction);
 if(spec.mode==='plane'&&planeAlignment==='boundary'){
  source={...source,anchor:boundaryAnchor(bodies.get(source.bodyId),source,spec.sourceAnchor||'center',align,basis)};
  destination={...destination,anchor:boundaryAnchor(bodies.get(destination.bodyId),destination,spec.destinationAnchor||'center',new THREE.Quaternion(),basis)};
 }
 const quaternion=new THREE.Quaternion().setFromAxisAngle(n,adjustment.angle*Math.PI/180).multiply(align),euler=new THREE.Euler().setFromQuaternion(quaternion,'ZYX');
 const contactAnchor=new THREE.Vector3(...destination.anchor).addScaledVector(n,offset).addScaledVector(basis.u,adjustment.u).addScaledVector(basis.v,adjustment.v),delta=contactAnchor.clone().sub(new THREE.Vector3(...source.anchor));
 return {targets,source,destination,basis:{u:basis.u.toArray(),v:basis.v.toArray(),n:basis.n.toArray()},adjustment,contactAnchor:contactAnchor.toArray(),transform:{rotation:[euler.x,euler.y,euler.z].map(v=>v*180/Math.PI),pivot:source.anchor,x:delta.x,y:delta.y,z:delta.z}};
}
