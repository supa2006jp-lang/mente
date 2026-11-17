import {dimensionLabel,dimensionLabelWidth} from './drawing-dimensions.js';
import {drawingDimensionVisible,drawingModelPoint as local,drawingPaperPoint as map} from './drawing-break.js';
const overlaps=(a,b,p=0)=>a.x<b.x+b.width+p&&a.x+a.width+p>b.x&&a.y<b.y+b.height+p&&a.y+a.height+p>b.y;
const lineBox=(a,b,p=.3)=>({x:Math.min(a[0],b[0])-p,y:Math.min(a[1],b[1])-p,width:Math.abs(b[0]-a[0])+2*p,height:Math.abs(b[1]-a[1])+2*p});
export function dimensionPlacement(d,sheet){const v=sheet.layout[d.view];if(!v||!drawingDimensionVisible(d,v))return null;const at=map(v,d.at),font=d.fontSize??3.2,label=dimensionLabel(d);let c=at,main=[],extensions=[];
 if(['horizontal','vertical','aligned'].includes(d.kind)){const a=map(v,d.a),b=map(v,d.b);let u=d.kind==='horizontal'?[Math.sign(b[0]-a[0])||1,0]:d.kind==='vertical'?[0,Math.sign(b[1]-a[1])||1]:[b[0]-a[0],b[1]-a[1]];if(d.kind==='aligned'){const l=Math.hypot(...u)||1;u=u.map(n=>n/l);}const n=[-u[1],u[0]],offset=(at[0]-a[0])*n[0]+(at[1]-a[1])*n[1],q=[a[0]+n[0]*offset,a[1]+n[1]*offset],r=[b[0]+n[0]*offset,b[1]+n[1]*offset];c=[(q[0]+r[0])/2,(q[1]+r[1])/2];main=[lineBox(q,r)];extensions=[lineBox(a,q),lineBox(b,r)];
 }else if(d.kind==='angle'){const center=map(v,d.vertex),a=map(v,d.a),b=map(v,d.b),start=Math.atan2(a[1]-center[1],a[0]-center[0]);let delta=Math.atan2(b[1]-center[1],b[0]-center[0])-start;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;const radius=Math.max(4,Math.hypot(at[0]-center[0],at[1]-center[1]));c=[center[0]+radius*Math.cos(start+delta/2),center[1]+radius*Math.sin(start+delta/2)];
 }else{const center=map(v,d.center),length=Math.hypot(at[0]-center[0],at[1]-center[1])||1,u=[(at[0]-center[0])/length,(at[1]-center[1])/length],tip=d.arcPoint?map(v,d.arcPoint):[center[0]+u[0]*d.radius*v.scale,center[1]+u[1]*d.radius*v.scale];extensions=[lineBox(tip,at)];}
 const width=dimensionLabelWidth(label,font);
 return {box:{x:c[0]-width/2,y:c[1]-font*.75,width,height:font*1.45},main,extensions};
}
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
const insidePaper=(box,sheet)=>box.x>=5&&box.y>=18&&box.x+box.width<=sheet.width-5&&box.y+box.height<=sheet.contentBottom-1;

// Move only requested dimensions; callers pass existing annotations as locked.
// Geometry is in paper mm, independent of screen zoom and printed scale.
export function arrangeDrawingDimensions(dimensions,sheet,locked=[],{preferNearby=false}={}){const bodies=Object.values(sheet.layout).map(v=>({x:v.x,y:v.y-7,width:v.width,height:v.height+7})),labels=[sheet.note,sheet.holeBox,...(sheet.leaderLabels||[])].filter(Boolean),lines=[],extensions=[];for(const d of locked){const p=dimensionPlacement(d,sheet);if(p){labels.push(p.box);lines.push(...p.main);extensions.push(...p.extensions);}}
 for(const d of dimensions)if(d.pinned){const p=dimensionPlacement(d,sheet);if(p){labels.push(p.box);lines.push(...p.main);extensions.push(...p.extensions);}}
 const placed=dimensions.map(d=>({...d,at:[...d.at]})),unresolved=[];const order=placed.map((d,i)=>i).sort((a,b)=>Number(!!placed[a].overall)-Number(!!placed[b].overall)||Number(['diameter','radius'].includes(placed[a].kind))-Number(['diameter','radius'].includes(placed[b].kind))||a-b);
 for(const i of order){const d=placed[i],v=sheet.layout[d.view];if(d.pinned||!v||!drawingDimensionVisible(d,v))continue;let best=d,bestScore=Infinity,bestGeometry=dimensionPlacement(d,sheet);
  const choices=d.kind==='angle'?[d]:candidates(d,v);
  if(preferNearby)choices.unshift(...nearbyCandidates(d,v));
  for(const candidate of choices){
   const p=dimensionPlacement(candidate,sheet),box=p.box;
   if(!insidePaper(box,sheet))continue;
   const base=100*bodies.filter(b=>overlaps(box,b,1)||p.main.some(l=>overlaps(l,b,.5))).length+
    100*labels.filter(b=>overlaps(box,b,1)||p.main.some(l=>overlaps(l,b,.5))||p.extensions.some(l=>overlaps(l,b,.5))).length+
    10*[...lines,...extensions].filter(l=>overlaps(box,l,.5)).length+10*lines.filter(l=>p.main.some(n=>overlaps(l,n,.5))).length;
   let score=base;
   if(preferNearby){
    const labelConflicts=labels.filter(b=>overlaps(box,b,1)).length;
    score+=1_000_000*labelConflicts+Math.min(9,Math.hypot(candidate.at[0]-d.at[0],candidate.at[1]-d.at[1])*v.scale/100);
   }
   if(score<bestScore){bestScore=score;best=candidate;bestGeometry=p;}
   if(!score)break;
  }
  placed[i]=best;if(bestScore>0)unresolved.push(i);if(bestGeometry){labels.push(bestGeometry.box);lines.push(...bestGeometry.main);extensions.push(...bestGeometry.extensions);}
 }
 return {dimensions:placed,unresolved};
}
export function reflowResizedDrawingDimensions(dimensions,sheet){
 const automatic=d=>!d.pinned&&!d.review&&(d.automatic||d.overall);
 const fixed=dimensions.filter(d=>!automatic(d));
 const boxes=fixed.map(d=>dimensionPlacement(d,sheet)?.box).filter(Boolean);
 for(const block of [sheet.note,sheet.holeBox,...(sheet.leaderLabels||[])])if(block)boxes.push(block);
 const move=[],indices=[];
 dimensions.forEach((d,index)=>{
  if(!automatic(d))return;
  const box=dimensionPlacement(d,sheet)?.box;
  if(!box)return;
  if(!insidePaper(box,sheet)||boxes.some(other=>overlaps(box,other,1))){
   move.push(d);indices.push(index);
  }else{boxes.push(box);fixed.push(d);}
 });
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
