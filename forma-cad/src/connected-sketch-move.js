import * as THREE from 'three';
import {solveSketchConstraints} from './sketch-constraints.js';
import {basisFor} from './frames.js';
import {pipeWorldPoints} from './pipe-path.js';
import {sketchEndpoints} from './sketch-endpoint.js';

const EPS=1e-6;
export function connectedMoveSources(features,reference){
 const source=features.find(f=>f.id===reference?.featureId&&f.kind==='sketch'&&!f.groupHidden&&f.profile!=='point');
 if(!source)throw Error('移動するスケッチの線を選択してください');
 const normal=basisFor(source).n,origin=new THREE.Vector3(source.x,source.y,source.z);
 const candidates=features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&f.profile!=='point'&&f.groupId===source.groupId&&Math.abs(basisFor(f).n.dot(normal))>1-1e-8&&Math.abs(new THREE.Vector3(f.x,f.y,f.z).sub(origin).dot(normal))<EPS);
 const entries=candidates.map(f=>({feature:f,points:sketchEndpoints(f)})),buckets=new Map(),cell=p=>p.toArray().map(v=>Math.floor(v/EPS));
 for(const item of entries)for(const point of item.points){const key=cell(point).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({item,point});}
 const ids=new Set([source.id]),pending=[entries.find(e=>e.feature.id===source.id)];
 while(pending.length){const item=pending.pop();for(const point of item.points){const [x,y,z]=cell(point);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const neighbor of buckets.get([x+i,y+j,z+k].join(','))||[]){if(ids.has(neighbor.item.feature.id)||point.distanceToSquared(neighbor.point)>EPS*EPS)continue;ids.add(neighbor.item.feature.id);pending.push(neighbor.item);}}}
 return features.filter(f=>ids.has(f.id));
}

export function sketchMoveReferences(sources){
 const refs=[];const add=(point,name)=>{if(!refs.some(r=>r.point.distanceToSquared(point)<EPS*EPS))refs.push({point,name,key:'p'+refs.length});};
 for(const f of sources){sketchEndpoints(f).forEach((p,i)=>add(p,(f.name||'線')+' 端点'+(i+1)));if(f.profile==='circle')add(new THREE.Vector3(f.x,f.y,f.z),(f.name||'円')+' 中心');}
 if(!refs.length&&sources.length){const points=pipeWorldPoints(sources[0]);if(points.length)add(new THREE.Vector3(...points[0]),'基準点');}
 return refs;
}

// Lines/rectangles/circles store their center, whereas spline/polyline points
// are absolute coordinates in their own plane. Translate both representations.
export function translateConnectedSketch(features,sources,delta){
 const ids=new Set(sources.map(f=>f.id));if(!delta?.isVector3||!delta.toArray().every(Number.isFinite)||delta.length()>20000)throw Error('移動距離を確認してください');
 return solveSketchConstraints(features.map(f=>{if(!ids.has(f.id))return f;const next=structuredClone(f),b=basisFor(f);if(Math.abs(delta.dot(b.n))>EPS)throw Error('スケッチの面内で移動してください');next.x+=delta.x;next.y+=delta.y;next.z+=delta.z;if(next.points){const u=delta.dot(b.u),v=delta.dot(b.v);next.points=next.points.map(p=>[p[0]+u,p[1]+v]);}return next;}),{before:features});
}

export function snapSketchMove({point,basis,offset,step,enabled,targets=[],project,tolerance=9}){
 if(!enabled)return {point:point.clone(),kind:null};
 const screen=project(point);let best=null,distance=tolerance;
 for(const target of targets){if(Math.abs(target.point.dot(basis.n)-offset)>EPS)continue;const p=project(target.point),d=Math.hypot(screen.x-p.x,screen.y-p.y);if(p.z>=-1&&p.z<=1&&d<distance){distance=d;best=target;}}
 if(best)return {point:best.point.clone(),kind:'point',name:best.name};
 if(!(step>0&&Number.isFinite(step)))return {point:point.clone(),kind:null};
 const snapped=basis.u.clone().multiplyScalar(Math.round(point.dot(basis.u)/step)*step).addScaledVector(basis.v,Math.round(point.dot(basis.v)/step)*step).addScaledVector(basis.n,offset),p=project(snapped);
 if(Math.hypot(screen.x-p.x,screen.y-p.y)<=tolerance)return {point:snapped,kind:'grid',name:'グリッド交点'};
 return {point:point.clone(),kind:null};
}
