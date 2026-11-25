import {dimensionLabel,dimensionLabelWidth,dimensionValue,drawingDimensionGeometry} from './drawing-dimensions.js';
import {drawingDimensionVisible,drawingModelPoint as local,drawingPaperPoint as map} from './drawing-break.js';
import {drawingBoxPlacementIssue} from './drawing-paper-bounds.js';
import {projectDrawingIsometric} from './drawing-view-preferences.js';
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
  if(max<min)return false;
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
 const box={x:x-width/2,y:y-font*.75,width,height:font*1.45};
 return {box,main:main.map(line=>bounds(line,.1)),
  extensions:g.extensions.map(line=>bounds(line,.1)),arrowBoxes,strokes:[...main,...g.extensions],
  primary:d.center?[g.extensions[0]]:main,radius:d.kind==='radius',linear:!!g.direction};
}
const labelHitsInk=(box,placement)=>placement.arrowBoxes.some(arrow=>overlaps(box,arrow,.6))||
 placement.strokes.some(stroke=>segmentHitsBox(stroke,box,.7));
const labelConflict=(a,b)=>overlaps(a.box,b.box,1)||labelHitsInk(a.box,b)||labelHitsInk(b.box,a);
const arrowConflict=(a,b)=>(a.radius||b.radius)&&(
 a.arrowBoxes.some(box=>b.arrowBoxes.some(other=>overlaps(box,other,.3))||b.strokes.some(stroke=>segmentHitsBox(stroke,box,.3)))||
 b.arrowBoxes.some(box=>a.strokes.some(stroke=>segmentHitsBox(stroke,box,.3))));

const hitArea=(a,b)=>({
 x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),
 width:Math.max(.4,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),
 height:Math.max(.4,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)),
});
function collinearOverlap([a,b],[c,d]){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<1)return null;
 const distance=p=>Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length;
 if(distance(c)>.18||distance(d)>.18)return null;
 const at=p=>(dx*(p[0]-a[0])+dy*(p[1]-a[1]))/length;
 const lo=Math.max(0,Math.min(at(c),at(d))),hi=Math.min(length,Math.max(at(c),at(d)));
 if(hi-lo<1)return null;
 return bounds([lo,hi].map(t=>[a[0]+dx*t/length,a[1]+dy*t/length]),.15);
}
function collisionEnvelope(p){
 return p.envelope??=bounds([...p.strokes.flat(),...(p.arrowBoxes.concat(p.box)).flatMap(boxCorners)]);
}
function dimensionOverlap(a,b){
 if(!overlaps(collisionEnvelope(a),collisionEnvelope(b),.4))return null;
 if(overlaps(a.box,b.box))return {reason:'文字同士',box:hitArea(a.box,b.box)};
 for(const [p,q] of [[a,b],[b,a]]){
  const arrow=q.arrowBoxes.find(box=>overlaps(p.box,box));
  if(arrow)return {reason:'文字と矢印',box:hitArea(p.box,arrow)};
  if(q.strokes.some(line=>segmentHitsBox(line,p.box,.1)))return {reason:'文字と寸法線',box:p.box};
 }
 for(const [p,q] of [[a,b],[b,a]])for(const arrow of p.arrowBoxes){
  if(q.arrowBoxes.some(box=>overlaps(arrow,box,-.3))||
   q.primary.some(line=>segmentHitsBox(line,arrow,-.3)))return {reason:'矢印の重なり',box:arrow};
 }
 for(const first of a.primary)for(const second of b.primary){
  const box=collinearOverlap(first,second);
  if(box)return {reason:'寸法線同士',box};
 }
 return null;
}
function dimensionObstacles(sheet){
 return [
  ...Object.values(sheet.viewTitles||{}).map(box=>({box,reason:'見出し枠'})),
  ...(sheet.headerBox?[{box:sheet.headerBox,reason:'用紙の見出し'}]:[]),
  ...[...(sheet.notes??[sheet.note]).map(note=>[note,'コメント']),[sheet.holeBox,'穴位置表'],...(sheet.leaderLabels||[]).map(box=>[box,'矢印付き注記'])]
   .filter(([box])=>box).map(([box,reason])=>({box,reason})),
 ];
}
function obstacleOverlap(placement,obstacles){
 for(const {box,reason} of obstacles){
  if(overlaps(box,placement.box))return {box:hitArea(box,placement.box),reason};
  if(placement.arrowBoxes.some(arrow=>overlaps(arrow,box))||placement.strokes.some(line=>segmentHitsBox(line,box,.1)))return {box,reason};
 }
 return null;
}
export function drawingDimensionConflicts(dimensions,sheet){
 const obstacles=dimensionObstacles(sheet),issues=new Map();
 const entries=dimensions.flatMap((d,index)=>{
  const placement=dimensionPlacement(d,sheet);
  return placement?[{index,placement}]:[];
 });
 for(const {index,placement} of entries){
  const issue=obstacleOverlap(placement,obstacles);
  if(issue)issues.set(index,{index,...issue});
 }
 for(let j=0;j<entries.length;j++)for(let i=0;i<j;i++){
  const a=entries[i],b=entries[j];
  if(issues.has(a.index)&&issues.has(b.index))continue;
  const issue=dimensionOverlap(a.placement,b.placement);
  if(!issue)continue;
  if(!issues.has(a.index))issues.set(a.index,{index:a.index,...issue});
  if(!issues.has(b.index))issues.set(b.index,{index:b.index,...issue});
 }
 return [...issues.values()].sort((a,b)=>a.index-b.index);
}
const boxCorners=({x,y,width,height})=>[[x,y],[x+width,y],[x+width,y+height],[x,y+height]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const normalTo=([x,y])=>[-y,x];
const projectionRange=(points,normal)=>{
 const projected=points.map(p=>dot(p,normal));
 return {normal,min:Math.min(...projected),max:Math.max(...projected)};
};
const orthogonalNormals=[[1,0],[0,1]];
const isoNormals=orthogonalNormals.concat([[1,0,0],[0,1,0]].map(axis=>{
 const direction=projectDrawingIsometric(axis),length=Math.hypot(...direction);
 return normalTo(direction.map(n=>n/length));
}));
function drawingViewShapes(sheet){
 return Object.entries(sheet.layout).map(([name,view])=>{
  const iso=name==='iso'&&sheet.isometricOutline?.length;
  const points=iso?sheet.isometricOutline.map(point=>map(view,point)):boxCorners(view);
  const limits=(iso?isoNormals:orthogonalNormals).map(normal=>projectionRange(points,normal));
  return {name,points,limits,box:bounds(points)};
 });
}

// Use the angle of the measured edge to place each lane beyond the actual projected outline.
function linearCandidates(d,v,shape,{moveOverallAnchors=false}={}){
 const geometry=drawingDimensionGeometry(d,v);
 if(!geometry?.direction)return [d];
 const normal=normalTo(geometry.direction);
 const {min,max}=projectionRange(shape.points,normal),at=map(v,d.at),coordinate=dot(at,normal);
 const laneSpacing=Math.max(6,(d.fontSize??3.2)*1.45+1);
 const gaps=[...Array.from({length:12},(_,i)=>8+i*laneSpacing),5,3];
 // Prefer the lower edge for widths and the right edge for heights.
 const positive=normal[1]>0||Math.abs(normal[1])<1e-9&&normal[0]>0;
 const anchor=moveOverallAnchors?map(v,d.a):null;
 const result=[];
 for(const gap of gaps){
  const lanes=[[min,min-gap],[max,max+gap]];
  if(positive)lanes.reverse();
  for(const [edge,lane] of lanes){
   const candidate={...d,at:local(v,at.map((n,i)=>n+normal[i]*(lane-coordinate)))};
   if(anchor){
    // Only change the perpendicular coordinate of a full-width or full-height measurement.
    const axis=d.kind==='vertical'?0:1;
    candidate.a=[...d.a];candidate.b=[...d.b];
    const first=local(v,anchor.map((n,i)=>n+normal[i]*(edge-dot(anchor,normal))));
    candidate.a[axis]=candidate.b[axis]=first[axis];
   }
   result.push(candidate);
  }
 }
 return result;
}
function circularCandidates(d,v){
 const result=[],c=map(v,d.center),push=(x,y)=>result.push({...d,at:local(v,[x,y])});
 for(let lane=0;lane<16;lane++){
  const gap=8+lane*6;
  for(const x of [v.x+v.width+gap,v.x-gap])for(const dy of [0,-6,6,-12,12])push(x,c[1]+dy);
  for(const y of [v.y+v.height+gap,v.y-gap-3])for(const dx of [0,-10,10])push(c[0]+dx,y);
 }
 return result;
}
function nearbyCandidates(d,v){
 const at=map(v,d.at),result=[d];
 for(const gap of [2,4,8,12,18,26,36,52]){
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

const labelDirections=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);

export function keepDrawingDimensionClear(d,sheet,hitsLinework,snappedAt=d.at){
 const snapped=snappedAt===d.at?d:{...d,at:snappedAt};
 const snappedPlacement=dimensionPlacement(snapped,sheet);
 if(!snappedPlacement||!hitsLinework(snappedPlacement.box))return snapped;
 const {box}=snapped===d?snappedPlacement:dimensionPlacement(d,sheet);
 if(snapped!==d&&!hitsLinework(box))return d;

 const view=sheet.layout[d.view],geometry=drawingDimensionGeometry(d,view);
 const origin=geometry.arc?geometry.at:map(view,d.at),obstacles=dimensionObstacles(sheet);
 let directions=labelDirections;
 if(geometry.direction||geometry.arc){
  let normal;
  if(geometry.arc){
   const {center,radius}=geometry.arc;
   normal=geometry.at.map((value,i)=>(value-center[i])/radius);
  }else{
   const [x,y]=geometry.direction;
   normal=[-y,x];
   const outward=[geometry.at[0]-view.x-view.width/2,geometry.at[1]-view.y-view.height/2];
   if(outward[0]*normal[0]+outward[1]*normal[1]<0)normal=normal.map(n=>-n);
  }
  directions=[normal,normal.map(n=>-n)];
 }
 // Search in paper millimeters, so zoom and model scale don't change the clearance.
 const limit=Math.max(24,box.height*2);
 for(let distance=.25;distance<=limit;distance+=.25){
  for(const [index,[x,y]] of directions.entries()){
   if(geometry.arc&&index===1&&geometry.arc.radius-distance<4)continue;
   const dx=x*distance,dy=y*distance,candidate={...box,x:box.x+dx,y:box.y+dy};
   if(insidePaper(candidate,sheet)&&!obstacles.some(({box})=>overlaps(box,candidate,.15))&&!hitsLinework(candidate)){
    return {...d,at:local(view,[origin[0]+dx,origin[1]+dy])};
   }
  }
 }
 return null;
}

function boxHitsShape(box,{limits},clearance){
 const center=[box.x+box.width/2,box.y+box.height/2];
 return limits.every(({normal,min,max})=>{
  const position=dot(center,normal),half=(box.width*Math.abs(normal[0])+box.height*Math.abs(normal[1]))/2;
  return position+half>min-clearance&&position-half<max+clearance;
 });
}
function strokeLengthInShape([a,b],{limits},clearance){
 let start=0,end=1;
 for(const {normal,min,max} of limits){
  const low=min-clearance,high=max+clearance,origin=dot(a,normal),delta=dot(b,normal)-origin;
  if(high<=low)return 0;
  if(Math.abs(delta)<1e-9){
   if(origin<=low||origin>=high)return 0;
   continue;
  }
  const u=(low-origin)/delta,v=(high-origin)/delta;
  start=Math.max(start,Math.min(u,v));end=Math.min(end,Math.max(u,v));
  if(end<=start)return 0;
 }
 return (end-start)*Math.hypot(b[0]-a[0],b[1]-a[1]);
}
function viewInterference(placement,d,shapes){
 const envelope=collisionEnvelope(placement);
 let neighbors=0,inside=false,extension=0;
 for(const shape of shapes){
  if(!overlaps(envelope,shape.box,1))continue;
  const hitsLabel=boxHitsShape(placement.box,shape,1);
  if(shape.name===d.view){
   inside=hitsLabel;
   if(!placement.linear)continue;
   inside=inside||placement.primary.some(line=>strokeLengthInShape(line,shape,.5)>0);
   extension=placement.strokes.slice(placement.primary.length).reduce((sum,line)=>sum+strokeLengthInShape(line,shape,-.3),0);
  }else if(hitsLabel||placement.arrowBoxes.some(box=>boxHitsShape(box,shape,.5))||
   placement.strokes.some(line=>strokeLengthInShape(line,shape,.5)>0)){
   neighbors++;
  }
 }
 return {neighbors,inside,extension};
}
function strokesCross([a,b],[c,d]){
 const x=b[0]-a[0],y=b[1]-a[1],u=d[0]-c[0],v=d[1]-c[1],det=x*v-y*u;
 if(Math.abs(det)<1e-9)return false;
 const dx=c[0]-a[0],dy=c[1]-a[1],t=(dx*v-dy*u)/det,s=(dx*y-dy*x)/det;
 return t>1e-6&&t<1-1e-6&&s>1e-6&&s<1-1e-6;
}
function placementChoices(d,v,shape,{isoAnchors,preferNearby,allowAnchorChanges}){
 if(d.kind==='radius')return radiusCandidates(d,v);
 const nearby=preferNearby?nearbyCandidates(d,v):[d];
 if(d.kind==='angle')return nearby;
 if(d.center)return [...nearby,...circularCandidates(d,v)];
 const editable=allowAnchorChanges&&!d.pdfPlacement;
 const equivalents=editable&&d.automatic&&d.view==='iso'?
  (isoAnchors?.[d.overall]??[]).filter(anchor=>Math.abs(dimensionValue(anchor)-dimensionValue(d))<1e-5&&
   (anchor.a[0]!==d.a[0]||anchor.a[1]!==d.a[1]||anchor.b[0]!==d.b[0]||anchor.b[1]!==d.b[1])):[];
 const moveOverallAnchors=editable&&!v.break&&d.view!=='iso'&&d.overall===d.view+d.kind;
 return [...nearby,...linearCandidates(d,v,shape,{moveOverallAnchors}),...equivalents.flatMap(anchor=>
  linearCandidates({...d,...anchor},v,shape))];
}
function linearSpacingCost(placement,shape){
 const [a,b]=placement.primary[0],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(length<1e-8)return 0;
 const normal=normalTo([(b[0]-a[0])/length,(b[1]-a[1])/length]);
 const {min,max}=projectionRange(shape.points,normal),line=dot(a,normal);
 const gap=Math.max(min-line,line-max,0);
 const extension=placement.strokes.slice(placement.primary.length).reduce((sum,[start,end])=>
  sum+Math.hypot(end[0]-start[0],end[1]-start[1]),0);
 return (gap<8?(8-gap)*2:(gap-8)*.35)+extension*.25;
}

// Move only requested dimensions; callers pass existing annotations as locked.
// Geometry is in paper mm, independent of screen zoom and printed scale.
export function arrangeDrawingDimensions(dimensions,sheet,locked=[],{preferNearby=false,requireClear=false,isoAnchors,hitsLinework,allowAnchorChanges=true}={}){
 const shapes=drawingViewShapes(sheet),byName=new Map(shapes.map(shape=>[shape.name,shape]));
 const obstacles=dimensionObstacles(sheet);
 const placedGeometry=[...locked,...(sheet.inheritedDimensions??[]),...dimensions.filter(d=>d.pinned||d.review)]
  .map(d=>dimensionPlacement(d,sheet)).filter(Boolean);
 const placed=dimensions.map(d=>({...d,at:[...d.at]})),unresolved=[];
 const order=placed.map((_,i)=>i).sort((a,b)=>Number(placed[a].kind==='radius')-Number(placed[b].kind==='radius')||
  Number(!!placed[a].overall)-Number(!!placed[b].overall)||Number(!!placed[a].center)-Number(!!placed[b].center)||
  dimensionValue(placed[a])-dimensionValue(placed[b]));
 for(const i of order){
  const d=placed[i],v=sheet.layout[d.view];
  if(d.pinned||d.review||!v||!drawingDimensionVisible(d,v))continue;
  const shape=byName.get(d.view),choices=placementChoices(d,v,shape,{isoAnchors,preferNearby,allowAnchorChanges});
  let best=d,bestGeometry=dimensionPlacement(d,sheet),bestConflicts=Infinity,bestScore=Infinity;
  if(!bestGeometry)continue;
  for(const candidate of choices){
   const p=dimensionPlacement(candidate,sheet);
   if(!p||drawingBoxPlacementIssue(collisionEnvelope(p),sheet))continue;
   const interference=viewInterference(p,candidate,shapes);
   let conflicts=interference.neighbors+Number(!!obstacleOverlap(p,obstacles))+Number(!!hitsLinework?.(p.box));
   let crowding=0,crossings=0;
   for(const other of placedGeometry){
    if(!overlaps(collisionEnvelope(p),collisionEnvelope(other),1))continue;
    if(dimensionOverlap(p,other))conflicts++;
    else if(labelConflict(p,other)||arrowConflict(p,other))crowding++;
    else if(p.primary.some(line=>other.strokes.some(stroke=>strokesCross(line,stroke)))||
     other.primary.some(line=>p.strokes.some(stroke=>strokesCross(line,stroke))))crossings++;
   }
   if(conflicts>bestConflicts||requireClear&&conflicts)continue;
   const movement=Math.hypot(candidate.at[0]-d.at[0],candidate.at[1]-d.at[1])*v.scale;
   const score=(interference.inside?60:0)+4*interference.extension+24*crowding+12*crossings+
    (p.linear?linearSpacingCost(p,shape):0)+(preferNearby?Math.min(12,movement*.12):movement*.001);
   if(conflicts<bestConflicts||score<bestScore-1e-7){bestConflicts=conflicts;bestScore=score;best=candidate;bestGeometry=p;}
  }
  placed[i]=best;
  if(bestConflicts)unresolved.push(i);
  placedGeometry.push(bestGeometry);
 }
 return {dimensions:placed,unresolved};
}
export function reflowResizedDrawingDimensions(dimensions,sheet,{radiiOnly=false,getIsoAnchors,allowAnchorChanges=true}={}){
 const automatic=d=>!d.pinned&&!d.review&&(d.automatic||d.overall)&&(!radiiOnly||d.kind==='radius');
 const fixed=dimensions.filter(d=>!automatic(d));
 const taken=[...fixed,...(sheet.inheritedDimensions??[])].map(d=>dimensionPlacement(d,sheet)).filter(Boolean);
 const obstacles=dimensionObstacles(sheet),shapes=drawingViewShapes(sheet);
 const move=[],indices=[];
 const order=dimensions.map((_,i)=>i).filter(i=>automatic(dimensions[i])).sort((a,b)=>Number(dimensions[a].kind==='radius')-Number(dimensions[b].kind==='radius'));
 for(const index of order){
  const d=dimensions[index],placement=dimensionPlacement(d,sheet);
  if(!placement)continue;
  const {box}=placement;
  const interference=viewInterference(placement,d,shapes);
  if(longRadiusLeader(d,sheet.layout[d.view])||drawingBoxPlacementIssue(collisionEnvelope(placement),sheet)||
   obstacles.some(({box:label})=>overlaps(box,label,1)||labelHitsInk(label,placement))||
   interference.neighbors||d.overall&&interference.inside||d.view==='iso'&&interference.extension>3||
   taken.some(other=>overlaps(box,other.box,1)||(placement.radius||other.radius)&&(labelConflict(placement,other)||arrowConflict(placement,other)))){
   move.push(d);indices.push(index);
  }else{taken.push(placement);fixed.push(d);}
 }
 if(!move.length)return {dimensions,moved:0};
 const isoAnchors=move.some(d=>d.view==='iso'&&d.automatic&&d.overall&&!d.pdfPlacement)?getIsoAnchors?.():undefined;
 const next=dimensions.slice(),arranged=arrangeDrawingDimensions(move,sheet,fixed,{preferNearby:true,isoAnchors,allowAnchorChanges});
 let moved=0;
 indices.forEach((index,i)=>{
  const d=arranged.dimensions[i];
  if(d.at[0]===dimensions[index].at[0]&&d.at[1]===dimensions[index].at[1]&&
   d.a===dimensions[index].a&&d.b===dimensions[index].b)return;
  next[index]=d;moved++;
 });
 return {dimensions:next,moved};
}
