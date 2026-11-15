import {circularRing} from './circular-ring.js';
import {faceGridBounds} from './face-grid.js';

function measureOutline(outer){
 const circle=circularRing(outer,{nonUniform:true});
 if(circle)return {diameter:circle.radius*2,center:circle.center};
 if(outer.length===4){
  const edges=outer.map(([x,y],i)=>[outer[(i+1)%4][0]-x,outer[(i+1)%4][1]-y]);
  const lengths=edges.map(([x,y])=>Math.hypot(x,y));
  const rectangular=edges.every(([x,y],i)=>{
   const j=(i+1)%4,[u,v]=edges[j];
   return lengths[i]>0&&Math.abs(x*u+y*v)<=1e-5*lengths[i]*lengths[j];
  });
  if(rectangular)return {sides:lengths.slice(0,2).sort((a,b)=>a-b)};
 }
 const {u,v}=faceGridBounds({outer},'face');
 return {sides:[u[1]-u[0],v[1]-v[0]],outline:true};
}

export function planarFaceMeasurement(face){
 const outer=measureOutline(face.outer);
 const openings=(face.holes||[]).map(measureOutline);
 const hole=openings[0];
 const result={...outer,openings};
 // Only a single concentric circular opening has a uniform radial rim.
 if(openings.length===1&&outer.diameter>hole.diameter&&
  Math.hypot(outer.center[0]-hole.center[0],outer.center[1]-hole.center[1])<=.0002){
  result.rimThickness=(outer.diameter-hole.diameter)/2;
 }
 return result;
}
