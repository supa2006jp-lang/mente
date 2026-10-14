import * as THREE from 'three';
import {solidSketchSection} from './sketch-solid-overlap.js';
import {basisFor,worldPoint} from './frames.js';

const SCALE=100000;

// Measure attraction in pixels, so zooming never changes the usable distance.
// The projected closest point is lifted back onto the actual sketch section.
export function closestBoundaryPoint(segments,hit,project,{tolerance=8,origin=null,direction=null}={}){
 const cursor=project(hit);let best=null,distance=tolerance;
 for(const [a,b] of segments){
  const pa=project(a),pb=project(b),dx=pb.x-pa.x,dy=pb.y-pa.y,length2=dx*dx+dy*dy;
  if(length2<1e-12)continue;
  let point;
  if(origin&&direction){
   const edge=b.clone().sub(a),normal=edge.clone().cross(direction),denominator=normal.lengthSq();
   if(denominator<1e-16)continue;
   const t=origin.clone().sub(a).cross(direction).dot(normal)/denominator;
   if(t<0||t>1)continue;
   point=a.clone().lerp(b,t);
   if(point.clone().sub(origin).dot(direction)<0)continue;
  }else{
   const t=THREE.MathUtils.clamp(((cursor.x-pa.x)*dx+(cursor.y-pa.y)*dy)/length2,0,1);
   point=a.clone().lerp(b,t);
  }
  const p=project(point),d=Math.hypot(p.x-cursor.x,p.y-cursor.y);
  if(d<distance){distance=d;best=point;}
 }
 return best;
}

export function createSketchBoundarySnap(){
 let cache=new WeakMap();
 return {
  clear(){cache=new WeakMap();},
  reference(face,basis,offset,hit,project,options){
   if(!face?.filletGridReference)return null;
   const normal=basisFor(face).n;
   if(Math.abs(normal.dot(basis.n))<.999999)return null;
   let entry=cache.get(face);
   if(!entry){
    const edges=[];
    for(const ring of [face.outer,...(face.holes||[])]){
     const points=ring.map(p=>worldPoint(face,p));
     for(let i=0;i<points.length;i++)edges.push([points[i],points[(i+1)%points.length]]);
    }
    entry={edges};cache.set(face,entry);
   }
   // A reference from another sketch plane must not pull points off-plane.
   if(entry.edges.some(([a,b])=>Math.abs(a.dot(basis.n)-offset)>1e-4||Math.abs(b.dot(basis.n)-offset)>1e-4))return null;
   const point=closestBoundaryPoint(entry.edges,hit,project,options);
   return point?.addScaledVector(basis.n,offset-point.dot(basis.n))||null;
  },
  snap(meshes,basis,offset,hit,project,options){
   const segments=[];
   for(const mesh of meshes){
    if(!mesh.visible)continue;mesh.updateWorldMatrix(true,false);
    const geometry=mesh.geometry,key=[offset,...basis.u.toArray(),...basis.v.toArray(),...basis.n.toArray(),...mesh.matrixWorld.elements,geometry.attributes.position.version,geometry.index?.version].join(',');
    let entry=cache.get(mesh);
    if(!entry||entry.geometry!==geometry||entry.key!==key){
     const rings=solidSketchSection([mesh],basis,offset),edges=[];
     const world=p=>basis.u.clone().multiplyScalar(p.X/SCALE).addScaledVector(basis.v,p.Y/SCALE).addScaledVector(basis.n,offset);
     for(const ring of rings)for(let i=0;i<ring.length;i++)edges.push([world(ring[i]),world(ring[(i+1)%ring.length])]);
     entry={geometry,key,edges};cache.set(mesh,entry);
    }
    for(const edge of entry.edges)segments.push(edge);
   }
   return closestBoundaryPoint(segments,hit,project,options);
  }
 };
}
