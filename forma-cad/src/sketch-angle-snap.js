// Work in the sketch's own UV plane, so custom/vertical planes behave alike.
// Project onto the nearest ray instead of lengthening the line while snapping.
export const SKETCH_ANGLE_STEPS=[5,15,30,45];
export const sketchAngleStep=value=>SKETCH_ANGLE_STEPS.includes(Number(value))?Number(value):15;
export function snapSketchRotationAngle(angle,{step=15,disabled=false}={}){
 step=sketchAngleStep(step);const target=Math.round(angle/step)*step;
 return !disabled&&Number.isFinite(angle)&&Math.abs(target-angle)<=Math.min(3,step/4)+1e-10?{angle:Object.is(target,-0)?0:target,snapped:true}:{angle,snapped:false};
}
export function sketchRotationDragDelta(previous,current){return ((current-previous+540)%360+360)%360-180;}
export function snapSketchLineAngle(point,{disabled=false,project=null,step=15}={}){
 const [u,v]=point,length=Math.hypot(u,v),free={point:[u,v],snapped:false};
 if(disabled||!Number.isFinite(length)||length<.1)return free;
 const angle=Math.atan2(v,u)*180/Math.PI,resultAngle=snapSketchRotationAngle(angle,{step});
 if(!resultAngle.snapped)return free;const target=resultAngle.angle;
 const radians=target*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),along=u*c+v*s,result=[along*c,along*s];
 if(project){const a=project(point),b=project(result);if(!a||!b||!Number.isFinite(a.x+a.y+b.x+b.y)||Math.hypot(a.x-b.x,a.y-b.y)>8+1e-8)return free;}
 return {point:result,angle:Object.is(target,-0)?0:target,snapped:true};
}
