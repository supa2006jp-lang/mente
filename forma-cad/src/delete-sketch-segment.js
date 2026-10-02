import {sketchPoints} from './regions.js';
export function deleteSketchSegment(source,index){
 if(['line','circle','spline'].includes(source.profile))return [];
 const points=sketchPoints(source),i=Math.max(0,Math.min(index,points.length-2));
 const closed=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7;
 const parts=closed?[points.slice(i+1,-1).concat(points.slice(0,i+1))]:[points.slice(0,i+1),points.slice(i+1)];
 return parts.filter(p=>p.length>=2).map((p,j)=>({...structuredClone(source),id:j?crypto.randomUUID():source.id,profile:'polyline',points:p,closed:false,name:source.name+(j?' 分割':'')}));
}
