import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';

const cached=new WeakMap(),key=p=>p.toArray().map(v=>Math.round(v*1e4)).join(',');
// Circular fitting may split a helix into many short arcs. Join only smooth,
// unbranched arc-to-arc boundaries; actual corners and line endpoints remain.
export function smoothEdgeChains(geometry){
 const p=cadPosition(geometry);if(!p)return new Map();
 if(cached.has(geometry))return cached.get(geometry);
 const nodes=new Map(),edges=[],result=new Map(),visited=new Set();
 const node=point=>{const id=key(point);if(!nodes.has(id))nodes.set(id,{point,edges:[]});return nodes.get(id);};
 for(let i=0;i<p.count;i+=2){const a=node(new THREE.Vector3().fromBufferAttribute(p,i)),b=node(new THREE.Vector3().fromBufferAttribute(p,i+1));if(a===b)continue;const edge={a,b,index:i,arc:geometry.userData.arcEdges?.get(i)};a.edges.push(edge);b.edges.push(edge);edges.push(edge);}
 const other=(e,n)=>e.a===n?e.b:e.a;
 const next=(e,n)=>{if(n.edges.length!==2)return null;const candidate=n.edges.find(q=>q!==e);if(!e.arc||!candidate.arc)return null;const incoming=other(e,n).point.clone().sub(n.point),outgoing=other(candidate,n).point.clone().sub(n.point);return incoming.normalize().dot(outgoing.normalize())< -Math.cos(.2)?candidate:null;};
 for(const seed of edges){
  if(!seed.arc||visited.has(seed))continue;
  const found=new Set(),queue=[seed];while(queue.length){const e=queue.pop();if(found.has(e))continue;found.add(e);for(const n of [e.a,e.b]){const q=next(e,n);if(q&&!found.has(q))queue.push(q);}}
  for(const e of found)visited.add(e);
  if(new Set([...found].map(e=>e.arc)).size<2)continue;
  const end=[...found].flatMap(e=>[e.a,e.b].filter(n=>!next(e,n)).map(n=>({edge:e,node:n})))[0];
  let current=end?.node||seed.a,edge=end?.edge||seed;const points=[current.point.toArray()],chain=[],ordered=new Set();
  do{chain.push(edge);ordered.add(edge);current=other(edge,current);points.push(current.point.toArray());edge=next(edge,current);}while(edge&&!ordered.has(edge));
  if(chain.length!==found.size)continue;
  // Keep genuine planar circular-arc boundaries (including tangent arcs with
  // different radii). The fragmented curves recovered here are non-planar.
  const origin=new THREE.Vector3(...points[0]),span=new THREE.Vector3(),normal=new THREE.Vector3();
  for(const p of points){const delta=new THREE.Vector3(...p).sub(origin);if(delta.lengthSq()>span.lengthSq())span.copy(delta);}
  for(const p of points){const cross=span.clone().cross(new THREE.Vector3(...p).sub(origin));if(cross.lengthSq()>normal.lengthSq())normal.copy(cross);}
  normal.normalize();if(points.every(p=>Math.abs(new THREE.Vector3(...p).sub(origin).dot(normal))<.0002))continue;
  let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(...points[i].map((v,j)=>v-points[i-1][j]));
  const curve={points,length,key:chain.reduce((min,e)=>Math.min(min,e.index),Infinity)+':'+chain.length,closed:!end};
  for(const e of chain)result.set(e.index,curve);
 }
 cached.set(geometry,result);return result;
}
