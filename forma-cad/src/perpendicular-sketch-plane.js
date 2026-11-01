import * as THREE from 'three';
import {basisFor,validateFrame,worldPoint} from './frames.js';

const tidy=v=>v.map(x=>Math.abs(x)<1e-12?0:Math.abs(Math.abs(x)-1)<1e-12?Math.sign(x):x);
export function perpendicularSketchPlane(face,{axis='v',angle=90,distance=0,reverse=false,anchor=null}={}){
 if(!face?.outer?.length||!['u','v'].includes(axis))throw Error('基準にするソリッドの平面を1つ選択してください');
 if(typeof distance!=='number'||!Number.isFinite(distance)||Math.abs(distance)>10000)throw Error('位置は−10000〜10000 mmで指定してください');
 if(typeof angle!=='number'||!Number.isFinite(angle)||Math.abs(angle)>180)throw Error('角度は−180〜180°で指定してください');
 if(anchor!==null&&(!Array.isArray(anchor)||anchor.length!==3||anchor.some(v=>!Number.isFinite(v)||Math.abs(v)>100000)))throw Error('位置合わせの点が不正です');
 if(typeof reverse!=='boolean'||!Number.isFinite(face.offset)||face.outer.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('基準面の位置が不正です');if(face.frame)validateFrame(face.frame);
 const b=basisFor(face),bounds=[0,1].map(i=>[Math.min(...face.outer.map(p=>p[i])),Math.max(...face.outer.map(p=>p[i]))]),center=worldPoint(face,bounds.map(p=>(p[0]+p[1])/2)),rotation=new THREE.Quaternion().setFromAxisAngle(b[axis],THREE.MathUtils.degToRad(angle)),rotated=Object.fromEntries(['u','v','n'].map(k=>[k,new THREE.Vector3(...tidy(b[k].clone().applyQuaternion(rotation).toArray()))]));
 const reference=anchor?new THREE.Vector3(...anchor):center.clone(),direction=rotated.n.clone(),origin=reference.clone().addScaledVector(direction,distance);if(reverse){rotated.v.negate();rotated.n.negate();}const frame=Object.fromEntries(Object.entries(rotated).map(([k,v])=>[k,tidy(v.toArray())]));validateFrame(frame);
 const offset=origin.dot(rotated.n);if(Math.abs(offset)>10000)throw Error('作図面の位置が原点から10000 mmを超えています');const size=Math.min(500,Math.max(40,...bounds.map(p=>(p[1]-p[0])*1.3))),half=size/2,uv=[origin.dot(rotated.u),origin.dot(rotated.v)],plane={name:'選択面から'+angle+'°の紫グリッド',workingGrid:true,plane:'CUSTOM',frame,offset,anchor:origin.toArray(),outer:[[-half,-half],[half,-half],[half,half],[-half,half]].map(p=>p.map((v,i)=>v+uv[i])),holes:[],area:size*size};
 return {plane,center,reference,origin,direction,size,axis,angle,distance,reverse,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rotated.u,rotated.v,rotated.n))};
}
export function perpendicularPlaneDragValue(raw,{snap=false,step=10,pixelsPerMm=1}={}){
 let value=Math.max(-10000,Math.min(10000,raw)),snapped=false;if(snap&&Number.isFinite(step)&&step>0){const nearest=Math.round(value/step)*step;if(Math.abs(nearest)<=10000&&Math.abs(value-nearest)<=Math.min(step*.2,6/Math.max(.001,pixelsPerMm))){value=nearest;snapped=true;}}return {value:Number(value.toFixed(6)),snapped};
}
