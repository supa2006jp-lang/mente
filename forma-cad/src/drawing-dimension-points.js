import {drawingCurves} from './drawing-curves.js';
import {pathEndpoints} from './drawing-dimensions.js';
import {completeDrawingCircles} from './drawing-auto-dimensions.js';

export const maxDrawingDimensionPoints=500;

export function drawingDimensionPointFits(view,[x,y],padding=0){
 const [left,top,width,height]=view.viewBox,margin=padding+1e-6;
 if(x<left-margin||x>left+width+margin||y<top-margin||y>top+height+margin)return false;
 const clip=view.clip;
 return !clip||Math.hypot(x-clip.center[0],y-clip.center[1])<=clip.radius+margin;
}

const curveCache=new WeakMap();
function curves(paths){
 if(!curveCache.has(paths)){
  const vertices=new Set(pathEndpoints(paths,{omitStraightSamples:true}).map(point=>point.join(',')));
  curveCache.set(paths,{...drawingCurves(paths),vertices});
 }
 return curveCache.get(paths);
}

const centerTolerance=1e-4,centerCache=new WeakMap();
const sameCenter=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<centerTolerance;

export function drawingDimensionCenterGuides(view,hidden=false){
 const {visible,holeMachining}=view;
 let cache=centerCache.get(visible);
 if(!cache||cache.hiddenPaths!==view.hidden||cache.holeMachining!==holeMachining){
  cache={hiddenPaths:view.hidden,holeMachining};
  centerCache.set(visible,cache);
 }
 const key=hidden&&view.hidden?.length?'withHidden':'visible';
 if(!cache[key]){
  const visibleArcs=curves(visible).arcs;
  const arcs=key==='withHidden'?[...visibleArcs,...curves(view.hidden).arcs]:visibleArcs;
  const centers=[];
  const add=point=>{if(!centers.some(center=>sameCenter(center,point)))centers.push(point);};
  // Prefer the exact machining center when a bore or counterbore rim is shown.
  for(const hole of holeMachining??[]){
   if(arcs.some(arc=>sameCenter(arc.center,hole.center)&&
    (Math.abs(arc.radius-hole.radius)<centerTolerance||
     hole.counterbore&&Math.abs(arc.radius-hole.counterbore.radius)<centerTolerance)))add(hole.center);
  }
  for(const {center} of completeDrawingCircles(view,arcs))add(center);
  cache[key]=centers;
 }
 return cache[key].filter(point=>drawingDimensionPointFits(view,point));
}

function segmentIntersection(a,b){
 const ux=a.b[0]-a.a[0],uy=a.b[1]-a.a[1],vx=b.b[0]-b.a[0],vy=b.b[1]-b.a[1];
 const denominator=ux*vy-uy*vx;
 if(Math.abs(denominator)<=1e-10*Math.hypot(ux,uy)*Math.hypot(vx,vy))return null;
 const x=b.a[0]-a.a[0],y=b.a[1]-a.a[1];
 const t=(x*vy-y*vx)/denominator,s=(x*uy-y*ux)/denominator;
 return t>=0&&t<=1&&s>=0&&s<=1?[a.a[0]+ux*t,a.a[1]+uy*t]:null;
}

export function snapDrawingDimensionPoint(view,point,radius,{hidden=false,accept=()=>true,guide}={}){
 const found=[];
 const distance=p=>Math.hypot(point[0]-p[0],point[1]-p[1]);
 let vertex=null,edge=null,vertexDistance=radius,edgeDistance=radius;
 let crossing=null,crossingDistance=radius;
 const guideAxes=guide?[0,1].filter(axis=>Math.abs(point[axis]-guide[axis])<=radius)
  .sort((a,b)=>Math.abs(point[a]-guide[a])-Math.abs(point[b]-guide[b])):[];
 const usable=p=>drawingDimensionPointFits(view,p)&&accept(p);
 const tryVertex=p=>{
  const d=distance(p);
  if(d<=vertexDistance&&usable(p)){vertex=p;vertexDistance=d;}
 };
 const tryEdge=(p,d)=>{
  if(d<=edgeDistance&&usable(p)){edge=p;edgeDistance=d;}
 };
 const tryCrossing=p=>{
  const d=distance(p);
  if(d<=crossingDistance&&usable(p)&&Math.hypot(p[0]-guide[0],p[1]-guide[1])>=1e-5){
   crossing=p;crossingDistance=d;
  }
 };
 const sources=[curves(view.visible)];
 if(hidden&&view.hidden?.length)sources.push(curves(view.hidden));
 for(const {lines,arcs,vertices} of sources){
  for(const line of lines){
   const {a,b}=line,dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
   const projected=[a[0]+dx*t,a[1]+dy*t],d=distance(projected);
   if(d>radius)continue;
   if(vertices.has(a.join(',')))tryVertex(a);
   if(vertices.has(b.join(',')))tryVertex(b);
   tryEdge(projected,d);
   found.push({line,d});
   const delta=[dx,dy];
   for(const axis of guideAxes){
    const t=delta[axis]?(guide[axis]-a[axis])/delta[axis]:NaN;
    if(!(t>=0&&t<=1))continue;
    const intersection=[a[0]+dx*t,a[1]+dy*t];
    intersection[axis]=guide[axis];
    tryCrossing(intersection);
   }
  }
  for(const arc of arcs){
   tryVertex(arc.a);tryVertex(arc.b);
   const [x,y]=arc.center,tau=2*Math.PI;
   const angle=Math.atan2(point[1]-y,point[0]-x);
   const start=Math.atan2(arc.a[1]-y,arc.a[0]-x),end=Math.atan2(arc.b[1]-y,arc.b[0]-x);
   const along=t=>(((arc.sweep?1:-1)*(t-start))%tau+tau)%tau;
   const onArc=t=>along(t)<=along(end)+1e-9;
   if(onArc(angle)){
    const projected=[x+arc.radius*Math.cos(angle),y+arc.radius*Math.sin(angle)];
    tryEdge(projected,distance(projected));
   }
   for(const axis of guideAxes){
    const offset=guide[axis]-arc.center[axis],other=1-axis;
    if(Math.abs(offset)>arc.radius)continue;
    const half=Math.sqrt(arc.radius**2-offset**2);
    for(const side of [-1,1]){
     const intersection=[...arc.center];
     intersection[axis]=guide[axis];
     intersection[other]+=side*half;
     if(onArc(Math.atan2(intersection[1]-y,intersection[0]-x)))tryCrossing(intersection);
    }
   }
  }
 }
 // Only segments close to the cursor can form a usable crossing.
 const nearby=found.sort((a,b)=>a.d-b.d).slice(0,24);
 for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++){
  const crossing=segmentIntersection(nearby[i].line,nearby[j].line);
  if(crossing)tryVertex(crossing);
 }
 const outlinePoint=crossing??vertex??edge;
 let center=null,centerDistance=outlinePoint?distance(outlinePoint):radius;
 for(const point of drawingDimensionCenterGuides(view,hidden)){
  const d=distance(point);
  if(d<=centerDistance&&accept(point)){center=point;centerDistance=d;}
 }
 // Keep a point on the drawing geometry if the alignment guide cannot reach it nearby.
 if(center||outlinePoint)return center??outlinePoint;
 for(const axis of guideAxes){
  const aligned=[...point];aligned[axis]=guide[axis];
  if(usable(aligned))return aligned;
 }
 return point;
}
