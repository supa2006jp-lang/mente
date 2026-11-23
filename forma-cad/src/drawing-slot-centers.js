// Drawing paths are rounded to model coordinates before they reach the editor.
const tolerance=1e-4;
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];

function semicircle(arc){
 const chord=subtract(arc.b,arc.a),length=Math.hypot(...chord);
 if(length<tolerance||Math.abs(length-2*arc.radius)>tolerance)return null;
 const sign=arc.sweep?1:-1;
 return {...arc,center:midpoint(arc.a,arc.b),out:[sign*chord[1]/length,-sign*chord[0]/length]};
}

function spansSide(lines,from,to){
 const axis=subtract(to,from),length=Math.hypot(...axis),unit=axis.map(value=>value/length);
 const intervals=[];
 for(const line of lines){
  const a=subtract(line.a,from),b=subtract(line.b,from);
  if(Math.abs(cross(a,unit))>tolerance||Math.abs(cross(b,unit))>tolerance)continue;
  const u=dot(a,unit),v=dot(b,unit),low=Math.min(u,v),high=Math.max(u,v);
  if(low<=tolerance&&high>=length-tolerance)return true;
  if(high>0&&low<length)intervals.push([low,high]);
 }
 let reach=0;
 for(const [low,high] of intervals.sort((a,b)=>a[0]-b[0])){
  if(low>reach+tolerance)break;
  reach=Math.max(reach,high);
  if(reach>=length-tolerance)return true;
 }
 return false;
}

export function drawingSlotCenters(arcs,lines,circles){
 if(!lines.length||arcs.length<2)return [];
 const caps=arcs.map(semicircle).filter(cap=>cap&&!circles.some(circle=>
  Math.abs(circle.radius-cap.radius)<tolerance&&Math.hypot(...subtract(circle.center,cap.center))<tolerance));
 const centers=[];
 for(const [index,first] of caps.entries())for(let j=index+1;j<caps.length;j++){
  const second=caps[j],axis=subtract(second.center,first.center),length=Math.hypot(...axis);
  if(length<tolerance||Math.abs(first.radius-second.radius)>tolerance||
   // Chord endpoints are rounded. Compare the angular error at the scale of each cap.
   Math.abs(cross(axis,first.out))*first.radius>tolerance*length||
   Math.abs(cross(axis,second.out))*second.radius>tolerance*length||
   dot(axis,first.out)>=0||dot(axis,second.out)<=0)continue;
  const ends=[second.a,second.b].sort((a,b)=>Math.abs(cross(subtract(a,first.a),axis))-Math.abs(cross(subtract(b,first.a),axis)));
  if(![first.a,first.b].every((point,i)=>Math.abs(cross(subtract(ends[i],point),axis))<=length*tolerance&&
   spansSide(lines,point,ends[i])))continue;
  centers.push(midpoint(first.center,second.center));
 }
 return centers;
}
