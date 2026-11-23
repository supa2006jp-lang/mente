import {drawingCurves} from './drawing-curves.js';
import {dimensionValue,isCircularDimensionKind} from './drawing-dimensions.js';
import {circlePatternDimensions,dimensionAxisGraph} from './drawing-feature-dimensions.js';
import {arrangeDrawingDimensions} from './drawing-dimension-layout.js';
import {drawingProjectionNames,drawingProjections,defaultDrawingViewOrder,drawingProjectedFrame,drawingIsometricOutline} from './drawing-view-preferences.js';
import {drawingDimensionVisible,fullDrawingSpan} from './drawing-break.js';
import {insideView,withDetails} from './drawing-annotations.js';
import {groupDrawingDimensions} from './drawing-dimension-groups.js';
import {adjustedDrawingBoreDimension} from './drawing-thread-dimensions.js';

export const autoDimensionTypes={horizontal:'横寸法',vertical:'縦寸法',diameter:'円・穴径',spacing:'中心位置・間隔',radius:'角の半径 R'};
export const autoDimensionKeys=Object.keys(autoDimensionTypes);
export const autoDimensionViewTypes=view=>view==='iso'?{outline:'外形寸法'}:autoDimensionTypes;

const round=n=>Number(n.toFixed(5)),close=(a,b)=>Math.abs(a-b)<1e-5;
const isoOverallKeys=['iso-x','iso-y','iso-z'];
const isoVertexTolerance=1e-4;
const isoNear=(a,b)=>Math.abs(a-b)<isoVertexTolerance;
const circleKey=c=>[...c.center,c.radius].map(round).join(',');
function filletDimensions(view,curves,circles,placement,shape){
 const full=new Set(circles.map(circleKey)),seen=new Set(),s=placement.scale,result=[];
 const tangent=(arc,p)=>curves.lines.some(line=>{
  const other=Math.hypot(line.a[0]-p[0],line.a[1]-p[1])<1e-4?line.b:Math.hypot(line.b[0]-p[0],line.b[1]-p[1])<1e-4?line.a:null;
  if(!other)return false;
  const x=other[0]-p[0],y=other[1]-p[1];
  return Math.abs((p[0]-arc.center[0])*x+(p[1]-arc.center[1])*y)<.02*arc.radius*Math.hypot(x,y);
 });
 for(const arc of curves.arcs){
  const id=circleKey(arc);
  if(full.has(id)||seen.has(id)||arc.radius*s<.75||arc.large||!drawingDimensionVisible(arc,placement)||!tangent(arc,arc.a)||!tangent(arc,arc.b))continue;
  const direction=arc.a.map((x,i)=>x+arc.b[i]-2*arc.center[i]),length=Math.hypot(...direction);
  if(length<1e-6)continue;
  const arcPoint=arc.center.map((x,i)=>x+direction[i]/length*arc.radius);
  if(shape&&[arc.a,arcPoint,arc.b].some(p=>!insideView(shape,p)))continue;
  const at=arcPoint.map((x,i)=>x+direction[i]/length*8/s);
  result.push({view,kind:'radius',center:arc.center,radius:arc.radius,arcPoint,at});seen.add(id);
  if(result.length>=200)break;
 }
 return result;
}
function extraLinearDimensions(view,shape,lines,placement){
 const dimensions=[];
 const bounds=shape.viewBox,scale=placement.scale;
 for(const axis of [0,1]){
  const kind=axis?'vertical':'horizontal',cross=1-axis;
  const candidates=lines.map(({a,b})=>{
   const span=Math.abs(b[axis]-a[axis]);
   if(span*scale<2.5||Math.abs(b[cross]-a[cross])>1e-5||!insideView(shape,a)||!insideView(shape,b))return null;
   const at=[...a],upper=a[cross]>bounds[cross]+bounds[cross+2]/2;
   at[cross]=bounds[cross]+(upper?bounds[cross+2]+7/scale:-7/scale);
   return {view,kind,a,b,at,feature:'profile-edge'};
  }).filter(Boolean).sort((a,b)=>dimensionValue(a)-dimensionValue(b)||a.a[cross]-b.a[cross]);
  const unique=[];
  for(const dimension of candidates){
   if(unique.some(d=>close(dimensionValue(d),dimensionValue(dimension))))continue;
   unique.push(dimension);
   if(unique.length===4)break;
  }
  dimensions.push(...unique);
 }
 return dimensions;
}
function key(d){
 if(d.kind==='thread'&&d.threadRef){
  const {id,bodyId,end}=d.threadRef;
  return JSON.stringify([d.view,d.kind,d.threadRim,id,bodyId,end]);
 }
 const values=isCircularDimensionKind(d.kind)?[...d.center,d.radius]:d.kind==='horizontal'?[d.a[0],d.b[0]].sort((a,b)=>a-b):d.kind==='vertical'?[d.a[1],d.b[1]].sort((a,b)=>a-b):[...d.a,...d.b];
 return [d.view,d.kind,...values.map(round)].join(',');
}
function diameterGroup(d,centers){
 const center=centers.find(p=>p.every((n,i)=>close(n,d.center[i])))??centers[0];
 return {...d,center,...(centers.length>1?{count:centers.length,centers}:{})};
}
const circleInsideView=(c,shape)=>!shape.clip||Math.hypot(c.center[0]-shape.clip.center[0],c.center[1]-shape.clip.center[1])+c.radius<=shape.clip.radius+1e-6;

// Reuse the placement of existing automatic dimensions when adding bolt sizes.
// If the old diameter grouped several circles, keep the ordinary ones together.
function updateAutomaticBoreDimensions(existing,views,sheet,enabled,limit){
 const updates=new Map(),split=[],annotated=new Set(existing.filter(d=>d.kind==='thread'&&!d.review).map(key));
 for(const [index,d] of existing.entries()){
  const shape=views[d.view],placement=sheet.layout[d.view];
  if(!d.automatic||d.kind!=='diameter'||d.review||!shape||!placement||!enabled(d.view,'diameter'))continue;
  const {centers,count,...format}=d,plain=[],bores=[];
  for(const center of centers??[d.center]){
   const circle={...format,center},size=adjustedDrawingBoreDimension(shape,circle),bore=size&&{...circle,...size};
   if(bore&&!annotated.has(key(bore))&&drawingDimensionVisible(circle,placement)&&circleInsideView(circle,shape))bores.push(bore);
   else plain.push(center);
  }
  if(!bores.length||split.length+bores.length-Number(!plain.length)>limit)continue;
  for(const bore of bores)annotated.add(key(bore));
  updates.set(index,plain.length?diameterGroup(format,plain):bores.shift());
  for(const {pinned,pdfPlacement,...bore} of bores){
   const [x,y]=bore.center,s=placement.scale;
   split.push({...bore,at:[x+bore.radius+7/s,y-3/s]});
  }
 }
 return {updates,split};
}
const overallAxis=d=>d.view==='iso'?isoOverallKeys.indexOf(d.overall):drawingProjections[d.view]?.[d.kind]?.findIndex(n=>n!==0);
function visibleOverallAxis(d,sheet){
 const view=sheet.layout[d.view],axis=overallAxis(d);
 const overall=d.view==='iso'?axis>=0:d.overall===d.view+d.kind;
 return overall&&!d.review&&view&&drawingDimensionVisible(d,view)?axis:undefined;
}

export function hideDuplicateOverallDimensions(dimensions,sheet){
 const keep=new Map(),axes=dimensions.map(d=>visibleOverallAxis(d,sheet));
 const canHide=d=>d.automatic&&!d.pinned&&!d.note&&!d.tolerance&&d.precision===undefined;
 for(const [index,d] of dimensions.entries()){
  const axis=axes[index];
  if(axis===undefined)continue;
  const previous=keep.get(axis);
  if(previous===undefined||canHide(dimensions[previous])&&!canHide(d))keep.set(axis,index);
 }
 let hidden=0;
 const updated=dimensions.map((d,index)=>{
  const reference=keep.get(axes[index]);
  if(reference===undefined||index===reference||!canHide(d)||!close(dimensionValue(d),dimensionValue(dimensions[reference])))return d;
  hidden++;
  return {...d,hidden:true};
 });
 return {dimensions:updated,hidden};
}

function projectionOverallDimensions(data,view,scale){
 const {bx:u0,by:v0,width,height}=drawingProjectedFrame(view,data.bounds),u1=u0+width,v1=v0+height;
 return [
  {view,kind:'horizontal',a:[u0,v1],b:[u1,v1],at:[u0,v1+8/scale],overall:view+'horizontal'},
  {view,kind:'vertical',a:[u0,v0],b:[u0,v1],at:[u0-8/scale,v1],overall:view+'vertical'},
 ];
}

export function overallDrawingDimensions(data,scale=1,sheet,{uniqueAxes=false}={}){
 const dimensions=[];
 // Each projection gets both of its own axes, even when that length also
 // appears in another view. Deduplication remains local to a view.
 for(const view of defaultDrawingViewOrder){
  if(!data.views[view]||sheet&&!sheet.layout[view])continue;
  dimensions.push(...projectionOverallDimensions(data,view,sheet?.layout[view]?.scale??scale));
 }
 const seen=new Set();
 return dimensions.filter(d=>{
  if(dimensionValue(d)<=1e-7)return false;
  if(!uniqueAxes)return true;
  const axis=overallAxis(d);
  if(seen.has(axis))return false;
  seen.add(axis);
  return true;
 });
}

function spansIsoAxis(a,b,axis,[min,max]){
 return max[axis]-min[axis]>2*isoVertexTolerance&&
  isoNear(Math.min(a[axis],b[axis]),min[axis])&&isoNear(Math.max(a[axis],b[axis]),max[axis])&&
  a.every((coordinate,i)=>i===axis||isoNear(coordinate,b[i]));
}

function isoOverallDimension(vertices,bounds,axis,scale,outline){
 const [min,max]=bounds,[u,v]=[0,1,2].filter(i=>i!==axis);
 if(max[axis]-min[axis]<=2*isoVertexTolerance)return null;
 const cell=n=>Math.floor(n/isoVertexTolerance),far=new Map();
 for(const vertex of vertices){
  if(!isoNear(vertex.model[axis],max[axis]))continue;
  const id=cell(vertex.model[u])+','+cell(vertex.model[v]);
  if(!far.has(id))far.set(id,[]);
  far.get(id).push(vertex);
 }
 let best=null,distance=Infinity,normal,lower=Infinity,upper=-Infinity;
 const cross=p=>normal[0]*p[0]+normal[1]*p[1];
 for(const {point:a,model:modelA} of vertices){
  if(!isoNear(modelA[axis],min[axis]))continue;
  const x=cell(modelA[u]),y=cell(modelA[v]);
  for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(const {point:b,model:modelB} of far.get(i+','+j)??[]){
   if(!spansIsoAxis(modelA,modelB,axis,bounds))continue;
   const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length<1e-6)continue;
   if(!normal){
    normal=[-dy/length,dx/length];
    for(const point of outline){
     const coordinate=cross(point);
     lower=Math.min(lower,coordinate);upper=Math.max(upper,coordinate);
    }
   }
   const edge=cross(a);
   const side=edge-lower<upper-edge?-1:1;
   const gap=(side<0?edge-lower:upper-edge)+8/scale;
   if(gap>=distance)continue;
   distance=gap;
   const at=a.map((value,k)=>(value+b[k])/2+side*normal[k]*gap);
   best={view:'iso',kind:'aligned',a,b,modelA,modelB,at,overall:isoOverallKeys[axis]};
  }
 }
 return best;
}

function isOverallDimension(d){
 if(d.view==='iso')return d.kind==='aligned'&&isoOverallKeys.includes(d.overall);
 return drawingProjectionNames.includes(d.view)&&['horizontal','vertical'].includes(d.kind)&&
  d.overall===d.view+d.kind;
}

const plainAutomaticOverall=d=>d.automatic===true&&isOverallDimension(d)&&!d.pinned&&!d.unplaced&&!d.note&&
 !d.feature&&d.repeat==null&&d.tolerance===undefined&&d.displayValue===undefined&&d.manualEndpoints===undefined;

function isCurrentOverall(data,d){
 const view=data.views[d.view];
 if(!view)return false;
 if(d.view==='iso'){
  const axis=isoOverallKeys.indexOf(d.overall);
  const hasVertex=(point,model)=>view.dimensionVertices?.some(vertex=>
   vertex.model.every((value,i)=>isoNear(value,model[i]))&&vertex.point.every((value,i)=>isoNear(value,point[i])));
  return spansIsoAxis(d.modelA,d.modelB,axis,data.bounds)&&hasVertex(d.a,d.modelA)&&hasVertex(d.b,d.modelB);
 }
 const axis=d.kind==='horizontal'?0:1;
 const current=projectionOverallDimensions(data,d.view,1)[axis];
 return isoNear(Math.min(d.a[axis],d.b[axis]),current.a[axis])&&isoNear(Math.max(d.a[axis],d.b[axis]),current.b[axis]);
}

const sameOverallFormat=(old,current)=>['precision','fontSize','lineColor','textColor'].every(
 key=>old[key]==null||old[key]===current[key]);

export function reconcileAutomaticOverallDimensions(data,dimensions,viewScale){
 if(!dimensions.some(d=>d.review&&plainAutomaticOverall(d)))return {dimensions,removed:0,rebuilt:0};
 const current=new Map();
 for(const d of dimensions)if(!d.review&&isOverallDimension(d)&&isCurrentOverall(data,d))current.set(d.overall,d);
 let removed=0,rebuilt=0;
 // Prefer newer placements when a legacy file contains several retired copies of an overall dimension.
 const result=[...dimensions].reverse().flatMap(d=>{
  if(!d.review||!plainAutomaticOverall(d)||!data.views[d.view])return [d];
  const replacement=current.get(d.overall);
  if(replacement){
   if(!sameOverallFormat(d,replacement))return [d];
   removed++;
   return [];
  }
  const scale=viewScale(d.view);
  const measure=d.view==='iso'?
   isoOverallDimension(data.views.iso.dimensionVertices??[],data.bounds,isoOverallKeys.indexOf(d.overall),scale,drawingIsometricOutline(data.bounds)):
   projectionOverallDimensions(data,d.view,scale)[d.kind==='horizontal'?0:1];
  if(!measure||dimensionValue(measure)<=1e-6){
   return [d];
  }
  const {review,alongOffset,pdfPlacement,...format}=d;
  const next={...format,...measure};
  current.set(d.overall,next);
  rebuilt++;
  return [next];
 });
 return {dimensions:result.reverse(),removed,rebuilt};
}

// Only complete visible circles get diameter dimensions. Partial fillets and
// hidden arcs are deliberately excluded; they cannot identify a complete hole.
export function completeDrawingCircles(view,arcs=drawingCurves(view.visible).arcs){const groups=new Map();for(const a of arcs){const id=circleKey(a);if(!groups.has(id))groups.set(id,{center:a.center,radius:a.radius,intervals:[]});let start=Math.atan2(a.a[1]-a.center[1],a.a[0]-a.center[0]),end=Math.atan2(a.b[1]-a.center[1],a.b[0]-a.center[0]);if(!a.sweep)[start,end]=[end,start];while(start<0)start+=Math.PI*2;while(start>=Math.PI*2)start-=Math.PI*2;while(end<=start)end+=Math.PI*2;const list=groups.get(id).intervals;list.push([start,Math.min(end,Math.PI*2)]);if(end>Math.PI*2)list.push([0,end-Math.PI*2]);}return [...groups.values()].filter(c=>{let covered=0,end=0;for(const [a,b]of c.intervals.sort((a,b)=>a[0]-b[0])){if(b>end){covered+=b-Math.max(a,end);end=b;}}return covered>=Math.PI*2-1e-4;}).map(({center,radius})=>({center,radius}));}

export function autoDrawingDimensions(data,scale,existing=[],sheet,{views={},types=autoDimensionKeys,groupRepeated=true,uniqueAxes=false,fontSize,details=[],placed=existing}={}){
 const enabled=(view,type)=>types.includes(type)&&(views[view]?.includes(type)??true);
 const projected=withDetails(data,details).views,limit=500-existing.length;
 const {updates,split:added}=updateAutomaticBoreDimensions(existing,projected,sheet,enabled,limit);
 const current=updates.size?existing.map((d,i)=>updates.get(i)??d):existing;
 const locked=updates.size?placed.map((d,i)=>{
  const index=placed===existing?i:sheet.dimensionIndices?.[i]??i,updated=updates.get(index);
  return updated?{...updated,at:d.at}:d;
 }):placed;
 const keys=new Set(),s=scale,covered=d=>['diameter','radius'].includes(d.kind)&&d.centers?d.centers.map(center=>key({...d,center})):[key(d)];
 for(const d of [...current,...added])if(!d.review)for(const k of covered(d))keys.add(k);
 const push=d=>{const ids=covered(d);if(added.length>=limit||ids.every(id=>keys.has(id))||dimensionValue(d)<1e-6)return false;ids.forEach(id=>keys.add(id));added.push({...d,automatic:true,...(fontSize===undefined?{}:{fontSize})});return true;};
 const circleDimension=(d,shape)=>{
  if(keys.has(key(d)))return null;
  const dimension={...d,...adjustedDrawingBoreDimension(shape,d)};
  return keys.has(key(dimension))?null:dimension;
 };
 const axes=uniqueAxes?new Set(current.map(d=>visibleOverallAxis(d,sheet))):null;
 for(const d of overallDrawingDimensions(data,s,sheet)){
  if(!enabled(d.view,d.kind))continue;
  const axis=overallAxis(d);
  if(axes?.has(axis))continue;
  if(push(d))axes?.add(axis);
 }
 const iso=sheet.layout.iso,vertices=data.views.iso?.dimensionVertices;
 if(iso&&vertices?.length>1&&(views.iso?.includes('outline')??true)){
  const existingIso=current.filter(d=>d.view==='iso'&&!d.review);
  const outline=sheet.isometricOutline??vertices.map(vertex=>vertex.point);
  for(const axis of [0,1,2]){
   if(axes?.has(axis)||!types.includes(axis===2?'vertical':'horizontal')||
    existingIso.some(d=>spansIsoAxis(d.modelA,d.modelB,axis,data.bounds)))continue;
   const dimension=isoOverallDimension(vertices,data.bounds,axis,iso.scale,outline);
   if(dimension)push(dimension);
  }
 }
 let remaining=8,skipped=0;
 for(const view of drawingProjectionNames){const v=sheet.layout[view],s=v?.scale??scale,diameter=enabled(view,'diameter'),spacing=enabled(view,'spacing'),radius=enabled(view,'radius');if(!v||!data.views[view]||!diameter&&!spacing&&!radius)continue;
  const shape=data.views[view],curves=drawingCurves(shape.visible),all=completeDrawingCircles(shape,curves.arcs).sort((a,b)=>b.radius-a.radius||a.center[0]-b.center[0]||a.center[1]-b.center[1]),groups=[];
  if(radius){const radii=filletDimensions(view,curves,all,v).filter(d=>!keys.has(key(d)));for(const d of (groupRepeated?groupDrawingDimensions(radii):radii).slice(0,4))push(d);}
  if(!diameter&&!spacing)continue;
  for(const c of all){if(c.radius*s<.75||!drawingDimensionVisible(c,v)){skipped++;continue;}const group=groups.find(g=>close(g.radius,c.radius));if(group)group.centers.push(c.center);else groups.push({radius:c.radius,centers:[c.center]});}
  const selected=groups.filter(g=>g.centers.length<=200).slice(0,Math.min(4,remaining));remaining-=selected.length;skipped+=groups.filter(g=>!selected.includes(g)).reduce((n,g)=>n+g.centers.length,0);
  const centers=[];
  for(const group of selected){
   if(diameter){
    const {radius}=group;
    const members=group.centers.map(center=>circleDimension({view,kind:'diameter',center,radius,at:[center[0]+radius+7/s,center[1]-3/s]},shape)).filter(Boolean);
    if(groupRepeated){
     const plain=members.filter(d=>d.kind==='diameter');
     for(const d of members)if(d.kind==='thread')push(d);
     if(plain.length)push(diameterGroup(plain[0],plain.map(d=>d.center)));
    }else for(const d of members.slice(0,8))push(d);
   }
   if(!spacing)continue;
   const pattern=circlePatternDimensions(group.centers,view,v);if(pattern){for(const d of pattern.dimensions)push(d);centers.push(pattern.anchor);}else centers.push(...group.centers);
  }
  for(const axis of [0,1]){const coords=[...new Set(centers.map(p=>round(p[axis])))].sort((a,b)=>a-b),origin=axis===0?v.bx:v.by,graph=dimensionAxisGraph([...current.filter(d=>!d.review),...added],view,axis);let previous=origin;for(const coordinate of coords){if(graph.connected(previous,coordinate)){previous=coordinate;continue;}if((coordinate-previous)*s<4)continue;const bottom=v.by+fullDrawingSpan(v,1),right=v.bx+fullDrawingSpan(v,0);const d=axis===0?{view,kind:'horizontal',a:[previous,bottom],b:[coordinate,bottom],at:[previous,bottom+15/s]}:{view,kind:'vertical',a:[v.bx,previous],b:[v.bx,coordinate],at:[right+7/s,previous]};push(d);graph.join(previous,coordinate);previous=coordinate;}}
 }
 for(const view of Object.keys(sheet.layout)){
  if(!view.startsWith('section-')&&!view.startsWith('detail-'))continue;
  const shape=projected[view],v=sheet.layout[view];
  if(!shape)continue;
  const curves=drawingCurves(shape.visible),all=completeDrawingCircles(shape,curves.arcs);
  if(enabled(view,'horizontal')||enabled(view,'vertical'))for(const d of extraLinearDimensions(view,shape,curves.lines,v))if(enabled(view,d.kind))push(d);
  if(enabled(view,'radius')){const radii=filletDimensions(view,curves,all,v,shape).filter(d=>!keys.has(key(d)));for(const d of (groupRepeated?groupDrawingDimensions(radii):radii).slice(0,4))push(d);}
  if(enabled(view,'diameter')){const round=[];for(const {center,radius} of all.filter(c=>c.radius*v.scale>=.75&&circleInsideView(c,shape)).slice(0,4)){
   const d=circleDimension({view,kind:'diameter',center,radius,at:[center[0]+radius+7/v.scale,center[1]]},shape);if(d)round.push(d);
  }for(const d of groupRepeated?groupDrawingDimensions(round):round)push(d);}
 }
 const layout=arrangeDrawingDimensions(added,sheet,locked,{keepOnPaper:true});
 return {dimensions:layout.dimensions,existing:current,updated:updates.size,skipped,layoutWarnings:layout.unresolved.length};
}
