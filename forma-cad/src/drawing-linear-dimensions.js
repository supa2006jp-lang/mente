import {dimensionValue} from './drawing-dimensions.js';

export const isLinearDimensionKind=kind=>['horizontal','vertical','aligned'].includes(kind);
export const drawingDimensionEndpoint=(d,end)=>({
 point:d[end],model:end==='a'?d.modelA:d.modelB,manual:d.manualEndpoints?.includes(end),
});

export function drawingDimensionBetween(kind,view,first,second){
 const a=first.point,b=second.point,d={kind,view,a,b};
 if(view==='iso'){
  if(kind!=='aligned'||!first.model||!second.model||Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6)return null;
  d.modelA=first.model;d.modelB=second.model;
 }else{
  const manualEndpoints=[];
  if(first.manual)manualEndpoints.push('a');
  if(second.manual)manualEndpoints.push('b');
  if(manualEndpoints.length)d.manualEndpoints=manualEndpoints;
 }
 return dimensionValue(d)>=1e-6?d:null;
}

export function replaceDrawingDimensionEndpoint(d,end,point){
 const first=drawingDimensionEndpoint(d,'a'),second=drawingDimensionEndpoint(d,'b');
 const previous=end==='a'?first:second;
 if(previous.point.every((value,i)=>value===point.point[i])&&!!previous.manual===!!point.manual&&
  (!previous.model||previous.model.every((value,i)=>value===point.model?.[i])))return d;
 const span=drawingDimensionBetween(d.kind,d.view,end==='a'?point:first,end==='b'?point:second);
 if(!span)return null;
 const next={...d};
 // These fields describe the original measurement. Preserve its presentation and placement.
 for(const key of ['displayValue','overall','automatic','feature','repeat','manualEndpoints'])delete next[key];
 return {...next,...span};
}
