import {drawingProjections} from './drawing-view-preferences.js';

export function drawingBreakAxis(bounds,mode){
 if(mode==='longest'){
  const spans=bounds[1].map((value,i)=>value-bounds[0][i]);
  return spans.indexOf(Math.max(...spans));
 }
 return ['x','y','z'].indexOf(mode);
}

export function drawingViewBreak(view,frame,axis,percent=70){
 if(axis<0)return;
 const {horizontal,vertical}=drawingProjections[view];
 const direction=horizontal[axis]?0:vertical[axis]?1:-1;
 if(direction<0)return;
 const length=direction?frame.height:frame.width;
 if(length<=1e-6)return;
 const origin=direction?frame.by:frame.bx;
 const retained=length*(1-percent/100)/2,gap=length*.025;
 const start=origin+retained,end=origin+length-retained;
 return {direction,start,end,gap,removed:end-start-gap};
}

export function displayedDrawingSpan(frame,axis){
 return (axis===0?frame.width:frame.height)-(frame.break?.direction===axis?frame.break.removed:0);
}
export function fullDrawingSpan(view,axis){
 return (axis===0?view.width:view.height)/view.scale+(view.break?.direction===axis?view.break.removed:0);
}
function projectCoordinate(value,cut){
 if(value<=cut.start)return value;
 if(value>=cut.end)return value-cut.removed;
 return cut.start+(value-cut.start)*cut.gap/(cut.end-cut.start);
}
function modelCoordinate(value,cut){
 if(value<=cut.start)return value;
 if(value>=cut.start+cut.gap)return value+cut.removed;
 return cut.start+(value-cut.start)*(cut.end-cut.start)/cut.gap;
}
export function drawingPaperPoint(view,point){
 const cut=view.break;
 const x=cut?.direction===0?projectCoordinate(point[0],cut):point[0];
 const y=cut?.direction===1?projectCoordinate(point[1],cut):point[1];
 return [view.x+(x-view.bx)*view.scale,view.y+(y-view.by)*view.scale];
}
export function drawingModelPoint(view,point){
 const p=[view.bx+(point[0]-view.x)/view.scale,view.by+(point[1]-view.y)/view.scale],cut=view.break;
 if(cut)p[cut.direction]=modelCoordinate(p[cut.direction],cut);
 return p;
}
export function drawingPointOmitted(view,point){
 const cut=view?.break;
 return !!cut&&point[cut.direction]>cut.start&&point[cut.direction]<cut.end;
}
export function drawingDimensionVisible(d,view){
 const cut=view.break;
 if(!cut)return true;
 const axis=cut.direction;
 if(d.center)return d.center[axis]+d.radius<=cut.start||d.center[axis]-d.radius>=cut.end;
 const points=d.vertex?[d.a,d.b,d.vertex]:[d.a,d.b];
 if(points.some(p=>drawingPointOmitted(view,p)))return false;
 return !d.vertex||points.every(p=>p[axis]<=cut.start)||points.every(p=>p[axis]>=cut.end);
}
