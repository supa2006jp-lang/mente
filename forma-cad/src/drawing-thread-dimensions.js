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
 if(rim.kind!=='shaft')return distance<tolerance&&Math.abs(rim.radius-arc.radius)<tolerance;
 // Chords rounded at a half-circle can shift the recovered arc center a little.
 const centerTolerance=Math.max(tolerance,Math.sqrt(2e-5*rim.radius));
 const depth=Math.max(rim.tipChamfer,rim.thread.pitch*.62);
 return distance<centerTolerance&&arc.radius>=rim.radius-depth-tolerance&&arc.radius<=rim.radius+tolerance;
}

export function drawingThreadDimensionTarget(view,{arc,threadShaft,point}){
 const matches=threadShaft?[]:threadRims(view).filter(rim=>rimMatchesArc(rim,arc));
 const rim=threadShaft?{...threadShaft,kind:'shaft'}:matches.length===1?matches[0]:undefined;
 const ref=rim&&drawingThreadReference(rim.thread);
 const {center,radius}=rim??arc;
 const offset=point.map((value,i)=>value-center[i]),length=Math.hypot(...offset);
 return {center,radius,arcPoint:length?center.map((value,i)=>value+radius*offset[i]/length):[center[0]+radius,center[1]],
  ...(rim?{nominalDiameter:rim.thread.diameter,...(validDrawingThreadReference(ref)?{threadRef:ref,threadRim:rim.kind}:{})}:{})};
}

export function sameProjectedThreadRim(view,d){
 const matches=threadRims(view).filter(rim=>rim.kind===d.threadRim&&sameDrawingThread(d.threadRef,rim.thread));
 return matches.length===1?matches[0]:null;
}
