import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';

const cache=new WeakMap(),epsilon=1e-5;
// Group only planar patches joined along an edge, within one body. A common
// vertex, a nearby parallel shelf or an island across a real gap is not enough.
export function connectedPlanarGroup(geometry,seed){
 const groups=geometry.userData.faceGroups,planar=geometry.userData.planarFaces;
 if(!groups||!planar?.includes(seed.faceId))return seed;
 const position=cadPosition(geometry),index=geometry.index;
 let entry=cache.get(geometry);
 if(!entry||entry.position!==position||entry.version!==position.version||entry.index!==index||entry.indexVersion!==index?.version||entry.groups!==groups||entry.planar!==planar){entry={position,version:position.version,index,indexVersion:index?.version,groups,planar,records:new Map(),results:new Map()};cache.set(geometry,entry);}
 if(entry.results.has(seed))return entry.results.get(seed);
 const point=i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i):i),key=p=>p.toArray().map(n=>Math.round(n/epsilon)).join(',');
 function record(group){
  if(entry.records.has(group))return entry.records.get(group);
  let normal=null,offset=0;
  for(let i=group.start;i<group.start+group.count;i+=3){const p=[point(i),point(i+1),point(i+2)],n=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));if(n.lengthSq()<1e-20)continue;normal=n.normalize();offset=normal.dot(p[0]);break;}
  const r={normal,offset,group,edges:null};entry.records.set(group,r);return r;
 }
 function boundary(record){
  if(record.edges)return record.edges;const edges=new Map(),group=record.group;
  for(let i=group.start;i<group.start+group.count;i+=3){const p=[point(i),point(i+1),point(i+2)];for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],id=[key(a),key(b)].sort().join('|'),existing=edges.get(id);if(existing)existing.count++;else edges.set(id,{a,b,count:1});}}
  return record.edges=[...edges.values()].filter(e=>e.count===1);
 }
 function sharedEdge(a,b){
  for(const x of boundary(a)){const d=x.b.clone().sub(x.a),length=d.length();if(length<=epsilon)continue;d.divideScalar(length);
   for(const y of boundary(b)){const ya=y.a.clone().sub(x.a),yb=y.b.clone().sub(x.a);if(ya.clone().cross(d).length()>epsilon||yb.clone().cross(d).length()>epsilon)continue;const t0=ya.dot(d),t1=yb.dot(d);if(Math.min(length,Math.max(t0,t1))-Math.max(0,Math.min(t0,t1))>epsilon)return true;}
  }return false;
 }
 const first=record(seed);if(!first.normal)return seed;
 const candidates=groups.filter(g=>planar.includes(g.faceId)&&(()=>{const r=record(g);return r.normal&&r.normal.dot(first.normal)>.999999&&Math.abs(r.offset-first.offset)<epsilon;})()),parts=[seed],seen=new Set(parts);
 for(let i=0;i<parts.length;i++)for(const candidate of candidates)if(!seen.has(candidate)&&sharedEdge(record(parts[i]),record(candidate))){seen.add(candidate);parts.push(candidate);}
 parts.sort((a,b)=>a.start-b.start);const result=parts.length>1?{...parts[0],parts,connectedPlanar:true}:seed;for(const part of parts)entry.results.set(part,result);return result;
}
