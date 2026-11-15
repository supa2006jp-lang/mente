import {circularRing} from './circular-ring.js';
import {faceGridBounds} from './face-grid.js';

export function planarFaceMeasurement(face){
 const circle=circularRing(face.outer,{nonUniform:true});
 if(circle)return {diameter:circle.radius*2,hasHoles:!!face.holes?.length};

 const {outer}=face;
 if(outer.length===4){
  const edges=outer.map(([x,y],i)=>[outer[(i+1)%4][0]-x,outer[(i+1)%4][1]-y]);
  const lengths=edges.map(([x,y])=>Math.hypot(x,y));
  const rectangular=edges.every(([x,y],i)=>{
   const j=(i+1)%4,[u,v]=edges[j];
   return lengths[i]>0&&Math.abs(x*u+y*v)<=1e-5*lengths[i]*lengths[j];
  });
  if(rectangular)return {sides:lengths.slice(0,2).sort((a,b)=>a-b)};
 }
 const {u,v}=faceGridBounds(face,'face');
 return {sides:[u[1]-u[0],v[1]-v[0]],outline:true};
}
