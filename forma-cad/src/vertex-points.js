import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
const cached=new WeakMap(),key=p=>p.toArray().map(v=>Math.round(v*1e4)).join(',');
// Use displayed boundary edges, never the interior vertices of tessellation triangles.
export function solidVertexPoints(edges){
 if(!edges?.attributes.position)return [];if(cached.has(edges))return cached.get(edges);
 const nodes=new Map(),p=cadPosition(edges),arcEnds=new Map(),seenArcs=new Set();
 const node=point=>{const id=key(point);if(!nodes.has(id))nodes.set(id,{point,neighbors:new Map(),curvedNeighbors:new Set()});return nodes.get(id);};
 const connect=(a,b,curved)=>{if(a.distanceToSquared(b)<1e-10)return;const na=node(a),nb=node(b);na.neighbors.set(key(b),b);nb.neighbors.set(key(a),a);if(curved){na.curvedNeighbors.add(key(b));nb.curvedNeighbors.add(key(a));}};
 for(let i=0;i<p.count;i+=2){
  if(edges.userData.circularEdges?.has(i))continue;
  const arc=edges.userData.arcEdges?.get(i);
  if(arc&&!seenArcs.has(arc)){seenArcs.add(arc);for(const endpoint of [arc.points[0],arc.points.at(-1)]){const precise=new THREE.Vector3(...endpoint);arcEnds.set(key(precise),precise);}}
  // Recover continuity from the whole edge graph. A helix can be approximated
  // by many short arcs; their artificial ends are not physical corner points.
  connect(new THREE.Vector3().fromBufferAttribute(p,i),new THREE.Vector3().fromBufferAttribute(p,i+1),edges.userData.arcEdges?.has(i)===true);
 }
 const result=[];for(const [id,n] of nodes){
  if(arcEnds.has(id))n.point=arcEnds.get(id);
  const directions=[...n.neighbors.values()].map(p=>p.clone().sub(n.point).normalize());
  if(!arcEnds.has(id)&&directions.length>1&&directions.every(d=>Math.abs(d.dot(directions[0]))>.99999))continue;
  if(n.curvedNeighbors.size===2&&directions.length===2&&directions[0].dot(directions[1])< -Math.cos(.2))continue;
  result.push(n.point.toArray());
 }
 cached.set(edges,result);return result;
}
export function screenVertexCandidates(meshes,camera,width,height,x,y,tolerance=14){
 const out=[];camera.updateMatrixWorld(true);
 for(const mesh of meshes){if(!mesh.visible)continue;mesh.updateMatrixWorld(true);
  for(const local of solidVertexPoints(mesh.children[0]?.geometry)){
   const point=new THREE.Vector3(...local).applyMatrix4(mesh.matrixWorld),p=point.clone().project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;
   const distance=Math.hypot((p.x+1)*width/2-x,(1-p.y)*height/2-y);if(distance>tolerance)continue;
   out.push({mesh,point,distance,depth:p.z,reference:{point:point.toArray(),normal:[0,0,1],name:'ソリッド',kind:'vertex',bodyId:mesh.userData.bodyId}});
  }
 }
 return out.sort((a,b)=>Math.abs(a.distance-b.distance)>.25?a.distance-b.distance:a.depth-b.depth);
}
