import * as THREE from 'three';

const cache=new WeakMap();
// Merge touching and overlapping collinear display segments, keeping gaps separate.
export function mergedStraightEdges(geometry){
 const p=geometry?.attributes.position;if(!p)return [];
 const old=cache.get(geometry);if(old&&old.position===p&&old.version===p.version&&old.circles===geometry.userData.circularEdges&&old.arcs===geometry.userData.arcEdges&&old.circleCount===(geometry.userData.circularEdges?.size||0)&&old.arcCount===(geometry.userData.arcEdges?.size||0))return old.edges;
 const groups=[],tolerance=1e-4;
 for(let i=0;i<(p?.count||0);i+=2){
  if(geometry.userData.circularEdges?.has(i)||geometry.userData.arcEdges?.has(i))continue;
  const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),direction=b.clone().sub(a);if(direction.lengthSq()<1e-12)continue;direction.normalize();
  let group=groups.find(g=>Math.abs(g.direction.dot(direction))>1-1e-8&&a.clone().sub(g.origin).cross(g.direction).length()<tolerance&&b.clone().sub(g.origin).cross(g.direction).length()<tolerance);
  if(!group){group={origin:a.clone(),direction,intervals:[]};groups.push(group);}
  const first=a.clone().sub(group.origin).dot(group.direction),last=b.clone().sub(group.origin).dot(group.direction);group.intervals.push([Math.min(first,last),Math.max(first,last)]);
 }
 const edges=[];
 for(const group of groups){
  const merged=[];for(const [start,end]of group.intervals.sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&start<=last[1]+tolerance)last[1]=Math.max(last[1],end);else merged.push([start,end]);}
  for(const [start,end]of merged){const a=group.origin.clone().addScaledVector(group.direction,start),b=group.origin.clone().addScaledVector(group.direction,end);edges.push({a,b,point:a.clone().lerp(b,.5)});}
 }
 cache.set(geometry,{position:p,version:p.version,circles:geometry.userData.circularEdges,arcs:geometry.userData.arcEdges,circleCount:geometry.userData.circularEdges?.size||0,arcCount:geometry.userData.arcEdges?.size||0,edges});return edges;
}

export function mergedEdgeMidpoints(geometry,references){
 if(!geometry?.attributes.position||!references.length)return [];
 return mergedStraightEdges(geometry).filter(({a,b})=>{const direction=b.clone().sub(a),length=direction.length();direction.normalize();return references.some(r=>{const delta=new THREE.Vector3(...r.point).sub(a),along=delta.dot(direction);return along>=-1e-4&&along<=length+1e-4&&delta.cross(direction).length()<1e-4;});}).map(({a,b,point})=>({point:point.toArray(),a:a.toArray(),b:b.toArray(),name:'辺の中点',kind:'midpoint'}));
}
