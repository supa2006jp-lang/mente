// Work in the sketch's own UV plane, so custom/vertical planes behave alike.
// Project onto the nearest ray instead of lengthening the line while snapping.
export function snapSketchLineAngle(point,{disabled=false,project=null}={}){
 const [u,v]=point,length=Math.hypot(u,v),free={point:[u,v],snapped:false};
 if(disabled||!Number.isFinite(length)||length<.1)return free;
 const angle=Math.atan2(v,u)*180/Math.PI,target=Math.round(angle/15)*15;
 if(Math.abs(target-angle)>3+1e-10)return free;
 const radians=target*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),along=u*c+v*s,result=[along*c,along*s];
 if(project){const a=project(point),b=project(result);if(!a||!b||!Number.isFinite(a.x+a.y+b.x+b.y)||Math.hypot(a.x-b.x,a.y-b.y)>8+1e-8)return free;}
 return {point:result,angle:Object.is(target,-0)?0:target,snapped:true};
}
