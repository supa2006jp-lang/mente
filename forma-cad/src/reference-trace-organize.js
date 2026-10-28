import {validateTraceEdits} from './reference-trace-edit.js';
const TAU=2*Math.PI,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const delta=a=>Math.atan2(Math.sin(a),Math.cos(a));
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function line(points,tolerance){
 const a=points[0],b=points.at(-1),length=dist(a,b);if(length<1e-8)return null;let error=0,previous=-1e-8;
 for(const p of points){const t=((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/length**2;if(t<previous-1e-8||t>1+1e-8)return null;previous=t;error=Math.max(error,dist(p,lerp(a,b,Math.max(0,Math.min(1,t)))));if(error>tolerance)return null;}
 return {type:'line',a,b,error};
}
function arc(points,tolerance){
 if(points.length<6)return null;const a=points[0],b=points.at(-1),length=dist(a,b);if(length<1e-7)return null;const mid=lerp(a,b,.5),normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length];let numerator=0,denominator=0;
 // Least squares centre constrained to the perpendicular bisector: endpoints never move.
 for(const p of points.slice(1,-1)){const x=p[0]-mid[0],y=p[1]-mid[1],v=2*(x*normal[0]+y*normal[1]);numerator+=v*(x*x+y*y-length*length/4);denominator+=v*v;}
 if(denominator<1e-12)return null;const k=numerator/denominator,center=mid.map((v,i)=>v+k*normal[i]),radius=dist(center,a);if(!Number.isFinite(radius)||radius>1e7)return null;
 const start=Math.atan2(a[1]-center[1],a[0]-center[0]);let previous=start,sweep=0,error=0,sign=0,radial=0;
 for(const [i,p]of points.entries()){const angle=Math.atan2(p[1]-center[1],p[0]-center[0]),step=i?delta(angle-previous):0,deviation=Math.abs(dist(center,p)-radius);if(i){if(Math.abs(step)>Math.PI/2||sign&&step*sign<-1e-10)return null;if(Math.abs(step)>1e-10)sign=Math.sign(step);sweep+=step;
   // Hausdorff bound for each source chord versus its circular arc: radial error + sagitta.
   error=Math.max(error,Math.max(radial,deviation)+radius*(1-Math.cos(step/2)));if(error>tolerance)return null;
  }previous=angle;radial=deviation;}
 if(Math.abs(sweep)<.15||Math.abs(sweep)>TAU-.05)return null;
 return {type:'arc',a,b,center,radius,start,sweep,error};
}
function circle(points,tolerance){
 if(points.length<12)return null;const [a,b,c]=[points[0],points[Math.floor(points.length/3)],points[Math.floor(points.length*2/3)]],d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-8)return null;const norm=p=>p[0]**2+p[1]**2,center=[(norm(a)*(b[1]-c[1])+norm(b)*(c[1]-a[1])+norm(c)*(a[1]-b[1]))/d,(norm(a)*(c[0]-b[0])+norm(b)*(a[0]-c[0])+norm(c)*(b[0]-a[0]))/d],radius=dist(center,a);let sweep=0,sign=0,error=0;
 for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],step=delta(Math.atan2(q[1]-center[1],q[0]-center[0])-Math.atan2(p[1]-center[1],p[0]-center[0]));if(Math.abs(step)>Math.PI/2||sign&&step*sign<0)return null;sign=Math.sign(step);sweep+=step;error=Math.max(error,Math.max(Math.abs(dist(center,p)-radius),Math.abs(dist(center,q)-radius))+radius*(1-Math.cos(step/2)));if(error>tolerance)return null;}
 if(Math.abs(Math.abs(sweep)-TAU)>1e-6)return null;return {type:'arc',a,b:a,center,radius,start:Math.atan2(a[1]-center[1],a[0]-center[0]),sweep:sign*TAU,error};
}
function sample(segment,tolerance){
 if(segment.type==='line')return [segment.a,segment.b];const step=Math.min(Math.PI/64,2*Math.acos(Math.max(-1,1-Math.min(tolerance/16,.01)/segment.radius))),count=Math.max(8,Math.ceil(Math.abs(segment.sweep)/Math.max(step,1e-5)));
 if(count>1800)throw Error('円弧が細かすぎます。許容誤差を少し大きくしてください');
 const points=Array.from({length:count+1},(_,i)=>[segment.center[0]+segment.radius*Math.cos(segment.start+segment.sweep*i/count),segment.center[1]+segment.radius*Math.sin(segment.start+segment.sweep*i/count)]);points[0]=segment.a;points[count]=segment.b;return points;
}
const onArc=(s,p)=>{const a=Math.atan2(p[1]-s.center[1],p[0]-s.center[0]);let d=s.sweep>0?(a-s.start+TAU)%TAU:(s.start-a+TAU)%TAU;return d<=Math.abs(s.sweep)+1e-8||TAU-d<1e-8;};
function intersections(a,b){
 if(a.type==='line'&&b.type==='line')return []; // the sampled topology check covers these exactly
 if(a.type==='line'||b.type==='line'){const l=a.type==='line'?a:b,c=a.type==='arc'?a:b,d=l.b.map((v,i)=>v-l.a[i]),f=l.a.map((v,i)=>v-c.center[i]),A=d[0]**2+d[1]**2,B=2*(f[0]*d[0]+f[1]*d[1]),C=f[0]**2+f[1]**2-c.radius**2,D=B*B-4*A*C;if(D<-1e-8)return [];return [-1,1].map(sign=>(-B+sign*Math.sqrt(Math.max(0,D)))/(2*A)).filter(t=>t>=-1e-8&&t<=1+1e-8).map(t=>lerp(l.a,l.b,t)).filter(p=>onArc(c,p));}
 const d=dist(a.center,b.center);if(d<1e-8){if(Math.abs(a.radius-b.radius)>1e-7)return [];return [a.a,a.b,b.a,b.b,pointOn(a,.5),pointOn(b,.5)].filter(p=>onArc(a,p)&&onArc(b,p));}
 if(d>a.radius+b.radius+1e-8||d<Math.abs(a.radius-b.radius)-1e-8)return [];const x=(a.radius**2-b.radius**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.radius**2-x*x)),u=b.center.map((v,i)=>(v-a.center[i])/d),m=a.center.map((v,i)=>v+x*u[i]);return [-1,1].map(sign=>[m[0]-sign*h*u[1],m[1]+sign*h*u[0]]).filter(p=>onArc(a,p)&&onArc(b,p));
}
function pointOn(s,t){return s.type==='line'?lerp(s.a,s.b,t):[s.center[0]+s.radius*Math.cos(s.start+s.sweep*t),s.center[1]+s.radius*Math.sin(s.start+s.sweep*t)];}
export function organizeTraceRings(rings,tolerance,scale=[1,1],size=[1024,1024]){
 if(!Number.isFinite(tolerance)||tolerance<.01||tolerance>10||!scale.every(n=>Number.isFinite(n)&&n>0))throw Error('整理の許容誤差は0.01〜10 mmで指定してください');validateTraceEdits(rings,...size);
 let lines=0,arcs=0,error=0;const all=[];
 const organized=rings.map(r=>{const ps=r.points.map(p=>p.map((v,i)=>v*scale[i])),segments=[],full=circle(ps,tolerance);let at=0;if(full){segments.push(full);at=ps.length;error=Math.max(error,full.error);arcs++;}
  while(at<ps.length){const remaining=ps.length-at,limit=Math.min(remaining,256);let best={...line([ps[at],ps[(at+1)%ps.length]],tolerance),end:1},failed=0;
   for(let n=2;n<=limit;n++){const run=Array.from({length:n+1},(_,i)=>ps[(at+i)%ps.length]),l=line(run,tolerance),c=arc(run,tolerance),fit=c||l;if(fit){best={...fit,end:n};failed=0;}else if(++failed>16)break;}
   segments.push(best);at+=best.end;error=Math.max(error,best.error);best.type==='arc'?arcs++:lines++;
  }
  const pieces=segments.map(s=>({arc:s.type==='arc',...(s.type==='arc'?{endTangent:[-Math.sin(s.start+s.sweep)*Math.sign(s.sweep),Math.cos(s.start+s.sweep)*Math.sign(s.sweep)]}:{}),points:sample(s,tolerance).map(p=>p.map((v,i)=>v/scale[i]))})),points=pieces.flatMap(p=>p.points.slice(0,-1));all.push(...segments.map((s,i)=>({...s,ring:all.length,index:i,count:segments.length})));return {hole:r.hole,points,pieces};
 });
 // Test true circular intersections as well as the tessellated preview, including holes.
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j],adjacent=a.ring===b.ring&&(Math.abs(a.index-b.index)===1||Math.abs(a.index-b.index)===a.count-1);for(const p of intersections(a,b))if(!adjacent||![a.a,a.b].some(q=>dist(p,q)<1e-6&&[b.a,b.b].some(v=>dist(q,v)<1e-6)))throw Error('整理すると輪郭が接触します。許容誤差を小さくしてください');}
 validateTraceEdits(organized,...size);return {rings:organized,lines,arcs,error,original:rings.reduce((n,r)=>n+r.points.length,0)};
}
