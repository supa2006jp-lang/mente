// Find the foot of the perpendicular in sketch UV coordinates, never on an
// extension of the target segment. Both approach angle and screen distance
// must be close; numeric angle and length constraints remain authoritative.
export function snapSketchLinePerpendicular(point,origin,segments,{project,disabled=false,angle=null}={}){
 const free={point:[...point],snapped:false};
 if(disabled||!project||![...point,...origin].every(Number.isFinite))return free;
 const delta=[point[0]-origin[0],point[1]-origin[1]];
 if(Math.hypot(...delta)<.1)return free;
 const pointer=project(point),sourceAngle=angle===null?Math.atan2(delta[1],delta[0])*180/Math.PI:angle;
 if(!pointer||!Number.isFinite(pointer.x+pointer.y)||!Number.isFinite(sourceAngle))return free;
 let best=null,distance=8+1e-8;
 for(const segment of segments){
  const {a,b}=segment;if(![...a,...b].every(Number.isFinite))continue;
  const edge=[b[0]-a[0],b[1]-a[1]],length2=edge[0]**2+edge[1]**2;
  if(length2<1e-12)continue;
  const t=((origin[0]-a[0])*edge[0]+(origin[1]-a[1])*edge[1])/length2;
  if(t<0||t>1)continue;
  const target=[a[0]+t*edge[0],a[1]+t*edge[1]],direction=[target[0]-origin[0],target[1]-origin[1]];
  if(Math.hypot(...direction)<.1)continue;
  const targetAngle=Math.atan2(direction[1],direction[0])*180/Math.PI,difference=Math.abs(((sourceAngle-targetAngle+540)%360+360)%360-180);
  if(difference>(angle===null?3:1e-7)+1e-10)continue;
  const p=project(target);if(!p||!Number.isFinite(p.x+p.y))continue;
  const d=Math.hypot(p.x-pointer.x,p.y-pointer.y);
  if(d<distance){best={point:target,angle:targetAngle,kind:segment.kind,snapped:true};distance=d;}
 }
 return best||free;
}
