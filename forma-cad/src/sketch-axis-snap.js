// End a perpendicular line on either axis of the current sketch plane.
// Keep the start coordinate along the axis, even between grid intersections.
export function snapSketchLineAxis(point,origin,{project,disabled=false,angle=null}={}){
 const free={point:[...point],snapped:false};
 if(disabled||!project||![...point,...origin].every(Number.isFinite))return free;
 const delta=[point[0]-origin[0],point[1]-origin[1]];
 if(Math.hypot(...delta)<.1)return free;
 const rawAngle=Math.atan2(delta[1],delta[0])*180/Math.PI,pointer=project(point);
 if(!pointer||!Number.isFinite(pointer.x+pointer.y))return free;
 let best=null,distance=8+1e-8;
 for(const [axis,target]of [['x',[origin[0],0]],['y',[0,origin[1]]]]){
  const direction=[target[0]-origin[0],target[1]-origin[1]];
  if(Math.hypot(...direction)<.1)continue;
  const targetAngle=Math.atan2(direction[1],direction[0])*180/Math.PI,sourceAngle=angle===null?rawAngle:angle;
  if(!Number.isFinite(sourceAngle))continue;
  const difference=Math.abs(((sourceAngle-targetAngle+540)%360+360)%360-180);
  if(difference>(angle===null?3:1e-7)+1e-10)continue;
  const p=project(target);if(!p||!Number.isFinite(p.x+p.y))continue;
  const d=Math.hypot(p.x-pointer.x,p.y-pointer.y);
  if(d<distance){best={point:target,axis,angle:targetAngle,snapped:true};distance=d;}
 }
 return best||free;
}
