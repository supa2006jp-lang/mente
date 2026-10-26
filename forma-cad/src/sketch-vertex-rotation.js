import * as THREE from 'three';import {basisFor,worldPoint} from './frames.js';import {findRegions,planeCoordinates} from './regions.js';import {sketchEndpoints} from './sketch-endpoint.js';
const EPS=1e-5;
export function sketchRotationCenter(selection){
 const points=selection?.region?.outer;if(!points?.length)throw Error('回転する枠がありません');
 const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const p of points)for(let i=0;i<2;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
 return worldPoint(selection.region,min.map((v,i)=>(v+max[i])/2));
}
export function sketchVertexRotationCandidates(features){
 const visible=features.filter(f=>f.kind==='sketch'&&!f.groupHidden),regions=findRegions(visible),candidates=[];
 for(const f of visible){if(f.textOutline||f.profile==='circle')continue;for(const point of sketchEndpoints(f)){
  const matches=regions.filter(r=>r.sourceIds.includes(f.id)&&[r.outer,...r.holes].some(ring=>ring.some(p=>worldPoint(r,p).distanceTo(point)<EPS))).sort((a,b)=>a.area-b.area);if(!matches.length)continue;
  const region=matches[0],sources=visible.filter(s=>region.sourceIds.includes(s.id));if(!sources.length||sources.some(s=>s.textOutline))continue;
  if(candidates.some(c=>c.point.distanceTo(point)<EPS&&c.region.id===region.id))continue;candidates.push({point:point.clone(),normal:basisFor(f).n,region,sources});
 }}return candidates;
}
export function rotateSketchAtVertex(features,selection,degrees){
 if(!selection?.sources?.length||!selection.point?.isVector3||!selection.normal?.isVector3||!Number.isFinite(degrees)||Math.abs(degrees)>360)throw Error('回転角度は−360〜360°で入力してください');
 const ids=new Set(selection.sources.map(f=>f.id)),normal=selection.normal.clone().normalize(),pivot=selection.point,q=new THREE.Quaternion().setFromAxisAngle(normal,degrees*Math.PI/180),rotate=p=>p.clone().sub(pivot).applyQuaternion(q).add(pivot);
 return features.map(f=>{if(!ids.has(f.id))return f;const next=structuredClone(f),b=basisFor(f),sign=b.n.dot(normal);if(Math.abs(sign)<1-1e-8)throw Error('同じ作図平面の枠を選択してください');const center=rotate(new THREE.Vector3(f.x,f.y,f.z));Object.assign(next,{x:center.x,y:center.y,z:center.z});const angle=degrees*(sign<0?-1:1);next.angle=((f.angle||0)+angle)%360;
  if(next.points){const offset=planeCoordinates(f).offset;next.points=f.points.map(p=>{const v=rotate(worldPoint({...f,offset},p));return [v.dot(b.u),v.dot(b.v)];});if(next.tangents)for(const key of Object.keys(next.tangents))if(next.tangents[key]!==null)next.tangents[key]=((next.tangents[key]+angle+540)%360)-180;if(next.arc?.endTangent){const a=angle*Math.PI/180,[x,y]=next.arc.endTangent;next.arc.endTangent=[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];}}
  return next;
 });
}
