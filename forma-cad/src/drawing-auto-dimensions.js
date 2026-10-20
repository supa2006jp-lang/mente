import {drawingCurves} from './drawing-curves.js';
import {dimensionValue} from './drawing-dimensions.js';
import {straightFeatureDimensions,circlePatternDimensions,dimensionAxisGraph} from './drawing-feature-dimensions.js';
import {arrangeDrawingDimensions} from './drawing-dimension-layout.js';

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
 const keys=new Set(),added=[],s=scale,limit=500-existing.length,covered=d=>d.kind==='diameter'&&d.centers?d.centers.map(center=>key({...d,center})):[key(d)];for(const d of existing)for(const k of covered(d))keys.add(k);
 const push=d=>{const ids=covered(d);if(added.length>=limit||ids.every(id=>keys.has(id))||dimensionValue(d)<1e-6)return false;ids.forEach(id=>keys.add(id));added.push({...d,automatic:true});return true;};
 for(const d of overallDrawingDimensions(data,s))push(d);
 for(const d of straightFeatureDimensions(data,sheet,[...existing,...added]))push(d);
 let remaining=8,skipped=0;
 for(const view of ['top','front','right']){const v=sheet.layout[view];if(!v||!data.views[view])continue;const all=completeDrawingCircles(data.views[view]).sort((a,b)=>b.radius-a.radius||a.center[0]-b.center[0]||a.center[1]-b.center[1]),groups=[];
  for(const c of all){if(c.radius*s<.75){skipped++;continue;}const group=groups.find(g=>close(g.radius,c.radius));if(group)group.centers.push(c.center);else groups.push({radius:c.radius,centers:[c.center]});}
  const selected=groups.filter(g=>g.centers.length<=200).slice(0,Math.min(4,remaining));remaining-=selected.length;skipped+=groups.filter(g=>!selected.includes(g)).reduce((n,g)=>n+g.centers.length,0);
  const centers=[];for(const group of selected){const members=group.centers.filter(center=>!keys.has(key({view,kind:'diameter',center,radius:group.radius})));if(members.length){const d={view,kind:'diameter',center:members[0],radius:group.radius,at:[members[0][0]+group.radius+7/s,members[0][1]-3/s]};if(members.length>1){d.count=members.length;d.centers=members.map(p=>[...p]);}push(d);}
   const pattern=circlePatternDimensions(group.centers,view,v);if(pattern){for(const d of pattern.dimensions)push(d);centers.push(pattern.anchor);}else centers.push(...group.centers);
  }
  for(const axis of [0,1]){const coords=[...new Set(centers.map(p=>round(p[axis])))].sort((a,b)=>a-b),origin=axis===0?v.bx:v.by,graph=dimensionAxisGraph([...existing,...added],view,axis);let previous=origin;for(const coordinate of coords){if(graph.connected(previous,coordinate)){previous=coordinate;continue;}if((coordinate-previous)*s<4)continue;const d=axis===0?{view,kind:'horizontal',a:[previous,v.by+v.height/s],b:[coordinate,v.by+v.height/s],at:[previous,v.by+(v.height+15)/s]}:{view,kind:'vertical',a:[v.bx,previous],b:[v.bx,coordinate],at:[v.bx+(v.width+7)/s,previous]};push(d);graph.join(previous,coordinate);previous=coordinate;}}
 }
 const layout=arrangeDrawingDimensions(added,sheet,existing);return {dimensions:layout.dimensions,skipped,layoutWarnings:layout.unresolved.length};
}
