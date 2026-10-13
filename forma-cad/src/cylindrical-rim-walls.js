import * as THREE from 'three';
import {bodyEdges} from './body-edges.js';
import {circularEdges} from './circular-edges.js';
import {arcEdges} from './arc-edges.js';

// Recover an axis from two coaxial circular rims, including open, cut arcs.
// This also works for saved/imported solids without a full-circle recipe.
export function cylindricalRimWalls(geometry){
 // Plain mesh extrusions have no CAD face table. Their sharp display edges are
 // sufficient for fitting rims; avoid the quadratic CSG edge cleanup here.
 const edges=geometry.userData.faceGroups?.length?bodyEdges(geometry):new THREE.EdgesGeometry(geometry,28),rims=[],walls=[];
 if(!geometry.userData.faceGroups?.length){edges.userData.circularEdges=circularEdges(edges);edges.userData.arcEdges=arcEdges(edges);}
 try{
  const curves=new Set([...(edges.userData.circularEdges?.values()||[]),...(edges.userData.arcEdges?.values()||[])]);
  for(const curve of curves){
   const points=curve.points.map(p=>new THREE.Vector3(...p)),center=new THREE.Vector3(...curve.center),radius=curve.radius,fitTolerance=Math.max(.0002,radius*1e-5);
   const axis=points[Math.floor(points.length/3)].clone().sub(points[0]).cross(points[Math.floor(points.length*2/3)].clone().sub(points[0])).normalize();
   // A sketch line can intersect the first/last chord between its sampled
   // circle vertices. Those two clipped endpoints lie just inside the circle.
   let step=0;for(let i=1;i<points.length;i++)step=Math.max(step,points[i-1].clone().sub(center).angleTo(points[i].clone().sub(center)));
   const tolerance=Math.max(fitTolerance,radius*(1-Math.cos(step/2))+fitTolerance);
   if(axis.lengthSq()<.99||points.some((p,i)=>Math.abs(p.distanceTo(center)-radius)>(i===0||i===points.length-1?tolerance:fitTolerance)||Math.abs(p.clone().sub(center).dot(axis))>fitTolerance))continue;
   rims.push({center,radius,axis,tolerance,fitTolerance});
  }
  for(let i=0;i<rims.length;i++)for(let j=i+1;j<rims.length;j++){
   const a=rims[i],b=rims[j],delta=b.center.clone().sub(a.center),height=delta.dot(a.axis),tolerance=Math.max(a.tolerance,b.tolerance),fitTolerance=Math.max(a.fitTolerance,b.fitTolerance);
   if(Math.abs(a.axis.dot(b.axis))<.999999||Math.abs(a.radius-b.radius)>fitTolerance||delta.clone().addScaledVector(a.axis,-height).length()>fitTolerance||Math.abs(height)<fitTolerance)continue;
   walls.push({origin:a.center,axis:a.axis,radius:(a.radius+b.radius)/2,min:Math.min(0,height),max:Math.max(0,height),tolerance});
  }
  return walls;
 }finally{edges.dispose();}
}
