import {drawingCurves} from './drawing-curves.js';

export const maxDrawingDimensionPoints=500;

export function drawingDimensionPointFits(view,[x,y],padding=0){
 const [left,top,width,height]=view.viewBox,margin=padding+1e-6;
 if(x<left-margin||x>left+width+margin||y<top-margin||y>top+height+margin)return false;
 const clip=view.clip;
 return !clip||Math.hypot(x-clip.center[0],y-clip.center[1])<=clip.radius+margin;
}

const curveCache=new WeakMap();
function curves(paths){
 if(!curveCache.has(paths))curveCache.set(paths,drawingCurves(paths));
 return curveCache.get(paths);
}

function segmentIntersection(a,b){
 const ux=a.b[0]-a.a[0],uy=a.b[1]-a.a[1],vx=b.b[0]-b.a[0],vy=b.b[1]-b.a[1];
 const denominator=ux*vy-uy*vx;
 if(Math.abs(denominator)<=1e-10*Math.hypot(ux,uy)*Math.hypot(vx,vy))return null;
 const x=b.a[0]-a.a[0],y=b.a[1]-a.a[1];
 const t=(x*vy-y*vx)/denominator,s=(x*uy-y*ux)/denominator;
 return t>=0&&t<=1&&s>=0&&s<=1?[a.a[0]+ux*t,a.a[1]+uy*t]:null;
}

export function snapDrawingDimensionPoint(view,point,radius,{hidden=false,accept=()=>true}={}){
 const found=[];
 const distance=p=>Math.hypot(point[0]-p[0],point[1]-p[1]);
 let vertex=null,edge=null,vertexDistance=radius,edgeDistance=radius;
 const usable=p=>drawingDimensionPointFits(view,p)&&accept(p);
 const tryVertex=p=>{
  const d=distance(p);
  if(d<=vertexDistance&&usable(p)){vertex=p;vertexDistance=d;}
 };
 const tryEdge=(p,d)=>{
  if(d<=edgeDistance&&usable(p)){edge=p;edgeDistance=d;}
 };
 const sources=[curves(view.visible)];
 if(hidden&&view.hidden?.length)sources.push(curves(view.hidden));
 for(const {lines,arcs} of sources){
  for(const line of lines){
   const {a,b}=line,dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
   const projected=[a[0]+dx*t,a[1]+dy*t],d=distance(projected);
   if(d>radius)continue;
   tryVertex(a);tryVertex(b);tryEdge(projected,d);
   found.push({line,d});
  }
  for(const arc of arcs){
   tryVertex(arc.a);tryVertex(arc.b);
   const [x,y]=arc.center,tau=2*Math.PI;
   const angle=Math.atan2(point[1]-y,point[0]-x);
   const start=Math.atan2(arc.a[1]-y,arc.a[0]-x),end=Math.atan2(arc.b[1]-y,arc.b[0]-x);
   const along=t=>(((arc.sweep?1:-1)*(t-start))%tau+tau)%tau;
   if(along(angle)>along(end)+1e-9)continue;
   const projected=[x+arc.radius*Math.cos(angle),y+arc.radius*Math.sin(angle)];
   tryEdge(projected,distance(projected));
  }
 }
 // Only segments close to the cursor can form a usable crossing.
 const nearby=found.sort((a,b)=>a.d-b.d).slice(0,24);
 for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++){
  const crossing=segmentIntersection(nearby[i].line,nearby[j].line);
  if(crossing)tryVertex(crossing);
 }
 return vertex??edge??point;
}
