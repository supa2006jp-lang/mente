import {supportIntervals,supportMeshTriangles} from './print-support-bridges.js';
import {supportBoundaryPaths} from './print-support-coverage.js';

const epsilon=1e-5;
const merge=(a,b)=>({
 span:[a.span[0],b.span[1]],
 low:Math.max(a.low,b.low),high:Math.min(a.high,b.high),
 minLow:Math.min(a.minLow,b.minLow),maxHigh:Math.max(a.maxHigh,b.maxHigh),
 anchorLow:a.anchorLow||b.anchorLow,anchorHigh:a.anchorHigh||b.anchorHigh,
 nominalSpan:Math.max(a.nominalSpan,b.nominalSpan),
});

// Between successive contour vertices the tessellated limits are linear.
// Group adjoining strips with similar limits and use the tightest clearance
// of each group. The solid cutter still verifies clearance on the exact faces.
export function supportRibSections(original,clear,axis,p,budget,reportRequired){
 if(!original||!clear.length)return [];
 const other=1-axis,full=supportMeshTriangles(original),trimmed=clear.map(supportMeshTriangles);
 const stations=[...new Set([original,...clear].flatMap(mesh=>supportBoundaryPaths(mesh)
  .flatMap(path=>path.map(point=>Math.round(point[other]*1e6)/1e6))))].sort((a,b)=>a-b);
 const change=Math.max(.1,Math.min(.4,p.wallThickness/2));
 const strips=[];
 for(let i=1;i<stations.length;i++){
  const from=stations[i-1],to=stations[i];
  if(to-from<=epsilon)continue;
  const inset=Math.min(epsilon,(to-from)/4);
  const samples=[from+inset,to-inset].flatMap(at=>{
   const before=supportIntervals(full,other,at);
   if(!before.length)return [];
   const after=trimmed.map(mesh=>supportIntervals(mesh,other,at)).filter(spans=>spans.length);
   if(!after.length)return [];
   return [{before:[before[0][0],before.at(-1)[1]],
    after:[Math.max(...after.map(spans=>spans[0][0])),Math.min(...after.map(spans=>spans.at(-1)[1]))]}];
  });
  if(!samples.length)continue;
  strips.push({
   span:[from,to],
   low:Math.max(...samples.map(s=>s.after[0])),high:Math.min(...samples.map(s=>s.after[1])),
   minLow:Math.min(...samples.map(s=>s.after[0])),maxHigh:Math.max(...samples.map(s=>s.after[1])),
   nominalSpan:Math.max(...samples.map(s=>s.before[1]-s.before[0])),
   anchorLow:samples.some(s=>s.after[0]>s.before[0]+epsilon),
   anchorHigh:samples.some(s=>s.after[1]<s.before[1]-epsilon),
  });
 }
 if(!strips.length)return [];
 const extent=strips.reduce(merge);
 const followLow=extent.anchorLow&&extent.low-extent.minLow>change;
 const followHigh=extent.anchorHigh&&extent.maxHigh-extent.high>change;
 if(!followLow&&!followHigh)return [];

 const sections=[];
 const touches=(a,b)=>a&&b&&Math.abs(a.span[1]-b.span[0])<=epsilon;
 for(const strip of strips){
  const previous=sections.at(-1);
  if(touches(previous,strip)&&(!followLow||previous.anchorLow===strip.anchorLow)&&
   (!followHigh||previous.anchorHigh===strip.anchorHigh)){
   const joined=merge(previous,strip);
   if((!followLow||joined.low-joined.minLow<=change)&&(!followHigh||joined.maxHigh-joined.high<=change)){
    sections[sections.length-1]=joined;continue;
   }
  }
  sections.push(strip);
 }
 const length=section=>section.span[1]-section.span[0];
 const minimum=Math.max(2*p.wallThickness,Math.min(3,p.wallPitch/2));
 // Keep an axial step where it has useful length. Fold short curved ends
 // into a neighbor if its full-width ribs can extend into the shared range.
 const cost=(a,b)=>{
  if(!touches(a,b))return Infinity;
  const joined=merge(a,b);
  if(joined.high-joined.low<p.wallThickness-epsilon)return Infinity;
  return length(a)*(joined.low-a.low+a.high-joined.high)+length(b)*(joined.low-b.low+b.high-joined.high);
 };
 for(let i=0;i<sections.length;i++){
  if(length(sections[i])>=minimum)continue;
  const left=cost(sections[i-1],sections[i]),right=cost(sections[i],sections[i+1]);
  if(!Number.isFinite(Math.min(left,right)))continue;
  const at=left<=right?i-1:i;
  sections.splice(at,2,merge(sections[at],sections[at+1]));i=Math.max(-1,at-1);
 }
 reportRequired?.(sections.length);
 while(sections.length>budget){
  let best=Infinity,at=-1;
  for(let i=1;i<sections.length;i++){
   const value=cost(sections[i-1],sections[i]);
   if(value<best){best=value;at=i-1;}
  }
  if(at<0)return [];
  sections.splice(at,2,merge(sections[at],sections[at+1]));
 }
 const placed=sections.filter(section=>section.high-section.low>=p.wallThickness-epsilon);
 return placed.length>1?placed.map(section=>({...section,
  anchorLow:followLow||section.anchorLow,anchorHigh:followHigh||section.anchorHigh,
 })):[];
}
