import {isCircularDimensionKind} from './drawing-dimensions.js';
import {drawingThreadDimensionRefs,projectedDrawingThreadRims,sameDrawingThreadHoleSpec} from './drawing-thread-dimensions.js';
import {sameDrawingThread} from './drawing-thread-annotations.js';

const near=(a,b)=>Math.abs(a-b)<1e-5;
const samePoint=(a,b)=>a.every((n,i)=>near(n,b[i]));
const styleKeys=['precision','fontSize','tolerance','note','lineColor','textColor','hidden','pinned','automatic'];
// Match the real geometry and the annotation style before combining callouts.
export function groupDrawingDimensions(dimensions,views={}){
 const result=[],threadRims=new Map();
 for(const dimension of dimensions){
  const {kind,view}=dimension,thread=kind==='thread',members=dimension.centers??[dimension.center];
  const rims=thread&&!dimension.review?projectedDrawingThreadRims(views[view],dimension):[];
  const rim=rims.length&&rims.every(r=>sameDrawingThreadHoleSpec(rims[0],r))?rims[0]:null;
  const refs=thread?drawingThreadDimensionRefs(dimension):[];
  const eligible=isCircularDimensionKind(kind)&&!dimension.review&&(!thread||rim);
  const group=eligible?result.find(d=>{
   if(d.review||d.view!==view||d.kind!==kind||!near(d.radius,dimension.radius)||!styleKeys.every(key=>d[key]===dimension[key]))return false;
   const existing=d.centers??[d.center];
   if(existing.length+members.length>200||members.some(p=>existing.some(q=>samePoint(p,q))))return false;
   if(!thread)return true;
   return d.threadRim===dimension.threadRim&&sameDrawingThreadHoleSpec(threadRims.get(d),rim)&&
    refs.every(ref=>!drawingThreadDimensionRefs(d).some(other=>sameDrawingThread(ref,other)));
  }):null;
  if(!group){
   const copy=structuredClone(dimension);
   result.push(copy);
   if(rim)threadRims.set(copy,rim);
   continue;
  }
  group.centers=[...(group.centers??[group.center]),...members.map(p=>p.slice())];group.count=group.centers.length;
  if(thread)group.threadRefs=[...drawingThreadDimensionRefs(group),...structuredClone(refs)];
 }
 return result;
}
