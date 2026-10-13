import * as THREE from 'three';
import {bodyEdges} from './body-edges.js';

// Recover an axis from two coaxial circular rims, including open, cut arcs.
// This also works for saved/imported solids without a full-circle recipe.
export function cylindricalRimWalls(geometry){
 const edges=bodyEdges(geometry),rims=[],walls=[];
 try{
  const curves=new Set([...(edges.userData.circularEdges?.values()||[]),...(edges.userData.arcEdges?.values()||[])]);
  for(const curve of curves){
   const points=curve.points.map(p=>new THREE.Vector3(...p)),center=new THREE.Vector3(...curve.center),radius=curve.radius,tolerance=Math.max(.0002,radius*1e-5);
   const axis=points[Math.floor(points.length/3)].clone().sub(points[0]).cross(points[Math.floor(points.length*2/3)].clone().sub(points[0])).normalize();
   if(axis.lengthSq()<.99||points.some(p=>Math.abs(p.distanceTo(center)-radius)>tolerance||Math.abs(p.clone().sub(center).dot(axis))>tolerance))continue;
   rims.push({center,radius,axis,tolerance});
  }
  for(let i=0;i<rims.length;i++)for(let j=i+1;j<rims.length;j++){
   const a=rims[i],b=rims[j],delta=b.center.clone().sub(a.center),height=delta.dot(a.axis),tolerance=Math.max(a.tolerance,b.tolerance);
   if(Math.abs(a.axis.dot(b.axis))<.999999||Math.abs(a.radius-b.radius)>tolerance||delta.clone().addScaledVector(a.axis,-height).length()>tolerance||Math.abs(height)<tolerance)continue;
   walls.push({origin:a.center,axis:a.axis,radius:(a.radius+b.radius)/2,min:Math.min(0,height),max:Math.max(0,height),tolerance});
  }
  return walls;
 }finally{edges.dispose();}
}
