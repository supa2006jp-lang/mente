import {drawingThreadReference,sameDrawingThread,validDrawingThreadReference} from './drawing-thread-annotations.js';

const tolerance=1e-4;
export const drawingThreadRimKinds=['bore','counterbore','shaft'];

function threadRims(view){
 const shafts=(view.threadShafts??[]).map(shaft=>({...shaft,kind:'shaft'}));
 const bores=(view.holeMachining??[]).flatMap(hole=>{
  if(!hole.thread)return [];
  const {center,radius,thread,counterbore}=hole;
  const bore={center,radius,thread,kind:'bore'};
  return counterbore?[bore,{...bore,radius:counterbore.radius,kind:'counterbore'}]:[bore];
 });
 return [...bores,...shafts];
}

function rimMatchesArc(rim,arc){
 const distance=Math.hypot(rim.center[0]-arc.center[0],rim.center[1]-arc.center[1]);
 if(rim.kind!=='shaft')return distance<tolerance&&(Math.abs(rim.radius-arc.radius)<tolerance||
  rim.kind==='bore'&&rim.thread.adjustedDiameter!==undefined&&Math.abs(rim.thread.diameter/2-arc.radius)<tolerance);
 // Chords rounded at a half-circle can shift the recovered arc center a little.
 const centerTolerance=Math.max(tolerance,Math.sqrt(2e-5*rim.radius));
 const depth=Math.max(rim.tipChamfer,rim.thread.pitch*.62);
 return distance<centerTolerance&&arc.radius>=rim.radius-depth-tolerance&&arc.radius<=rim.radius+tolerance;
}

function matchedRim(view,arc){
 const matches=threadRims(view).filter(rim=>rimMatchesArc(rim,arc));
 return matches.length===1?matches[0]:undefined;
}

function threadDimensionSize(rim){
 const {diameter,adjustedDiameter}=rim.thread,ref=drawingThreadReference(rim.thread);
 return {nominalDiameter:diameter,...(adjustedDiameter===undefined?{}:{adjustedDiameter}),
  ...(validDrawingThreadReference(ref)?{threadRef:ref,threadRim:rim.kind}:{})};
}

export function drawingThreadBoreDimension(view,circle){
 if(!view.holeMachining?.some(hole=>hole.thread&&Math.abs(hole.radius-circle.radius)<tolerance&&
  Math.hypot(hole.center[0]-circle.center[0],hole.center[1]-circle.center[1])<tolerance))return;
 const rim=matchedRim(view,circle);
 if(rim?.kind==='bore'&&Math.abs(rim.radius-circle.radius)<tolerance){
  return {kind:'thread',...threadDimensionSize(rim)};
 }
}

export function drawingThreadDimensionTarget(view,{arc,threadShaft,point}){
 const rim=threadShaft?{...threadShaft,kind:'shaft'}:matchedRim(view,arc);
 const {center}=rim??arc;
 const radius=rim?.kind==='bore'&&rim.thread.adjustedDiameter!==undefined?arc.radius:(rim??arc).radius;
 const offset=point.map((value,i)=>value-center[i]),length=Math.hypot(...offset);
 return {center,radius,arcPoint:length?center.map((value,i)=>value+radius*offset[i]/length):[center[0]+radius,center[1]],
  ...(rim?threadDimensionSize(rim):{})};
}

export function sameProjectedThreadRim(view,d){
 const matches=threadRims(view).filter(rim=>rim.kind===d.threadRim&&sameDrawingThread(d.threadRef,rim.thread));
 return matches.length===1?matches[0]:null;
}

export function restoreAdjustedThreadDimensions(views,dimensions){
 return dimensions.map(d=>{
  const view=views[d.view];
  if(d.kind!=='thread'||d.review||d.adjustedDiameter!==undefined||!view)return d;
  const rim=d.threadRef?sameProjectedThreadRim(view,d):matchedRim(view,d);
  if(rim?.thread.adjustedDiameter===undefined)return d;
  return {...d,...threadDimensionSize(rim)};
 });
}
