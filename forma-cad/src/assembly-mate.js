import * as R from 'replicad';
import * as THREE from 'three';
import {threadCylinderInfo} from './thread-cylinder.js';
import {assemblyTargets} from './assembly-state.js';
const vector=v=>{try{return new THREE.Vector3(...v.toTuple());}finally{v.delete();}};
const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function assemblyReference(bodies,ref,mode){
 if(!ref||!valid(ref.point)||!['plane','axis'].includes(mode))throw Error('位置合わせの基準面を選択してください');
 const shape=bodies.get(ref.bodyId);if(!shape)throw Error('基準のボディがありません。面を選び直してください');
 if(mode==='axis'){
  const cylinder=threadCylinderInfo(shape,ref.point);if(!cylinder)throw Error('同軸にする円筒面を選択してください');
  let n=cylinder.normal.clone();const major=[0,1,2].reduce((a,i)=>Math.abs(n.getComponent(i))>Math.abs(n.getComponent(a))?i:a,0);if(n.getComponent(major)<0)n.negate();
  return {...ref,anchor:cylinder.origin.clone().addScaledVector(cylinder.normal,cylinder.height/2).toArray(),normal:n.toArray(),radius:cylinder.radius};
 }
 const faces=shape.faces,point=R.makeVertex(ref.point);
 try{
  const matches=faces.filter(f=>f.geomType==='PLANE').map(face=>({face,distance:R.measureDistanceBetween(point,face),normal:vector(face.normalAt()).normalize()})).filter(f=>!ref.normal||f.normal.dot(new THREE.Vector3(...ref.normal))>.999).sort((a,b)=>a.distance-b.distance);
  if(!matches.length||matches[0].distance>.2)throw Error('平面の中央寄りを選択してください');
  const {face,normal}=matches[0],center=vector(face.center),anchor=new THREE.Vector3(...ref.point);anchor.addScaledVector(normal,center.clone().sub(anchor).dot(normal));
  return {...ref,anchor:anchor.toArray(),normal:normal.toArray()};
 }finally{point.delete();faces.forEach(face=>face.delete());}
}
export function assemblyPlan(features,bodies,spec){
 const available=new Set(bodies.keys()),targets=assemblyTargets(features,[spec.source?.bodyId],available);
 if(spec.destination?.bodyId&&targets.includes(spec.destination.bodyId))throw Error('すでに一緒に固定された部品です。固定を解除してから位置を合わせてください');
 const source=assemblyReference(bodies,spec.source,spec.mode),destination=assemblyReference(bodies,spec.destination,spec.mode);
 const offset=spec.offset??0;if(!Number.isFinite(offset)||Math.abs(offset)>10000)throw Error('間隔は−10000〜10000 mmで指定してください');
 const n=new THREE.Vector3(...destination.normal),direction=n.clone().multiplyScalar(spec.mode==='plane'&&!spec.flip?-1:1);
 if(spec.mode==='axis'&&spec.flip)direction.negate();
 const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...source.normal),direction),euler=new THREE.Euler().setFromQuaternion(quaternion,'ZYX');
 const delta=new THREE.Vector3(...destination.anchor).addScaledVector(n,offset).sub(new THREE.Vector3(...source.anchor));
 return {targets,source,destination,transform:{rotation:[euler.x,euler.y,euler.z].map(v=>v*180/Math.PI),pivot:source.anchor,x:delta.x,y:delta.y,z:delta.z}};
}
