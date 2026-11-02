// Intersect the constrained drawing ray with finite, visible grid segments.
// The start may lie between grid intersections: never round its perpendicular
// coordinate and bend a horizontal/vertical (or numerically fixed) line.
export function snapSketchLineToGrid(point,origin,segments,{angle,project,tolerance=8}={}){
 const free={point:[...point],snapped:false};
 if(!project||![...point,...origin,angle].every(Number.isFinite)||Math.hypot(point[0]-origin[0],point[1]-origin[1])<.1)return free;
 const radians=angle*Math.PI/180,d=[Math.cos(radians),Math.sin(radians)],cursor=project(point);
 if(!cursor||!Number.isFinite(cursor.x+cursor.y))return free;
 let best=null,distance=tolerance+1e-8;
 for(const segment of segments){
  const {a,b}=segment;if(![...a,...b].every(Number.isFinite))continue;
  const s=[b[0]-a[0],b[1]-a[1]],length=Math.hypot(...s),cross=d[0]*s[1]-d[1]*s[0];
  if(length<1e-8||Math.abs(cross)<length*1e-10)continue;
  const delta=[a[0]-origin[0],a[1]-origin[1]],along=(delta[0]*s[1]-delta[1]*s[0])/cross,t=(delta[0]*d[1]-delta[1]*d[0])/cross,slack=1e-6/length;
  if(along<.1||t< -slack||t>1+slack)continue;
  const target=[origin[0]+along*d[0],origin[1]+along*d[1]],p=project(target);
  if(!p||!Number.isFinite(p.x+p.y)||(p.z!==undefined&&Math.abs(p.z)>1))continue;
  const gap=Math.hypot(p.x-cursor.x,p.y-cursor.y);
  if(gap<distance){distance=gap;best={point:target,snapped:true,angle,segment,distance:gap};}
 }
 return best||free;
}
