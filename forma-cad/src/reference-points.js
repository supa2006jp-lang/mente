import * as THREE from 'three';
import {arcCenters} from './arc-centers.js';
export function solidReferencePoints(geometry, edges) {
 const p=geometry.attributes.position,ix=geometry.index,normals=geometry.attributes.normal,planes=[];
 const point=i=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i),groups=new Map(),refs=[];
 for(let i=0;i<(ix?.count??p.count);i+=3){
  const faceGroup=geometry.userData.faceGroups?.find(g=>i>=g.start&&i<g.start+g.count);if(faceGroup&&geometry.userData.planarFaces&&!geometry.userData.planarFaces.includes(faceGroup.faceId))continue;
  const a=point(i),b=point(i+1),c=point(i+2),cross=b.clone().sub(a).cross(c.clone().sub(a)),area=cross.length()/2;
  if(area<1e-8)continue;const n=cross.normalize();
  const smooth=!!(normals&&[0,1,2].some(j=>Math.abs(new THREE.Vector3().fromBufferAttribute(normals,ix?ix.getX(i+j):i+j).dot(n))<.99999));
  const key=[...n.toArray(),n.dot(a)].map(v=>Math.round(v*1e4)).join(',');
  const g=groups.get(key)||{sum:new THREE.Vector3(),area:0,normal:n,offset:n.dot(a),vertices:new Set(),smooth:false};g.smooth ||= smooth;for(const v of [a,b,c])g.vertices.add(v.toArray().map(x=>Math.round(x*1e4)).join(','));g.sum.add(a.add(b).add(c).multiplyScalar(area/3));g.area+=area;groups.set(key,g);
 }
 // Mesh facets along a curved surface are not independent selectable face centers.
 for(const g of groups.values()){const smoothNeighbors=[...groups.values()].filter(h=>{const dot=g.normal.dot(h.normal);return h!==g&&dot>.95&&dot<.999999&&[...g.vertices].some(v=>h.vertices.has(v));});if(g.smooth||smoothNeighbors.length>=1)continue;planes.push(g);refs.push({point:g.sum.divideScalar(g.area).toArray(),normal:g.normal.toArray(),name:'ソリッド面',kind:'center'});}
 const ep=edges.attributes.position,segments=[];
 for(let i=0;i<ep.count;i+=2)segments.push([new THREE.Vector3().fromBufferAttribute(ep,i),new THREE.Vector3().fromBufferAttribute(ep,i+1)]);
 const near=(a,b)=>a.distanceToSquared(b)<1e-8;
 for(const [a,b] of segments){
  // A selectable straight edge must belong to two actual planar surfaces.
  // Circular rims have one planar side and one curved side, so are excluded.
  const adjacent=planes.filter(g=>[a,b].every(p=>Math.abs(g.normal.dot(p)-g.offset)<1e-4));
  if(!adjacent.some(g=>adjacent.some(h=>Math.abs(g.normal.dot(h.normal))<.88)))continue;
  const direction=b.clone().sub(a).normalize();
  const curved=[a,b].every(end=>segments.some(([u,v])=>{const other=near(end,u)?v:near(end,v)?u:null;if(!other||near(other,a)||near(other,b))return false;const dot=Math.abs(other.clone().sub(end).normalize().dot(direction));return dot>.95&&dot<.999999;}));
  if(!curved)refs.push({point:a.clone().add(b).multiplyScalar(.5).toArray(),normal:[0,0,1],name:'ソリッド辺',kind:'midpoint'});
 }
 const circles=arcCenters(edges);
 return [...circles,...refs.filter(ref=>!circles.some(circle=>new THREE.Vector3(...circle.point).distanceTo(new THREE.Vector3(...ref.point))<1e-4))];
}
