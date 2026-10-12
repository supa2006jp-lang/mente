import * as THREE from 'three';
import Clipper from 'clipper-lib';
import {basisFor} from './frames.js';
import {sectionSegments,sectionCap} from './section-view.js';
const SCALE=100000;
function path(ring,outer=true){const p=ring.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));if(Clipper.Clipper.Orientation(p)!==outer)p.reverse();return p;}

// Display/picking uses the solid's section on the sketch plane, never its
// camera silhouette. The original profile is retained for exact BREP extrusion.
export function sketchSolidOverlapRegions(regions,meshes){
 const result=[],sections=new Map();
 for(const r of regions){
  const b=basisFor(r),key=[...b.n.toArray(),r.offset,...b.u.toArray(),...b.v.toArray()].join(',');
  if(!sections.has(key)){
   const coverage=[];
   for(const mesh of meshes){
    if(!mesh.visible)continue;mesh.updateWorldMatrix(true,false);
    const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),plane=new THREE.Plane(b.n,-r.offset);
    const cap=sectionCap(sectionSegments(g,plane),plane);
    try{for(const geometry of [g,cap]){
     const p=geometry.attributes.position,ix=geometry.index;
     for(let i=0;i<(ix?.count??p.count);i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j));
      if(points.some(p=>Math.abs(plane.distanceToPoint(p))>1e-4))continue;
      const triangle=path(points.map(p=>[p.dot(b.u),p.dot(b.v)]));
      if(Math.abs(Clipper.Clipper.Area(triangle))>1)coverage.push(triangle);
     }
    }}finally{cap.dispose();g.dispose();}
   }
   const union=new Clipper.Clipper();union.AddPaths(coverage,Clipper.PolyType.ptSubject,true);let merged=[];
   union.Execute(Clipper.ClipType.ctUnion,merged,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
   // Tessellation vertices can differ by fractions of a micron. Close those
   // seams before partitioning; exact CAD geometry remains untouched.
   for(const delta of [20,-20]){const offset=new Clipper.ClipperOffset(2),next=[];offset.AddPaths(merged,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);offset.Execute(next,delta);merged=next;}
   sections.set(key,merged);
  }
  const coverage=sections.get(key);if(!coverage.length)continue;
  const clip=new Clipper.Clipper(),tree=new Clipper.PolyTree();
  clip.AddPaths([path(r.outer),...r.holes.map(h=>path(h,false))],Clipper.PolyType.ptSubject,true);
  clip.AddPaths(coverage,Clipper.PolyType.ptClip,true);
  clip.Execute(Clipper.ClipType.ctIntersection,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  let index=0;
  for(let node=tree.GetFirst();node;node=node.GetNext()){
   if(node.IsHole())continue;
   const outer=node.Contour().map(p=>[p.X/SCALE,p.Y/SCALE]),holes=node.Childs().filter(h=>h.IsHole()).map(h=>h.Contour().map(p=>[p.X/SCALE,p.Y/SCALE]));
   const area=(Math.abs(Clipper.Clipper.Area(node.Contour()))-node.Childs().filter(h=>h.IsHole()).reduce((s,h)=>s+Math.abs(Clipper.Clipper.Area(h.Contour())),0))/SCALE**2;
   // A fully covered sketch already has the desired selectable footprint.
   if(area<1e-5||Math.abs(area-r.area)<Math.max(1e-4,r.area*1e-6))continue;
   result.push({...r,id:r.id+':overlap:'+index++,outer,holes,area,overlapSource:structuredClone(r),overlapTargets:meshes.filter(m=>m.visible).map(m=>m.userData.bodyId)});
  }
 }
 return result;
}
