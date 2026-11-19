import {withDetails,insideView,circles} from './drawing-annotations.js';
import {drawingCurves} from './drawing-curves.js';
import {dimensionValue} from './drawing-dimensions.js';
import {reconcileDrawingDimensions} from './drawing-dimension-references.js';
import {drawingProjections} from './drawing-view-preferences.js';

const epsilon=1e-4;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const same=(a,b)=>distance(a,b)<epsilon;
const offset=(p,a,b)=>p.map((v,i)=>v+b[i]-a[i]);
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);

function nearestEdge(old,lines,limit){
 const u=old.b.map((v,i)=>v-old.a[i]),length=Math.hypot(...u);
 if(length<epsilon)return null;
 let best=null,score=Infinity,ambiguous=false;
 for(const line of lines){
  let {a,b}=line;
  const v=b.map((n,i)=>n-a[i]),span=Math.hypot(...v);
  if(span<epsilon)continue;
  const cosine=(u[0]*v[0]+u[1]*v[1])/(length*span);
  if(Math.abs(cosine)<.995)continue;
  if(cosine<0)[a,b]=[b,a];
  const da=distance(old.a,a),db=distance(old.b,b);
  if(Math.max(da,db)>Math.min(limit,Math.min(length,span)*.45)+epsilon)continue;
  const cost=da+db;
  if(cost<score-epsilon){best={a,b};score=cost;ambiguous=false;}
  else if(Math.abs(cost-score)<epsilon&&best&&(!same(a,best.a)||!same(b,best.b)))ambiguous=true;
 }
 return ambiguous?null:best;
}

function sectionEdges(before,after,transform){
 const lines=v=>drawingCurves(v.visible).lines.filter(l=>insideView(v,l.a)&&insideView(v,l.b));
 const old=lines(before).map(l=>({a:transform(l.a),b:transform(l.b)})),next=lines(after);
 const limit=.12*Math.hypot(before.viewBox[2],before.viewBox[3]);
 const belongs=(a,b,l)=>same(a,l.a)&&same(b,l.b)||same(a,l.b)&&same(b,l.a);
 function follow(a,b){
  const candidate=nearestEdge({a,b},next,limit);
  if(!candidate)return null;
  const back=nearestEdge(candidate,old,limit);
  return back&&same(back.a,a)&&same(back.b,b)?candidate:null;
 }
 function point(p){
  const incident=old.filter(l=>same(l.a,p)||same(l.b,p));
  const hits=incident.map(l=>{const edge=follow(l.a,l.b);return edge&&(same(l.a,p)?edge.a:edge.b);}).filter(Boolean);
  return hits.length&&hits.every(hit=>same(hit,hits[0]))?hits[0]:null;
 }
 return {has:(a,b)=>old.some(l=>belongs(a,b,l)),follow,point};
}

function projectAnnotation(item,transform){
 const next={...item};
 for(const key of ['a','b','at','center','vertex','arcPoint','anchor'])if(item[key])next[key]=transform(item[key]);
 if(item.centers)next.centers=item.centers.map(transform);
 return next;
}

// A section keeps its view ID. On reversal its camera mirrors one sheet coordinate.
export function followSectionEdit(previous,current,before,after,{dimensions,details,markers,leaders,dimensionPoints=[]}){
 const axis=drawingProjections[before.view][before.orientation==='vertical'?'horizontal':'vertical'];
 const mirror=before.reverse===after.reverse?-1:axis[2]?1:0;
 const transform=p=>p.map((v,i)=>i===mirror?-v:v);
 const affected=new Set([before.id]);
 const nextDetails=details.map(d=>{
  if(!affected.has(d.view))return d;
  affected.add(d.id);return {...d,center:transform(d.center)};
 });
 const oldData=withDetails(previous,details),newData=withDetails(current,nextDetails);
 const references={},edges=new Map();
 for(const name of affected){
  const old=oldData.views[name],next=newData.views[name];if(!old||!next)continue;
  edges.set(name,sectionEdges(old,next,transform));
  const box=old.viewBox.slice();if(mirror>=0)box[mirror]=-box[mirror]-box[mirror+2];
  references[name]={box,circles:circles(old).filter(c=>insideView(old,c.center)).map(c=>({center:transform(c.center),radius:c.radius}))};
 }
 const nextDimensions=dimensions.map(original=>{
  if(!affected.has(original.view))return original;
  const d=projectAnnotation(original,transform),edge=edges.get(d.view);
  delete d.review;
  if(edge&&d.a&&d.b&&!d.vertex&&!d.manualEndpoints?.length){
   let endpoints;
   if(edge.has(d.a,d.b)){
    endpoints=edge.follow(d.a,d.b);
    if(!endpoints)return {...d,review:true};
   }else{
    const a=edge.point(d.a),b=edge.point(d.b);
    if(a&&b)endpoints={a,b};
   }
   if(endpoints&&dimensionValue({...d,...endpoints})>epsilon){
    return {...d,...endpoints,at:offset(d.at,midpoint(d.a,d.b),midpoint(endpoints.a,endpoints.b))};
   }
  }
  return reconcileDrawingDimensions(newData,[d],references)[0];
 });
 const nextMarkers=markers.map(m=>{
  if(!affected.has(m.view))return m;
  const next=projectAnnotation(m,transform),edge=edges.get(m.view);
  if(next.a&&edge){next.a=edge.point(next.a)??next.a;next.b=edge.point(next.b)??next.b;}
  return next;
 });
 const nextLeaders=leaders.map(note=>{
  if(!affected.has(note.view))return note;
  const next=projectAnnotation(note,transform),anchor=edges.get(note.view)?.point(next.anchor);
  return anchor?{...next,anchor,at:offset(next.at,next.anchor,anchor)}:next;
 });
 const nextPoints=dimensionPoints.map(item=>affected.has(item.view)?{...item,point:transform(item.point)}:item);
 return {dimensions:nextDimensions,details:nextDetails,markers:nextMarkers,leaders:nextLeaders,dimensionPoints:nextPoints};
}
