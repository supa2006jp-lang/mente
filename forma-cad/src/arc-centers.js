import * as THREE from 'three';
// Recognize circular portions of mixed outlines, including rims split by joins.
export function arcCenters(geometry){
 const attr=geometry?.attributes.position;if(!attr)return [];
 const nodes=new Map(),segments=[],result=[],used=new Set();
 const node=p=>{const key=p.toArray().map(v=>Math.round(v*1e4)).join(',');if(!nodes.has(key))nodes.set(key,{p,edges:[]});return nodes.get(key);};
 for(let i=0;i<attr.count;i+=2){const a=node(new THREE.Vector3().fromBufferAttribute(attr,i)),b=node(new THREE.Vector3().fromBufferAttribute(attr,i+1));if(a===b)continue;const edge={a,b};segments.push(edge);a.edges.push(edge);b.edges.push(edge);}
 for(const middle of nodes.values())for(let i=0;i<middle.edges.length;i++)for(let j=i+1;j<middle.edges.length;j++){
  const first=middle.edges[i],second=middle.edges[j];if(used.has(first)&&used.has(second))continue;
  const a=(first.a===middle?first.b:first.a).p,b=middle.p,c=(second.a===middle?second.b:second.a).p,u=b.clone().sub(a),v=c.clone().sub(a),w=u.clone().cross(v),denom=2*w.lengthSq();if(denom<1e-14)continue;
  const center=a.clone().add(w.clone().cross(u).multiplyScalar(v.lengthSq()/denom)).add(v.clone().cross(w).multiplyScalar(u.lengthSq()/denom)),radius=center.distanceTo(a),normal=w.normalize(),tol=Math.max(.0002,radius*.0002);
  if(radius<.001||radius>100000)continue;
  const matches=p=>Math.abs(p.distanceTo(center)-radius)<tol&&Math.abs(p.clone().sub(center).dot(normal))<tol;
  const found=new Set(),queue=[first,second];let length=0;
  while(queue.length){const e=queue.pop();if(found.has(e)||!matches(e.a.p)||!matches(e.b.p)||e.a.p.distanceTo(e.b.p)>radius*.5)continue;found.add(e);length+=e.a.p.distanceTo(e.b.p);for(const n of [e.a,e.b])for(const next of n.edges)if(!found.has(next))queue.push(next);}
  if(found.size<6||length/radius<.35)continue;
  for(const e of found)used.add(e);
  if(!result.some(r=>new THREE.Vector3(...r.point).distanceTo(center)<tol*4))result.push({point:center.toArray(),normal:normal.toArray(),name:'円・円弧',kind:'center'});
 }
 return result;
}
