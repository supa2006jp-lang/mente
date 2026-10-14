import * as THREE from 'three';
import {basisFor,validateFrame} from './frames.js';

export const OFFSET_PLANE_SIZE=120;
export const OFFSET_PLANE_OPACITY=.1;
export function offsetPlaneGridFace(feature){
 const basis=basisFor(feature),anchor=feature.anchor?new THREE.Vector3(...feature.anchor):basis.n.clone().multiplyScalar(feature.offset),center=[anchor.dot(basis.u),anchor.dot(basis.v)],half=OFFSET_PLANE_SIZE/2;
 return {...feature,outer:[[-half,-half],[half,-half],[half,half],[-half,half]].map(p=>p.map((value,i)=>value+center[i])),holes:[],area:OFFSET_PLANE_SIZE**2};
}

// Rotate about the preview's centre, rather than the world origin. A plane's
// signed offset must be recomputed against its new normal after tilting it.
export function offsetPlanePlacement(source,distance,angles=[0,0,0],center=null){
 if(!source)throw Error('基準にする平面を選択してください');
 if(!Number.isFinite(distance)||Math.abs(distance)>10000)throw Error('距離は±10000 mm以内で指定してください');
 if(angles.length!==3||angles.some(a=>!Number.isFinite(a)||Math.abs(a)>360))throw Error('角度は−360〜360°で指定してください');
 const basis=basisFor(source),baseOffset=source.offset??0;
 if(source.frame)validateFrame(source.frame);
 if(!Number.isFinite(baseOffset)||Math.abs(baseOffset)>10000)throw Error('基準平面の位置が不正です');
 const baseQuaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.u,basis.v,basis.n));
 const pivot=center?center.clone():source.anchor?new THREE.Vector3(...source.anchor):basis.n.clone().multiplyScalar(baseOffset);
 if(!pivot.toArray().every(Number.isFinite))throw Error('基準平面の中心位置が不正です');
 pivot.addScaledVector(basis.n,baseOffset-pivot.dot(basis.n));
 const origin=pivot.clone().addScaledVector(basis.n,distance);
 const quaternion=baseQuaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles.map(THREE.MathUtils.degToRad),'XYZ'))).normalize();
 const frame=Object.fromEntries([['u',[1,0,0]],['v',[0,1,0]],['n',[0,0,1]]].map(([key,axis])=>[key,new THREE.Vector3(...axis).applyQuaternion(quaternion).toArray()]));
 validateFrame(frame);const offset=origin.dot(new THREE.Vector3(...frame.n));
 if(Math.abs(offset)>10000)throw Error('作図平面の原点からの距離が10000 mmを超えています');
 return {basis,baseQuaternion,pivot,origin,quaternion,frame,offset,distance,angles};
}
export function offsetPlaneFeature(id,state){
 return {kind:'plane',id,name:'オフセット平面',plane:'CUSTOM',frame:state.frame,offset:state.offset,anchor:state.origin.toArray()};
}
