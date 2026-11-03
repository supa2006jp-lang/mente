import {dimensionTraceRing} from './reference-trace-dimensions.js';
const TAU=Math.PI*2,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),sub=(a,b)=>a.map((n,k)=>n-b[k]),cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function circleOf(ps){const a=ps[0],b=ps[Math.floor((ps.length-1)/3)],c=ps[Math.floor((ps.length-1)*2/3)],d=2*cross(sub(b,a),sub(c,a));if(Math.abs(d)<1e-10)return null;const q=sub(b,a),r=sub(c,a),Q=q[0]**2+q[1]**2,R=r[0]**2+r[1]**2,center=[a[0]+(Q*r[1]-R*q[1])/d,a[1]+(q[0]*R-r[0]*Q)/d],radius=dist(a,center);let sweep=0;for(let i=1;i<ps.length;i++){const u=sub(ps[i-1],center),v=sub(ps[i],center);sweep+=Math.atan2(cross(u,v),u[0]*v[0]+u[1]*v[1]);}if(ps.some(p=>Math.abs(dist(p,center)-radius)>.00001)||Math.abs(sweep)<.001)return null;return {center,radius,sweep};}
function joins(a,b){
 if(!a.arc&&!b.arc){const u=sub(a.b,a.a),v=sub(b.b,b.a),d=cross(u,v);if(Math.abs(d)<1e-10)return dist(a.b,b.a)<1e-6?[a.b]:[];const t=cross(sub(b.a,a.a),v)/d;return [a.a.map((n,k)=>n+u[k]*t)];}
 if(!a.arc||!b.arc){const l=a.arc?b:a,c=a.arc?a:b,u=sub(l.b,l.a),v=sub(l.a,c.center),A=u[0]**2+u[1]**2,B=2*(u[0]*v[0]+u[1]*v[1]),C=v[0]**2+v[1]**2-c.radius**2,D=B*B-4*A*C;if(D< -1e-6)return [];return [-1,1].map(sign=>l.a.map((n,k)=>n+u[k]*(-B+sign*Math.sqrt(Math.max(0,D)))/(2*A)));}
 const d=dist(a.center,b.center);if(d<1e-7)return Math.abs(a.radius-b.radius)<1e-7&&dist(a.b,b.a)<1e-5?[a.b]:[];if(d>a.radius+b.radius+1e-7||d<Math.abs(a.radius-b.radius)-1e-7)return [];const x=(a.radius**2-b.radius**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.radius**2-x*x)),u=sub(b.center,a.center).map(n=>n/d),m=a.center.map((n,k)=>n+x*u[k]);return [-1,1].map(sign=>[m[0]-sign*h*u[1],m[1]+sign*h*u[0]]);
}
// Topology-changing offsets use the polygon result instead of guessed arcs.
export function offsetTraceCurves(ring,distance,scale){
 try{
  const effective=distance*(ring.hole?-1:1),spec=ring.dimensions;
  if(spec&&spec.type!=='ellipse')return dimensionTraceRing(ring,{width:spec.width+2*effective,height:spec.height+2*effective,radius:spec.radius+effective},scale);
  if(ring.circle)return dimensionTraceRing({...ring,dimensions:{type:'circle',width:ring.circle.radius*2,height:ring.circle.radius*2,center:ring.circle.center.map((n,k)=>n*scale[k]),angle:0}}, {width:(ring.circle.radius+effective)*2},scale);
  if(!ring.pieces?.some(p=>p.arc))return null;
  const pieces=ring.pieces.map(p=>{const ps=p.points.map(q=>q.map((n,k)=>n*scale[k])),a=ps[0],b=ps.at(-1);if(p.arc){const c=circleOf(ps);if(!c)throw Error();const radius=c.radius+distance*Math.sign(c.sweep);if(radius<.05)throw Error();const moved=q=>c.center.map((n,k)=>n+(q[k]-n)*radius/c.radius);return {arc:true,...c,radius,a:moved(a),b:moved(b)};}const u=sub(b,a),length=Math.hypot(...u),delta=[u[1]/length*distance,-u[0]/length*distance];if(length<1e-8)throw Error();return {arc:false,a:a.map((n,k)=>n+delta[k]),b:b.map((n,k)=>n+delta[k])};});
  if(pieces.length===1&&pieces[0].arc&&dist(pieces[0].a,pieces[0].b)<1e-5){const c=pieces[0];return dimensionTraceRing({...ring,dimensions:{type:'circle',width:c.radius*2,height:c.radius*2,center:c.center,angle:0}}, {},scale);}
  const corners=pieces.map((p,i)=>{const next=pieces[(i+1)%pieces.length],target=p.b.map((n,k)=>(n+next.a[k])/2),hits=joins(p,next).sort((a,b)=>dist(a,target)-dist(b,target));if(!hits.length)throw Error();return hits[0];});
  const out=pieces.map((p,i)=>{const a=corners[(i+pieces.length-1)%pieces.length],b=corners[i];if(!p.arc)return {arc:false,points:[a,b].map(q=>q.map((n,k)=>n/scale[k]))};const start=Math.atan2(a[1]-p.center[1],a[0]-p.center[0]),end=Math.atan2(b[1]-p.center[1],b[0]-p.center[0]),sign=Math.sign(p.sweep),sweep=sign*((sign*(end-start)+TAU)%TAU);if(Math.abs(sweep-p.sweep)>Math.PI/2)throw Error();const count=Math.max(8,Math.ceil(Math.abs(sweep)*Math.sqrt(p.radius/.016)));if(count>1800)throw Error();const ps=Array.from({length:count+1},(_,j)=>p.center.map((n,k)=>n+p.radius*(k?Math.sin:Math.cos)(start+sweep*j/count)));ps[0]=a;ps[count]=b;return {arc:true,points:ps.map(q=>q.map((n,k)=>n/scale[k])),startTangent:[-Math.sin(start)*sign,Math.cos(start)*sign],endTangent:[-Math.sin(end)*sign,Math.cos(end)*sign]};});
  return {hole:ring.hole,pieces:out,points:out.flatMap(p=>p.points.slice(0,-1))};
 }catch{return null;}
}
