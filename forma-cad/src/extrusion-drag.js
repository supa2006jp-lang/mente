// Match the display direction and drag axis even when looking straight down
// the extrusion normal, where its screen projection has no usable length.
export function extrusionDragAxis(point,nextPoint,pixelsPerMm){
 const dx=nextPoint.x-point.x,dy=nextPoint.y-point.y;
 return Math.hypot(dx,dy)>=.1?{dx,dy}:{dx:0,dy:-Math.max(.001,pixelsPerMm)};
}
export function extrusionArrowAngle(axis,depth){
 const sign=depth<0?-1:1;
 return Math.atan2(axis.dy*sign,axis.dx*sign)*180/Math.PI+90;
}
export function extrusionDragDistance(raw,{snapEnabled=false,step=10,pixelsPerMm=1}={}){
 let value=Math.max(-10000,Math.min(10000,raw)),snapped=false;
 if(snapEnabled&&Number.isFinite(step)&&step>0){
  const nearest=Number((Math.round(value/step)*step).toFixed(8)),tolerance=Math.min(step*.2,6/Math.max(.001,pixelsPerMm));
  // A zero-length extrusion is invalid; crossing zero must remain possible.
  if(Math.abs(nearest)>=.1&&Math.abs(nearest)<=10000&&Math.abs(value-nearest)<=tolerance){value=nearest;snapped=true;}
 }
 if(Math.abs(value)<.1)value=value<0?-.1:.1;
 return {value,snapped};
}
