import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates} from './regions.js';

export function sketchMirrorPlane(source,spec){
 const b=basisFor(source);
 const normal=spec.mirrorNormal||({U:b.v.toArray(),V:b.u.toArray(),XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]})[spec.plane];
 if(!Array.isArray(normal)||normal.length!==3||normal.some(v=>!Number.isFinite(v)))throw Error('ミラーの基準を指定してください');
 const n=new THREE.Vector3(...normal);if(n.length()<1e-8)throw Error('ミラーの基準軸が不正です');n.normalize();
 const origin=spec.mirrorOrigin||[0,0,0],offset=spec.offset??0;
 if(!Array.isArray(origin)||origin.length!==3||origin.some(v=>!Number.isFinite(v))||!Number.isFinite(offset))throw Error('ミラー位置を確認してください');
 return {normal:n,origin:new THREE.Vector3(...origin).addScaledVector(n,offset)};
}

// Keep a right-handed sketch frame and the reflected face normal. Negating
// local V compensates for reflection's reversed handedness without sampling curves.
export function mirrorSketch(source,spec){
 if(source?.kind!=='sketch')throw Error('ミラーするスケッチを選択してください');
 const {normal,origin}=sketchMirrorPlane(source,spec),b=basisFor(source);
 const direction=v=>v.clone().addScaledVector(normal,-2*v.dot(normal));
 const reflect=p=>p.clone().addScaledVector(normal,2*origin.clone().sub(p).dot(normal));
 const next={u:direction(b.u),v:direction(b.v).negate(),n:direction(b.n)};
 const f=structuredClone(source),position=reflect(new THREE.Vector3(f.x,f.y,f.z));
 Object.assign(f,{id:crypto.randomUUID(),name:(f.name||'スケッチ')+' ミラー',plane:'CUSTOM',frame:Object.fromEntries(Object.entries(next).map(([k,v])=>[k,v.toArray()])),x:position.x,y:position.y,z:position.z,angle:-(f.angle||0),groupHidden:false});
 if(['polyline','spline'].includes(f.profile)){
  const offset=planeCoordinates(source).offset;
  f.points=source.points.map(p=>{const w=reflect(worldPoint({...source,offset},p));return [w.dot(next.u),w.dot(next.v)];});
  if(f.tangents)f.tangents=Object.fromEntries(Object.entries(f.tangents).map(([k,a])=>[k,a===null?null:-a]));
  if(f.arc?.endTangent)f.arc.endTangent[1]*=-1;
 }
 if(source.groupHidden||next.n.distanceTo(b.n)>1e-6||Math.abs(position.dot(next.n)-planeCoordinates(source).offset)>1e-5){delete f.groupId;delete f.groupNumber;}
 return f;
}
