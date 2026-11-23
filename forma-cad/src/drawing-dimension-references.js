import {circles,insideView} from './drawing-annotations.js';
import {drawingCurves} from './drawing-curves.js';
import {dimensionValue,isCircularDimensionKind,pathEndpoints} from './drawing-dimensions.js';
import {drawingProjectedFrame,drawingProjections} from './drawing-view-preferences.js';
import {drawingDimensionCenterGuides,drawingDimensionPointFits} from './drawing-dimension-points.js';
import {sameProjectedThreadRim} from './drawing-thread-dimensions.js';

const epsilon=1e-4;
export const drawingReferenceCircleLimit=256;
const near=(a,b)=>Math.abs(a-b)<=epsilon;
const samePoint=(a,b)=>near(a[0],b[0])&&near(a[1],b[1]);
const sameCircle=(a,b)=>samePoint(a.center,b.center)&&near(a.radius,b.radius);
const translate=(at,old,next)=>at.map((value,i)=>value+next[i]-old[i]);
const midpoint=(a,b)=>a.map((value,i)=>(value+b[i])/2);

const cache=new WeakMap();
function geometry(view){
 if(!cache.has(view)){
  const round=circles(view).filter(c=>insideView(view,c.center));
  cache.set(view,{round,points:pathEndpoints(view.visible).filter(p=>insideView(view,p))});
 }
 return cache.get(view);
}
function frame(data,name){
 if(!data.views[name])return null;
 if(!Object.hasOwn(drawingProjections,name))return data.views[name].viewBox;
 const {bx,by,width,height}=drawingProjectedFrame(name,data.bounds);
 return [bx,by,width,height];
}
export function captureDrawingReferences(data,dimensions,previous={}){
 const result={};
 for(const name of new Set(dimensions.filter(d=>!d.review&&d.view!=='iso').map(d=>d.view))){
  if(!data.views[name]){
   if(previous[name])result[name]=previous[name];
   continue;
  }
  const {round}=geometry(data.views[name]);
  result[name]={box:frame(data,name)};
  if(round.length<=drawingReferenceCircleLimit)result[name].circles=round.map(({center,radius})=>({center,radius}));
 }
 return result;
}
function circleFollower(current,reference){
 const before=reference?.circles;
 const equalCount=before?.length===current.length;
 const removed=equalCount?before.filter(c=>!current.some(n=>sameCircle(c,n))):[];
 const added=removed.length===1?current.filter(c=>!before.some(n=>sameCircle(c,n))):[];
 const replacement=added.length===1?added[0]:null;
 return old=>{
  const exact=current.find(c=>sameCircle(c,old));
  if(exact)return exact;
  if(!replacement||!sameCircle(removed[0],old))return null;
  const distance=Math.hypot(...replacement.center.map((x,i)=>x-old.center[i]));
  const maxMove=.2*Math.hypot(reference.box[2],reference.box[3]);
  return distance<=epsilon||near(replacement.radius,old.radius)&&distance<=maxMove?replacement:null;
 };
}
function atBound(value,box,axis){
 if(near(value,box[axis]))return 0;
 if(near(value,box[axis]+box[axis+2]))return 1;
 return null;
}
function followPoint(point,{points,round,follow},reference,box,view){
 const oldCenters=reference?.circles?.filter(c=>samePoint(c.center,point))||[];
 if(oldCenters.length){
  const matches=oldCenters.map(follow);
  return matches.every(c=>c&&samePoint(c.center,matches[0]?.center))?matches[0].center:null;
 }
 const exact=points.find(p=>samePoint(p,point))??drawingDimensionCenterGuides(view,true).find(guide=>samePoint(guide.point,point))?.point;
 if(exact)return exact;
 if(!reference)return round.find(c=>samePoint(c.center,point))?.center??null;
 const sides=point.map((x,i)=>atBound(x,reference.box,i));
 if(sides.includes(null))return null;
 const corner=sides.map((side,i)=>box[i]+side*box[i+2]);
 return points.find(p=>samePoint(p,corner))??null;
}
function overall(d,box,reference){
 const [x,y,w,h]=box,axis=d.kind==='vertical'?0:1;
 const a=d.kind==='vertical'?[x,y]:[x,y+h],b=d.kind==='vertical'?[x,y+h]:[x+w,y+h];
 const oldBox=reference?.box,at=translate(d.at,midpoint(d.a,d.b),midpoint(a,b));
 if(oldBox){
  const side=d.at[axis]<oldBox[axis]+oldBox[axis+2]/2?0:1;
  at[axis]=d.at[axis]+box[axis]+side*box[axis+2]-oldBox[axis]-side*oldBox[axis+2];
 }
 return {...d,a,b,at};
}
function followCircleDimension(d,follow){
 const hits=(d.centers??[d.center]).map(center=>follow({center,radius:d.radius}));
 if(hits.some(hit=>!hit)||new Set(hits).size!==hits.length||hits.some(hit=>!near(hit.radius,hits[0].radius)))return null;
 const {center,radius}=hits[0];
 const at=translate(d.at,d.center,center);
 const ray=at.map((n,i)=>n-center[i]),length=Math.hypot(...ray);
 if(length)for(let i=0;i<2;i++)at[i]+=ray[i]/length*(radius-d.radius);
 const arcPoint=d.arcPoint?.map((value,i)=>center[i]+(value-d.center[i])*radius/d.radius);
 return {...d,center,radius,at,...(arcPoint?{arcPoint}:{}),...(d.centers?{centers:hits.map(c=>c.center)}:{})};
}
function followLocation(d,{round,follow},reference,box){
 const axis=d.kind==='horizontal'?0:1,side=1-axis;
 const match=(p,isFirst)=>{
  if(isFirst&&near(p[axis],(reference?.box??box)[axis]))return box[axis];
  if(!reference?.circles)return round.some(c=>near(c.center[axis],p[axis]))?p[axis]:null;
  const old=reference.circles.filter(c=>near(c.center[axis],p[axis]));
  const hits=old.map(follow);
  if(!hits.length||hits.some(c=>!c||!near(c.center[axis],hits[0]?.center[axis])))return null;
  return hits[0].center[axis];
 };
 const a=[...d.a],b=[...d.b];
 a[axis]=match(d.a,true);b[axis]=match(d.b,false);
 if(a[axis]===null||b[axis]===null)return null;
 a[side]=b[side]=box[side]+(axis===0?box[side+2]:0);
 return {...d,a,b,at:translate(d.at,midpoint(d.a,d.b),midpoint(a,b))};
}
function followPitch(d,{round,follow},reference){
 const axis=d.kind==='horizontal'?0:1,side=1-axis;
 const count=d.repeat?.count??1,step=(d.b[axis]-d.a[axis])/count;
 const old=reference?.circles??round;
 const seeds=old.filter(c=>samePoint(c.center,d.a));
 const runs=seeds.map(seed=>Array.from({length:count+1},(_,i)=>{
  const center=[...d.a];center[axis]+=i*step;
  const circle=old.find(c=>samePoint(c.center,center)&&near(c.radius,seed.radius));
  return circle&&follow(circle);
 })).filter(run=>run.every(Boolean));
 if(runs.length!==1)return null;
 const run=runs[0],a=run[0].center,b=run.at(-1).center,pitch=(b[axis]-a[axis])/count;
 if(!run.every((c,i)=>near(c.center[side],a[side])&&near(c.center[axis],a[axis]+i*pitch)&&near(c.radius,run[0].radius)))return null;
 return {...d,a,b,at:translate(d.at,midpoint(d.a,d.b),midpoint(a,b)),...(d.repeat?{repeat:{count,pitch:Math.abs(pitch)}}:{})};
}
function unchangedAngle(d,view){
 const lines=drawingCurves(view.visible).lines;
 return [d.a,d.b].every(point=>lines.some(({a,b})=>{
  if(!samePoint(a,point)&&!samePoint(b,point))return false;
  const [x,y]=b.map((n,i)=>n-a[i]),[u,v]=d.vertex.map((n,i)=>n-a[i]);
  return Math.abs(x*v-y*u)<=epsilon*Math.hypot(x,y);
 }));
}
export function followIsometricDimension(d,view){
 const find=model=>view?.dimensionVertices?.find(vertex=>model.every((value,axis)=>near(value,vertex.model[axis])));
 const first=find(d.modelA),second=find(d.modelB);
 if(!first||!second||samePoint(first.point,second.point))return null;
 const a=first.point,b=second.point;
 return {...d,a,b,modelA:first.model,modelB:second.model,at:translate(d.at,midpoint(d.a,d.b),midpoint(a,b))};
}
export function reconcileDrawingHolePoints(points,resolveHoleCenter){
 return points.map(item=>{
  if(!item.holeRef)return item;
  const point=resolveHoleCenter(item.view,item.holeRef);
  if(!point)return {...item,review:true};
  const {review,...current}=item;
  return {...current,point};
 });
}

export function reconcileDrawingDimensions(data,dimensions,references,{targetsChanged=false,resolveHoleCenter}={}){
 const contexts=new Map();
 const context=(name,view,reference)=>{
  if(!contexts.has(name)){
   const shape=geometry(view);
   contexts.set(name,{...shape,follow:circleFollower(shape.round,reference)});
  }
  return contexts.get(name);
 };
 return dimensions.map(d=>{
  if(d.review&&(d.unplaced||!(d.kind==='thread'&&d.threadRef||d.holeRefs&&resolveHoleCenter)))return d;
  const view=data.views[d.view],box=frame(data,d.view),reference=references[d.view];
  let updated;
  if(view&&!targetsChanged){
   if(d.view==='iso')updated=followIsometricDimension(d,view);
   else if(['horizontal','vertical'].includes(d.kind)&&d.overall===d.view+d.kind)updated=overall(d,box,reference);
   else if(d.kind==='thread'&&d.threadRef){
    const rim=sameProjectedThreadRim(view,d);
    if(rim){
     updated=followCircleDimension(d,()=>rim);
     updated.nominalDiameter=rim.thread.diameter;
     if(d.pdfPlacement)updated.pdfPlacement={...d.pdfPlacement,at:translate(d.pdfPlacement.at,d.at,updated.at)};
     delete updated.review;
    }
   }
   else if(isCircularDimensionKind(d.kind))updated=followCircleDimension(d,context(d.view,view,reference).follow);
   else if(d.kind==='angle')updated=unchangedAngle(d,view)?d:null;
   else if(d.feature==='pitch')updated=followPitch(d,context(d.view,view,reference),reference);
   else if(d.automatic&&d.feature!=='profile-edge')updated=followLocation(d,context(d.view,view,reference),reference,box);
   else{
    const shape=context(d.view,view,reference);
    const endpoint=key=>{
     if(d.holeRefs?.[key])return resolveHoleCenter?.(d.view,d.holeRefs[key]);
     if(d.manualEndpoints?.includes(key))return drawingDimensionPointFits(view,d[key])?d[key]:null;
     return followPoint(d[key],shape,reference,box,view);
    };
    const a=endpoint('a'),b=endpoint('b');
    if(a&&b){
     const {review,...current}=d,previous=midpoint(d.a,d.b),next=midpoint(a,b);
     updated={...current,a,b,at:translate(d.at,previous,next)};
     if(d.holeRefs&&d.pdfPlacement)updated.pdfPlacement={...d.pdfPlacement,at:translate(d.pdfPlacement.at,previous,next)};
    }
   }
  }
  return updated&&dimensionValue(updated)>epsilon?updated:{...d,review:true};
 });
}
