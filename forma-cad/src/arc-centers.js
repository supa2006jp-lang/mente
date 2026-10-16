import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
function circleThrough(a,b,c){const u=b.clone().sub(a),v=c.clone().sub(a),w=u.clone().cross(v),denom=2*w.lengthSq();if(denom<1e-14)return null;const center=a.clone().add(w.clone().cross(u).multiplyScalar(v.lengthSq()/denom)).add(v.clone().cross(w).multiplyScalar(u.lengthSq()/denom));return {center,radius:center.distanceTo(a),normal:w.normalize()};}
// Recognize circular portions of mixed outlines, including rims split by joins.
export function arcCenters(geometry){
 const attr=cadPosition(geometry);if(!attr)return [];
 const nodes=new Map(),segments=[],result=[],used=new Set();
 const node=p=>{const key=p.toArray().map(v=>Math.round(v*1e4)).join(',');if(!nodes.has(key))nodes.set(key,{p,edges:[]});return nodes.get(key);};
 for(let i=0;i<attr.count;i+=2){const a=node(new THREE.Vector3().fromBufferAttribute(attr,i)),b=node(new THREE.Vector3().fromBufferAttribute(attr,i+1));if(a===b)continue;const edge={a,b};segments.push(edge);a.edges.push(edge);b.edges.push(edge);}
 for(const middle of nodes.values())for(let i=0;i<middle.edges.length;i++)for(let j=i+1;j<middle.edges.length;j++){
  const first=middle.edges[i],second=middle.edges[j];if(used.has(first)&&used.has(second))continue;
  const a=(first.a===middle?first.b:first.a).p,b=middle.p,c=(second.a===middle?second.b:second.a).p,u=b.clone().sub(a),v=c.clone().sub(a),w=u.clone().cross(v),denom=2*w.lengthSq();if(denom<1e-14)continue;
  let center=a.clone().add(w.clone().cross(u).multiplyScalar(v.lengthSq()/denom)).add(v.clone().cross(w).multiplyScalar(u.lengthSq()/denom)),radius=center.distanceTo(a),normal=w.normalize();const tol=Math.max(.0002,radius*.0002);
  if(radius<.001||radius>100000)continue;
  const matches=p=>Math.abs(p.distanceTo(center)-radius)<tol&&Math.abs(p.clone().sub(center).dot(normal))<tol;
  const found=new Set(),queue=[first,second];let length=0;
  while(queue.length){const e=queue.pop();if(found.has(e)||!matches(e.a.p)||!matches(e.b.p)||e.a.p.distanceTo(e.b.p)>radius*.5)continue;found.add(e);length+=e.a.p.distanceTo(e.b.p);for(const n of [e.a,e.b])for(const next of n.edges)if(!found.has(next))queue.push(next);}
  if(found.size<6||length/radius<.35)continue;
  // A helix is almost circular in a short window, but its bending plane
  // rotates continuously. Genuine circle chords share one plane normal.
  const arcNodes=new Set([...found].flatMap(edge=>[edge.a,edge.b])),points=[...arcNodes].map(node=>node.p),start=points[0],far=points.reduce((best,p)=>p.distanceToSquared(start)>best.distanceToSquared(start)?p:best),axis=far.clone().sub(start),third=points.reduce((best,p)=>p.clone().sub(start).cross(axis).lengthSq()>best.clone().sub(start).cross(axis).lengthSq()?p:best),refined=circleThrough(start,far,third);
  if(!refined||points.some(p=>Math.abs(p.distanceTo(refined.center)-refined.radius)>tol||Math.abs(p.clone().sub(refined.center).dot(refined.normal))>tol))continue;
  if(refined.normal.dot(normal)<0)refined.normal.negate();center=refined.center;radius=refined.radius;normal=refined.normal;let planar=true;
  for(const n of arcNodes){
   const connected=n.edges.filter(edge=>found.has(edge));if(connected.length>2){planar=false;break;}
   if(connected.length!==2)continue;
   const ends=connected.map(edge=>(edge.a===n?edge.b:edge.a).p),directions=ends.map(p=>p.clone().sub(n.p)),bend=directions[0].clone().cross(directions[1]);
   if(bend.lengthSq()>1e-16&&Math.abs(bend.normalize().dot(normal))<.99998){planar=false;break;}
   // Boolean joins can split a chord near its endpoint. Such an uneven
   // three-point fit is ill-conditioned; the full arc fit above is reliable.
   const lengths=directions.map(direction=>direction.length());
   if(Math.min(...lengths)<Math.max(...lengths)*.25)continue;
   const local=circleThrough(ends[0],n.p,ends[1]);if(local&&local.center.distanceTo(center)>Math.max(tol*8,radius*.002)){planar=false;break;}
  }
  if(!planar)continue;
  for(const e of found)used.add(e);
  if(!result.some(r=>new THREE.Vector3(...r.point).distanceTo(center)<tol*4))result.push({point:center.toArray(),normal:normal.toArray(),name:'円・円弧',kind:'center'});
 }
 return result;
}
