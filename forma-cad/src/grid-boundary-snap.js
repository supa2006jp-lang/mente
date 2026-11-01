import * as THREE from 'three';
import {allMeshHits} from './selection-candidates.js';

function nearSegment([a,b],cursor,project,tolerance){
 const p=project(a),q=project(b),dx=q.x-p.x,dy=q.y-p.y,l=dx*dx+dy*dy;
 if(l<1e-12)return false;const t=Math.max(0,Math.min(1,((cursor.x-p.x)*dx+(cursor.y-p.y)*dy)/l));
 return Math.hypot(cursor.x-p.x-t*dx,cursor.y-p.y-t*dy)<=tolerance;
}

// Intersect finite rendered lines, not an infinite grid or the closest point
// on a solid edge. Filtering in screen space bounds the work at any zoom.
export function closestGridBoundaryIntersection(boundaries,gridLines,hit,project,{tolerance=8,origin=null,direction=null,accept=()=>true}={}){
 const cursor=project(hit),lines=gridLines.filter(line=>nearSegment(line,cursor,project,tolerance));let best=null,distance=tolerance;
 if(!lines.length)return null;
 for(const boundary of boundaries){
  if(!nearSegment(boundary,cursor,project,tolerance))continue;const [a,b]=boundary,r=b.clone().sub(a);
  for(const [c,d]of lines){
   const s=d.clone().sub(c),cross=r.clone().cross(s),den=cross.lengthSq();if(den<=r.lengthSq()*s.lengthSq()*1e-14)continue;
   const delta=c.clone().sub(a),t=delta.clone().cross(s).dot(cross)/den,u=delta.clone().cross(r).dot(cross)/den;
   // Scoped grid endpoints are GPU Float32 values. Allow their rounding at
   // the supporting boundary without extending either line by a visible amount.
   const slack=Math.max(1e-5,...[c,d].flatMap(p=>p.toArray().map(v=>Math.abs(v)*1e-7))),rt=slack/r.length(),su=slack/s.length();
   if(t< -rt||t>1+rt||u< -su||u>1+su)continue;
   const point=a.clone().addScaledVector(r,Math.max(0,Math.min(1,t))),onGrid=c.clone().addScaledVector(s,Math.max(0,Math.min(1,u)));
   if(point.distanceTo(onGrid)>slack)continue;
   if(origin&&direction){const v=point.clone().sub(origin);if(v.dot(direction)< -1e-6||v.clone().cross(direction).length()>1e-6*direction.length())continue;}
   const p=project(point),gap=Math.hypot(p.x-cursor.x,p.y-cursor.y);if(gap<distance&&(p.z===undefined||Math.abs(p.z)<=1)&&accept(point)){distance=gap;best=point;}
  }
 }
 return best;
}

export function createGridBoundarySnap(){
 let cache=new WeakMap();
 function lines(grid,basis,offset){
  if(!grid?.visible||!grid.geometry?.attributes.position)return [];grid.updateWorldMatrix(true,false);
  const normal=new THREE.Vector3(0,1,0).transformDirection(grid.matrixWorld),center=new THREE.Vector3().setFromMatrixPosition(grid.matrixWorld);
  if(Math.abs(normal.dot(basis.n))<.999999||Math.abs(center.dot(basis.n)-offset)>.06)return [];
  const geometry=grid.geometry,attr=geometry.attributes.position,key=[...grid.matrixWorld.elements,...basis.n.toArray(),offset,attr.version].join(',');let saved=cache.get(grid);
  if(saved?.geometry===geometry&&saved.key===key)return saved.lines;
  const result=[];for(let i=0;i<attr.count;i+=2)result.push([i,i+1].map(j=>{const p=new THREE.Vector3().fromBufferAttribute(attr,j).applyMatrix4(grid.matrixWorld);return p.addScaledVector(basis.n,offset-p.dot(basis.n));}));
  cache.set(grid,{key,geometry,lines:result});return result;
 }
 return {clear(){cache=new WeakMap();},snap(grid,boundaries,basis,offset,hit,project,options){return closestGridBoundaryIntersection(boundaries,lines(grid,basis,offset),hit,project,options);}};
}

// Respect section clipping when deciding whether a crossing is actually visible.
export function gridBoundaryPointVisible(point,camera,meshes){
 const p=point.clone().project(camera);if(Math.abs(p.z)>1)return false;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);ray.far=ray.ray.origin.distanceTo(point)-.03;
 return !allMeshHits(ray,meshes.filter(m=>m.visible)).some(hit=>{
  const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex||0]:hit.object.material;if(material.visible===false)return false;
  const clips=material.clippingPlanes||[],kept=clip=>clip.distanceToPoint(hit.point)>=-1e-6;
  return !clips.length||(material.clipIntersection?clips.some(kept):clips.every(kept));
 });
}
