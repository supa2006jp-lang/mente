import {basisFor,worldPoint} from './frames.js';
import {sketchPoints,planeCoordinates,findRegions,regionContains,ringArea} from './regions.js';
import {deleteSketchSelection,sketchSegments} from './sketch-selection.js';

export function offsetExtrusionRegions(copies,sources,allAround){
 const regions=findRegions(copies);if(!allAround)return regions;
 const points=sources.flatMap(f=>{const ps=sketchPoints(f),r={...f,offset:planeCoordinates(f).offset};return ps.flatMap((p,i)=>[worldPoint(r,p),...(i?[worldPoint(r,[(p[0]+ps[i-1][0])/2,(p[1]+ps[i-1][1])/2])]:[])]);});
 return regions.filter(r=>{const b=basisFor(r);return points.some(p=>Math.abs(p.dot(b.n)-r.offset)<1e-5&&regionContains(r,[p.dot(b.u),p.dot(b.v)]));});
}

export function replaceOffsetSources(features,{selection,sourceId,region}){
 if(selection?.size)return deleteSketchSelection(features,selection);
 if(sourceId)return features.filter(f=>f.id!==sourceId);
 if(!region)return features;
 const ids=new Set(region.sourceIds||[]),rb=basisFor(region),rings=[region.outer,...region.holes],edges=rings.flatMap(r=>r.map((a,i)=>[a,r[(i+1)%r.length]]));
 return features.flatMap(f=>{
  if(f.kind!=='sketch'||!ids.has(f.id))return [f];const ps=sketchPoints(f),segments=sketchSegments(f),kept=[];let changed=false;
  for(const [i,s] of segments.entries()){
   const a=[s.a.dot(rb.u),s.a.dot(rb.v)],b=[s.b.dot(rb.u),s.b.dot(rb.v)],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-16)continue;
   const intervals=[];for(const [p,q] of edges){if([p,q].some(v=>Math.abs((v[0]-a[0])*dy-(v[1]-a[1])*dx)>1e-5*Math.sqrt(l2)))continue;const ts=[p,q].map(v=>((v[0]-a[0])*dx+(v[1]-a[1])*dy)/l2),lo=Math.max(0,Math.min(...ts)),hi=Math.min(1,Math.max(...ts));if(hi-lo>1e-8)intervals.push([lo,hi]);}
   intervals.sort((a,b)=>a[0]-b[0]);let start=0;const at=t=>[ps[i][0]+(ps[i+1][0]-ps[i][0])*t,ps[i][1]+(ps[i+1][1]-ps[i][1])*t];
   for(const [lo,hi] of intervals){changed=true;if(lo>start+1e-8)kept.push([at(start),at(lo)]);start=Math.max(start,hi);}if(start<1-1e-8)kept.push([at(start),at(1)]);
  }
  if(!changed)return [f];const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6,chains=[];
  for(const [a,b] of kept){const last=chains.at(-1);if(last&&same(last.at(-1),a))last.push(b);else chains.push([a,b]);}
  if(chains.length>1&&same(chains.at(-1).at(-1),chains[0][0])){const last=chains.pop();chains[0]=last.slice(0,-1).concat(chains[0]);}
  return chains.map((points,i)=>{const closed=same(points[0],points.at(-1));if(closed)points.pop();const copy={...structuredClone(f),id:i?crypto.randomUUID():f.id,profile:'polyline',points,closed};delete copy.arc;delete copy.tangents;delete copy.tangentLengths;return copy;});
 });
}

export function offsetDragReferences(sources,allAround){
 return sources.flatMap(f=>{
  const ps=sketchPoints(f),closed=f.profile==='circle'||f.profile==='rect'||f.closed,orientation=closed?(ringArea(ps)>=0?-1:1):1,b=basisFor(f),offset=planeCoordinates(f).offset,refs=[];
  for(let i=1;i<ps.length;i++){const a=ps[i-1],c=ps[i],dx=c[0]-a[0],dy=c[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-8)continue;const direction=b.u.clone().multiplyScalar(-dy/length*orientation).addScaledVector(b.v,dx/length*orientation),base=worldPoint({...f,offset},[(a[0]+c[0])/2,(a[1]+c[1])/2]);refs.push({base,direction});if(allAround&&!closed)refs.push({base:base.clone(),direction:direction.clone().negate()});}
  return refs;
 });
}

export function offsetDragValue(raw,{allAround=false,snap=false,step=10,pixelsPerMm=1}={}){
 let value=Math.max(allAround?.001:-10000,Math.min(10000,raw));
 if(snap&&step>0){const nearest=Math.round(value/step)*step;if(Math.abs(nearest)>=.001&&Math.abs(value-nearest)<=Math.min(step*.2,6/Math.max(.001,pixelsPerMm)))value=nearest;}
 if(Math.abs(value)<.001)value=value<0?-.001:.001;return Number(value.toFixed(4));
}
