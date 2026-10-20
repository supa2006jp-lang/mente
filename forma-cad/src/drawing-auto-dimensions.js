import {drawingCurves} from './drawing-curves.js';
import {dimensionValue} from './drawing-dimensions.js';

const round=n=>Number(n.toFixed(5)),close=(a,b)=>Math.abs(a-b)<1e-5;
function key(d){const values=['diameter','radius'].includes(d.kind)?[...d.center,d.radius]:d.kind==='horizontal'?[d.a[0],d.b[0]].sort((a,b)=>a-b):d.kind==='vertical'?[d.a[1],d.b[1]].sort((a,b)=>a-b):[...d.a,...d.b];return [d.view,d.kind,...values.map(round)].join(',');}
export function overallDrawingDimensions(data,scale=1){
 const [[x0,y0,z0],[x1,y1,z1]]=data.bounds,dimensions=[];
 // Each projection gets both of its own axes, even when that length also
 // appears in another view. Deduplication remains local to a view.
 for(const [view,u0,u1,v0,v1]of [['front',x0,x1,-z1,-z0],['top',x0,x1,-y1,-y0],['right',y0,y1,-z1,-z0]]){
  if(!data.views[view])continue;
  dimensions.push({view,kind:'horizontal',a:[u0,v1],b:[u1,v1],at:[u0,v1+8/scale]},{view,kind:'vertical',a:[u0,v0],b:[u0,v1],at:[u0-8/scale,v1]});
 }
 return dimensions.filter(d=>dimensionValue(d)>1e-7).map(d=>({...d,overall:d.view+d.kind}));
}
// Only complete visible circles get diameter dimensions. Partial fillets and
// hidden arcs are deliberately excluded; they cannot identify a complete hole.
export function completeDrawingCircles(view){const groups=new Map();for(const a of drawingCurves(view.visible).arcs){const id=[...a.center,a.radius].map(round).join(',');if(!groups.has(id))groups.set(id,{center:a.center,radius:a.radius,intervals:[]});let start=Math.atan2(a.a[1]-a.center[1],a.a[0]-a.center[0]),end=Math.atan2(a.b[1]-a.center[1],a.b[0]-a.center[0]);if(!a.sweep)[start,end]=[end,start];while(start<0)start+=Math.PI*2;while(start>=Math.PI*2)start-=Math.PI*2;while(end<=start)end+=Math.PI*2;const list=groups.get(id).intervals;list.push([start,Math.min(end,Math.PI*2)]);if(end>Math.PI*2)list.push([0,end-Math.PI*2]);}return [...groups.values()].filter(c=>{let covered=0,end=0;for(const [a,b]of c.intervals.sort((a,b)=>a[0]-b[0])){if(b>end){covered+=b-Math.max(a,end);end=b;}}return covered>=Math.PI*2-1e-4;}).map(({center,radius})=>({center,radius}));}

export function autoDrawingDimensions(data,scale,existing=[],sheet){
 const keys=new Set(existing.map(key)),added=[],s=scale,limit=500-existing.length;
 const push=d=>{const id=key(d);if(added.length>=limit||keys.has(id)||dimensionValue(d)<1e-6)return false;keys.add(id);added.push({...d,automatic:true});return true;};
 for(const d of overallDrawingDimensions(data,s))push(d);
 let remaining=8,skipped=0;
 for(const view of ['top','front','right']){const v=sheet.layout[view];if(!v||!data.views[view])continue;const all=completeDrawingCircles(data.views[view]).sort((a,b)=>b.radius-a.radius||a.center[0]-b.center[0]||a.center[1]-b.center[1]),circles=all.filter(c=>c.radius*s>=.75).slice(0,Math.min(4,remaining));skipped+=all.length-circles.length;remaining-=circles.length;
  const centers=[];for(const c of circles){const [x,y]=c.center;let at=[x+(c.radius+7/s),y-3/s];if(v.x+(at[0]-v.bx)*s>sheet.width-15)at=[x-c.radius-7/s,y-3/s];if(v.y+(at[1]-v.by)*s<22)at[1]=y+3/s;push({view,kind:'diameter',center:c.center,radius:c.radius,at});if(!centers.some(p=>close(p[0],x)&&close(p[1],y)))centers.push(c.center);}
  // One chain per axis keeps the rough dimensions readable rather than stacking
  // a separate baseline dimension for every hole at the same place.
  for(const axis of [0,1]){const coords=[...new Set(centers.map(p=>round(p[axis])))].sort((a,b)=>a-b),origin=axis===0?v.bx:v.by;let previous=origin;for(const coordinate of coords){if((coordinate-previous)*s<4)continue;const hasOverall=[...existing,...added].some(d=>d.view===view&&d.kind==='horizontal'&&d.overall),gap=axis===0&&hasOverall?15:7;const d=axis===0?{view,kind:'horizontal',a:[previous,v.by+v.height/s],b:[coordinate,v.by+v.height/s],at:[previous,v.by+(v.height+gap)/s]}:{view,kind:'vertical',a:[v.bx,previous],b:[v.bx,coordinate],at:[v.bx+(v.width+7)/s,previous]};push(d);previous=coordinate;}}
 }
 return {dimensions:added,skipped};
}
