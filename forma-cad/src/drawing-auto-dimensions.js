import {drawingCurves} from './drawing-curves.js';
import {dimensionValue} from './drawing-dimensions.js';
import {circlePatternDimensions,dimensionAxisGraph} from './drawing-feature-dimensions.js';
import {arrangeDrawingDimensions} from './drawing-dimension-layout.js';
import {drawingProjectionNames,drawingProjections,defaultDrawingViewOrder,drawingProjectedFrame} from './drawing-view-preferences.js';
import {drawingDimensionVisible,fullDrawingSpan} from './drawing-break.js';
import {insideView,withDetails} from './drawing-annotations.js';
import {groupDrawingDimensions} from './drawing-dimension-groups.js';

export const autoDimensionTypes={horizontal:'横寸法',vertical:'縦寸法',diameter:'円・穴径',spacing:'中心位置・間隔',radius:'角の半径 R'};
export const autoDimensionKeys=Object.keys(autoDimensionTypes);

const round=n=>Number(n.toFixed(5)),close=(a,b)=>Math.abs(a-b)<1e-5;
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
function key(d){const values=['diameter','radius'].includes(d.kind)?[...d.center,d.radius]:d.kind==='horizontal'?[d.a[0],d.b[0]].sort((a,b)=>a-b):d.kind==='vertical'?[d.a[1],d.b[1]].sort((a,b)=>a-b):[...d.a,...d.b];return [d.view,d.kind,...values.map(round)].join(',');}
const overallAxis=d=>drawingProjections[d.view]?.[d.kind]?.findIndex(n=>n!==0);
function visibleOverallAxis(d,sheet){
 const view=sheet.layout[d.view];
 return d.overall===d.view+d.kind&&!d.review&&view&&drawingDimensionVisible(d,view)?overallAxis(d):undefined;
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

export function overallDrawingDimensions(data,scale=1,sheet,{uniqueAxes=false}={}){
 const dimensions=[];
 // Each projection gets both of its own axes, even when that length also
 // appears in another view. Deduplication remains local to a view.
 for(const view of defaultDrawingViewOrder){
  if(!data.views[view]||sheet&&!sheet.layout[view])continue;
  const {bx:u0,by:v0,width,height}=drawingProjectedFrame(view,data.bounds),u1=u0+width,v1=v0+height;
  const s=sheet?.layout[view]?.scale??scale;
  dimensions.push({view,kind:'horizontal',a:[u0,v1],b:[u1,v1],at:[u0,v1+8/s]},{view,kind:'vertical',a:[u0,v0],b:[u0,v1],at:[u0-8/s,v1]});
 }
 const seen=new Set();
 return dimensions.filter(d=>{
  if(dimensionValue(d)<=1e-7)return false;
  if(!uniqueAxes)return true;
  const axis=overallAxis(d);
  if(seen.has(axis))return false;
  seen.add(axis);
  return true;
 }).map(d=>({...d,overall:d.view+d.kind}));
}
// Only complete visible circles get diameter dimensions. Partial fillets and
// hidden arcs are deliberately excluded; they cannot identify a complete hole.
export function completeDrawingCircles(view,arcs=drawingCurves(view.visible).arcs){const groups=new Map();for(const a of arcs){const id=circleKey(a);if(!groups.has(id))groups.set(id,{center:a.center,radius:a.radius,intervals:[]});let start=Math.atan2(a.a[1]-a.center[1],a.a[0]-a.center[0]),end=Math.atan2(a.b[1]-a.center[1],a.b[0]-a.center[0]);if(!a.sweep)[start,end]=[end,start];while(start<0)start+=Math.PI*2;while(start>=Math.PI*2)start-=Math.PI*2;while(end<=start)end+=Math.PI*2;const list=groups.get(id).intervals;list.push([start,Math.min(end,Math.PI*2)]);if(end>Math.PI*2)list.push([0,end-Math.PI*2]);}return [...groups.values()].filter(c=>{let covered=0,end=0;for(const [a,b]of c.intervals.sort((a,b)=>a[0]-b[0])){if(b>end){covered+=b-Math.max(a,end);end=b;}}return covered>=Math.PI*2-1e-4;}).map(({center,radius})=>({center,radius}));}

export function autoDrawingDimensions(data,scale,existing=[],sheet,{views={},types=autoDimensionKeys,groupRepeated=true,uniqueAxes=false,fontSize,details=[]}={}){
 const enabled=(view,type)=>types.includes(type)&&(views[view]?.includes(type)??true);
 const keys=new Set(),added=[],s=scale,limit=500-existing.length,covered=d=>['diameter','radius'].includes(d.kind)&&d.centers?d.centers.map(center=>key({...d,center})):[key(d)];for(const d of existing)if(!d.review)for(const k of covered(d))keys.add(k);
 const push=d=>{const ids=covered(d);if(added.length>=limit||ids.every(id=>keys.has(id))||dimensionValue(d)<1e-6)return false;ids.forEach(id=>keys.add(id));added.push({...d,automatic:true,...(fontSize===undefined?{}:{fontSize})});return true;};
 const axes=uniqueAxes?new Set(existing.map(d=>visibleOverallAxis(d,sheet))):null;
 for(const d of overallDrawingDimensions(data,s,sheet)){
  if(!enabled(d.view,d.kind))continue;
  const axis=overallAxis(d);
  if(axes?.has(axis))continue;
  if(push(d))axes?.add(axis);
 }
 let remaining=8,skipped=0;
 for(const view of drawingProjectionNames){const v=sheet.layout[view],s=v?.scale??scale,diameter=enabled(view,'diameter'),spacing=enabled(view,'spacing'),radius=enabled(view,'radius');if(!v||!data.views[view]||!diameter&&!spacing&&!radius)continue;
  const shape=data.views[view],curves=drawingCurves(shape.visible),all=completeDrawingCircles(shape,curves.arcs).sort((a,b)=>b.radius-a.radius||a.center[0]-b.center[0]||a.center[1]-b.center[1]),groups=[];
  if(radius){const radii=filletDimensions(view,curves,all,v).filter(d=>!keys.has(key(d)));for(const d of (groupRepeated?groupDrawingDimensions(radii):radii).slice(0,4))push(d);}
  if(!diameter&&!spacing)continue;
  for(const c of all){if(c.radius*s<.75||!drawingDimensionVisible(c,v)){skipped++;continue;}const group=groups.find(g=>close(g.radius,c.radius));if(group)group.centers.push(c.center);else groups.push({radius:c.radius,centers:[c.center]});}
  const selected=groups.filter(g=>g.centers.length<=200).slice(0,Math.min(4,remaining));remaining-=selected.length;skipped+=groups.filter(g=>!selected.includes(g)).reduce((n,g)=>n+g.centers.length,0);
  const centers=[];for(const group of selected){if(diameter){const members=group.centers.filter(center=>!keys.has(key({view,kind:'diameter',center,radius:group.radius})));for(const memberSet of groupRepeated?[members]:members.slice(0,8).map(p=>[p]))if(memberSet.length){const d={view,kind:'diameter',center:memberSet[0],radius:group.radius,at:[memberSet[0][0]+group.radius+7/s,memberSet[0][1]-3/s]};if(memberSet.length>1){d.count=memberSet.length;d.centers=memberSet.map(p=>[...p]);}push(d);}}
   if(!spacing)continue;
   const pattern=circlePatternDimensions(group.centers,view,v);if(pattern){for(const d of pattern.dimensions)push(d);centers.push(pattern.anchor);}else centers.push(...group.centers);
  }
  for(const axis of [0,1]){const coords=[...new Set(centers.map(p=>round(p[axis])))].sort((a,b)=>a-b),origin=axis===0?v.bx:v.by,graph=dimensionAxisGraph([...existing.filter(d=>!d.review),...added],view,axis);let previous=origin;for(const coordinate of coords){if(graph.connected(previous,coordinate)){previous=coordinate;continue;}if((coordinate-previous)*s<4)continue;const bottom=v.by+fullDrawingSpan(v,1),right=v.bx+fullDrawingSpan(v,0);const d=axis===0?{view,kind:'horizontal',a:[previous,bottom],b:[coordinate,bottom],at:[previous,bottom+15/s]}:{view,kind:'vertical',a:[v.bx,previous],b:[v.bx,coordinate],at:[right+7/s,previous]};push(d);graph.join(previous,coordinate);previous=coordinate;}}
 }
 const projected=withDetails(data,details).views;
 for(const view of Object.keys(sheet.layout)){
  if(!view.startsWith('section-')&&!view.startsWith('detail-'))continue;
  const shape=projected[view],v=sheet.layout[view];
  if(!shape)continue;
  const curves=drawingCurves(shape.visible),all=completeDrawingCircles(shape,curves.arcs);
  if(enabled(view,'horizontal')||enabled(view,'vertical'))for(const d of extraLinearDimensions(view,shape,curves.lines,v))if(enabled(view,d.kind))push(d);
  if(enabled(view,'radius')){const radii=filletDimensions(view,curves,all,v,shape).filter(d=>!keys.has(key(d)));for(const d of (groupRepeated?groupDrawingDimensions(radii):radii).slice(0,4))push(d);}
  if(enabled(view,'diameter')){const round=[];for(const {center,radius} of all.filter(c=>c.radius*v.scale>=.75&&(!shape.clip||
   Math.hypot(c.center[0]-shape.clip.center[0],c.center[1]-shape.clip.center[1])+c.radius<=shape.clip.radius+1e-6)).slice(0,4)){
   const d={view,kind:'diameter',center,radius,at:[center[0]+radius+7/v.scale,center[1]]};if(!keys.has(key(d)))round.push(d);
  }for(const d of groupRepeated?groupDrawingDimensions(round):round)push(d);}
 }
 const layout=arrangeDrawingDimensions(added,sheet,existing);return {dimensions:layout.dimensions,skipped,layoutWarnings:layout.unresolved.length};
}
