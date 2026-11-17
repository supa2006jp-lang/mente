import {dimensionLabel,dimensionLabelWidth,drawingDimensionGeometry} from './drawing-dimensions.js';
import {drawingDimensionVisible,drawingModelPoint as local,drawingPaperPoint as map} from './drawing-break.js';
const overlaps=(a,b,p=0)=>a.x<b.x+b.width+p&&a.x+a.width+p>b.x&&a.y<b.y+b.height+p&&a.y+a.height+p>b.y;
const bounds=(points,pad=0)=>{
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.min(...xs)-pad,y=Math.min(...ys)-pad;
 return {x,y,width:Math.max(...xs)+pad-x,height:Math.max(...ys)+pad-y};
};
function segmentHitsBox([a,b],box,pad){
 let lo=0,hi=1;
 for(let i=0;i<2;i++){
  const min=(i?box.y:box.x)-pad,max=min+(i?box.height:box.width)+2*pad,delta=b[i]-a[i];
  if(Math.abs(delta)<1e-10){if(a[i]<min||a[i]>max)return false;continue;}
  const u=(min-a[i])/delta,v=(max-a[i])/delta;
  lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));
  if(lo>hi)return false;
 }
 return true;
}
function arcSegments({center,start,sweep,radius,first,last}){
 const steps=Math.min(64,Math.max(1,Math.ceil(Math.abs(sweep)*Math.sqrt(radius/.8))));
 const lines=[];let a=first;
 for(let i=1;i<=steps;i++){
  const t=start+sweep*i/steps,b=i===steps?last:[center[0]+radius*Math.cos(t),center[1]+radius*Math.sin(t)];
  lines.push([a,b]);a=b;
 }
 return lines;
}
export function dimensionPlacement(d,sheet){
 const view=sheet.layout[d.view],g=view&&drawingDimensionGeometry(d,view);
 if(!g)return null;
 const [x,y]=g.at,font=d.fontSize??3.2,width=dimensionLabelWidth(dimensionLabel(d),font);
 const main=g.arc?arcSegments(g.arc):g.main;
 const arrowBoxes=g.arrows.map(arrow=>bounds(arrow,.1));
 return {box:{x:x-width/2,y:y-font*.75,width,height:font*1.45},main:main.map(line=>bounds(line,.1)),
  extensions:g.extensions.map(line=>bounds(line,.1)),arrowBoxes,strokes:[...main,...g.extensions],radius:d.kind==='radius'};
}
const labelHitsInk=(box,placement)=>placement.arrowBoxes.some(arrow=>overlaps(box,arrow,.6))||
 placement.strokes.some(stroke=>segmentHitsBox(stroke,box,.7));
const labelConflict=(a,b)=>overlaps(a.box,b.box,1)||labelHitsInk(a.box,b)||labelHitsInk(b.box,a);
const arrowConflict=(a,b)=>(a.radius||b.radius)&&(
 a.arrowBoxes.some(box=>b.arrowBoxes.some(other=>overlaps(box,other,.3))||b.strokes.some(stroke=>segmentHitsBox(stroke,box,.3)))||
 b.arrowBoxes.some(box=>a.strokes.some(stroke=>segmentHitsBox(stroke,box,.3))));
function candidates(d,v){const result=[],push=p=>result.push({...d,at:local(v,p)}),at=map(v,d.at),a=d.a&&map(v,d.a),b=d.b&&map(v,d.b),sides=d.kind==='horizontal'?['bottom','top']:d.kind==='vertical'?['left','right']:['right','left','bottom','top'];
 for(let lane=0;lane<16;lane++){const gap=8+lane*(d.kind==='vertical'?4:6);for(const side of sides){if(d.kind==='horizontal')push([at[0],side==='bottom'?v.y+v.height+gap:v.y-gap-3]);else if(d.kind==='vertical')push([side==='left'?v.x-gap:v.x+v.width+gap,at[1]]);else if(d.kind==='aligned'){const u=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...u)||1,n=[-u[1]/l,u[0]/l],sign=side==='right'||side==='top'?1:-1,offset=Math.hypot(v.width,v.height)/2+gap;push([(a[0]+b[0])/2+n[0]*offset*sign,(a[1]+b[1])/2+n[1]*offset*sign]);}else{const c=map(v,d.center);if(side==='right'||side==='left'){const x=side==='right'?v.x+v.width+gap:v.x-gap;for(const dy of [0,-6,6,-12,12])push([x,c[1]+dy]);}else{const y=side==='bottom'?v.y+v.height+gap:v.y-gap-3;for(const dx of [0,-10,10])push([c[0]+dx,y]);}}}}
 return result;
}
function nearbyCandidates(d,v){
 const at=map(v,d.at),result=[d];
 for(const gap of [4,8,12,18,26,36,52]){
  for(const sign of [-1,1]){
   const delta=gap*sign;
   if(d.kind!=='horizontal')result.push({...d,at:local(v,[at[0]+delta,at[1]])});
   if(d.kind!=='vertical')result.push({...d,at:local(v,[at[0],at[1]+delta])});
  }
 }
 return result;
}
function radiusLeaderLength(d,v){
 const label=map(v,d.at),center=map(v,d.center);
 return d.arcPoint?Math.hypot(...map(v,d.arcPoint).map((n,i)=>n-label[i])):
  Math.abs(Math.hypot(...center.map((n,i)=>n-label[i]))-d.radius*v.scale);
}
function radiusCandidates(d,v){
 const center=map(v,d.center),anchor=map(v,d.arcPoint??d.at);
 const angle=Math.atan2(anchor[1]-center[1],anchor[0]-center[0]);
 const tip=d.arcPoint?anchor:null,minimum=Math.max(8,dimensionLabelWidth(dimensionLabel(d),d.fontSize??3.2)/2+4),result=[];
 for(const extra of [0,4,8,12])for(const turn of [0,-30,30,-60,60,-90,90]){
  const t=angle+turn*Math.PI/180,u=[Math.cos(t),Math.sin(t)];
  const start=tip??center.map((n,i)=>n+u[i]*d.radius*v.scale);
  result.push({...d,at:local(v,start.map((n,i)=>n+u[i]*(minimum+extra)))});
 }
 return result;
}
const longRadiusLeader=(d,v)=>d.kind==='radius'&&radiusLeaderLength(d,v)>Math.max(8,dimensionLabelWidth(dimensionLabel(d),d.fontSize??3.2)/2+4)+12.001;
const insidePaper=(box,sheet)=>box.x>=5&&box.y>=18&&box.x+box.width<=sheet.width-5&&box.y+box.height<=sheet.contentBottom-1;

// Move only requested dimensions; callers pass existing annotations as locked.
// Geometry is in paper mm, independent of screen zoom and printed scale.
export function arrangeDrawingDimensions(dimensions,sheet,locked=[],{preferNearby=false}={}){
 const bodies=Object.values(sheet.layout).map(v=>({x:v.x,y:v.y-7,width:v.width,height:v.height+7}));
 const labels=[sheet.note,sheet.holeBox,...(sheet.leaderLabels||[]),...Object.values(sheet.viewTitles||{})].filter(Boolean);
 const placedGeometry=[...locked,...dimensions.filter(d=>d.pinned)].map(d=>dimensionPlacement(d,sheet)).filter(Boolean);
 const placed=dimensions.map(d=>({...d,at:[...d.at]})),unresolved=[];
 const order=placed.map((_,i)=>i).sort((a,b)=>Number(placed[a].kind==='radius')-Number(placed[b].kind==='radius')||
  Number(!!placed[a].overall)-Number(!!placed[b].overall)||Number(placed[a].kind==='diameter')-Number(placed[b].kind==='diameter'));
 for(const i of order){
  const d=placed[i],v=sheet.layout[d.view];
  if(d.pinned||!v||!drawingDimensionVisible(d,v))continue;
  const radius=d.kind==='radius',choices=radius?radiusCandidates(d,v):d.kind==='angle'?[d]:candidates(d,v);
  if(preferNearby&&!radius)choices.unshift(...nearbyCandidates(d,v));
  let best=radius?choices[0]:d,bestGeometry=dimensionPlacement(best,sheet),bestConflicts=Infinity,bestScore=Infinity;
  if(!bestGeometry)continue;
  for(const candidate of choices){
   const p=dimensionPlacement(candidate,sheet),box=p.box;
   if(!insidePaper(box,sheet))continue;
   const conflicts=labels.filter(label=>overlaps(box,label,1)||labelHitsInk(label,p)).length+
    placedGeometry.filter(other=>labelConflict(p,other)).length;
   if(conflicts>bestConflicts)continue;
   const bodyConflicts=bodies.filter(body=>overlaps(box,body,1)||p.main.some(line=>overlaps(line,body,.5))).length;
   const lineConflicts=placedGeometry.filter(other=>arrowConflict(p,other)||
    p.main.some(line=>other.main.some(otherLine=>overlaps(line,otherLine,.5)))).length;
   const distance=preferNearby&&!radius?Math.min(9,Math.hypot(candidate.at[0]-d.at[0],candidate.at[1]-d.at[1])*v.scale/100):0;
   const score=100*bodyConflicts+10*lineConflicts+distance;
   if(conflicts<bestConflicts||score<bestScore){bestConflicts=conflicts;bestScore=score;best=candidate;bestGeometry=p;}
   if(!conflicts&&!score)break;
  }
  placed[i]=best;
  if(bestConflicts||bestScore>=10)unresolved.push(i);
  placedGeometry.push(bestGeometry);
 }
 return {dimensions:placed,unresolved};
}
export function reflowResizedDrawingDimensions(dimensions,sheet,{radiiOnly=false}={}){
 const automatic=d=>!d.pinned&&!d.review&&(d.automatic||d.overall)&&(!radiiOnly||d.kind==='radius');
 const fixed=dimensions.filter(d=>!automatic(d));
 const taken=fixed.map(d=>dimensionPlacement(d,sheet)).filter(Boolean);
 const labels=[sheet.note,sheet.holeBox,...(sheet.leaderLabels||[]),...Object.values(sheet.viewTitles||{})].filter(Boolean);
 const move=[],indices=[];
 const order=dimensions.map((_,i)=>i).filter(i=>automatic(dimensions[i])).sort((a,b)=>Number(dimensions[a].kind==='radius')-Number(dimensions[b].kind==='radius'));
 for(const index of order){
  const d=dimensions[index],placement=dimensionPlacement(d,sheet);
  if(!placement)continue;
  const {box}=placement;
  if(longRadiusLeader(d,sheet.layout[d.view])||!insidePaper(box,sheet)||labels.some(label=>overlaps(box,label,1)||labelHitsInk(label,placement))||
   taken.some(other=>overlaps(box,other.box,1)||(placement.radius||other.radius)&&(labelConflict(placement,other)||arrowConflict(placement,other)))){
   move.push(d);indices.push(index);
  }else{taken.push(placement);fixed.push(d);}
 }
 if(!move.length)return {dimensions,moved:0};
 const next=dimensions.slice(),arranged=arrangeDrawingDimensions(move,sheet,fixed,{preferNearby:true});
 let moved=0;
 indices.forEach((index,i)=>{
  const d=arranged.dimensions[i];
  if(d.at[0]===dimensions[index].at[0]&&d.at[1]===dimensions[index].at[1])return;
  next[index]=d;moved++;
 });
 return {dimensions:next,moved};
}
