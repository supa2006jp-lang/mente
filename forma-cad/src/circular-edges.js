import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';

// Recover a closed circular rim from the tessellated display edges.
export function circularEdges(geometry){
 const attr=geometry.attributes.position,nodes=new Map(),segments=[],result=new Map();
 const key=p=>p.toArray().map(v=>Math.round(v*1e4)).join(',');
 const node=p=>{const k=key(p);if(!nodes.has(k))nodes.set(k,{point:p,edges:[]});return nodes.get(k);};
 for(let i=0;i<attr.count;i+=2){const a=node(new THREE.Vector3().fromBufferAttribute(attr,i)),b=node(new THREE.Vector3().fromBufferAttribute(attr,i+1));if(a===b)continue;const s={a,b,index:i};segments.push(s);a.edges.push(s);b.edges.push(s);}
 const visited=new Set();
 for(const first of segments){
  if(visited.has(first))continue;
  const chain=[],points=[],start=first.a;let current=start,edge=first,closed=false;
  while(edge&&!chain.includes(edge)){
   chain.push(edge);points.push(current.point);visited.add(edge);
   const next=edge.a===current?edge.b:edge.a;
   if(next===start){closed=true;break;}
   if(next.edges.length!==2)break;
   current=next;edge=next.edges.find(e=>e!==edge);
  }
  if(!closed||points.length<24)continue;
  const a=points[0],u=points[Math.floor(points.length/3)].clone().sub(a),v=points[Math.floor(points.length*2/3)].clone().sub(a),w=u.clone().cross(v),denom=2*w.lengthSq();
  if(denom<1e-12)continue;
  const center=a.clone().add(w.clone().cross(u).multiplyScalar(v.lengthSq()/denom)).add(v.clone().cross(w).multiplyScalar(u.lengthSq()/denom)),radius=center.distanceTo(a),normal=w.normalize(),tolerance=Math.max(1e-4,radius*1e-4);
  if(radius<1e-5||points.some(p=>Math.abs(p.distanceTo(center)-radius)>tolerance||Math.abs(p.clone().sub(center).dot(normal))>tolerance))continue;
  const polygonLength=points.reduce((sum,p,i)=>sum+p.distanceTo(points[(i+1)%points.length]),0),length=2*Math.PI*radius;
  if(Math.abs(polygonLength-length)>length*.005)continue;
  const circle={radius,length,center:center.toArray(),points:[...points,points[0]].map(p=>p.toArray())};
  for(const segment of chain)result.set(segment.index,circle);
 }
 return result;
}

// CSG can split circular rims at T junctions. Verify a complete rim against
// the original circular feature before restoring its analytic measurement.
export function featureCircularEdges(features,bodyId,geometry){
 const result=geometry.userData.circularEdges||circularEdges(geometry),attr=geometry.attributes.position;
 for(const f of features){
  if(['sketch','plane','cadop'].includes(f.kind)||(f.operation==='new'?f.id!==bodyId:f.target!==bodyId))continue;
  let origin,radius;
  if(f.profile==='circle'){origin=new THREE.Vector3(f.x,f.y,f.z);radius=f.diameter/2;}
  else if(f.profile==='region'&&!f.region.holes.length&&f.region.outer.length>=32){const ps=f.region.outer,center=ps.reduce((sum,p)=>[sum[0]+p[0]/ps.length,sum[1]+p[1]/ps.length],[0,0]);radius=Math.hypot(ps[0][0]-center[0],ps[0][1]-center[1]);if(ps.some(p=>Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-radius)>1e-4))continue;origin=worldPoint(f.region,center);}else continue;
  const basis=basisFor(f),radii=f.mode==='thin'?[radius+(f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0),radius-(f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0)]:[radius];
  for(const height of [0,f.depth])for(const r of radii){
   const center=origin.clone().addScaledVector(basis.n,height),indices=[],angles=[],tolerance=Math.max(.002,r*.001);
   for(let i=0;i<attr.count;i+=2){
    const delta=[0,1].map(k=>new THREE.Vector3().fromBufferAttribute(attr,i+k).sub(center));
    if(delta.some(p=>Math.abs(p.dot(basis.n))>1e-4||Math.abs(p.length()-r)>tolerance))continue;
    const pair=delta.map(p=>Math.atan2(p.dot(basis.v),p.dot(basis.u)));
    if(delta[0].angleTo(delta[1])>.2)continue;
    indices.push(i);angles.push(...pair);
   }
   if(angles.length<48)continue;angles.sort((a,b)=>a-b);
   if(angles.some((a,i)=>(i+1<angles.length?angles[i+1]:angles[0]+Math.PI*2)-a>.15))continue;
   const circle={radius:r,length:2*Math.PI*r,center:center.toArray(),points:Array.from({length:129},(_,i)=>center.clone().addScaledVector(basis.u,r*Math.cos(i/128*Math.PI*2)).addScaledVector(basis.v,r*Math.sin(i/128*Math.PI*2)).toArray())};
   circle.points[128]=[...circle.points[0]];for(const i of indices)result.set(i,circle);
  }
 }
 return result;
}
