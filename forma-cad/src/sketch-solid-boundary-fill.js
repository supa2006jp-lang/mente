import * as THREE from 'three';
import {defaults,validateFeature} from './geometry.js';
import {findRegions,sketchPoints,planeCoordinates,regionContains} from './regions.js';
import {basisFor,worldPoint} from './frames.js';

const EPS=1e-6,group=f=>f.groupId??('legacy:'+(f.groupNumber??''));
const local=(p,b)=>[p.dot(b.u),p.dot(b.v)];
function covers(a,b,edges){const d=new THREE.Vector2(b[0]-a[0],b[1]-a[1]),length=d.length();if(length<EPS)return true;return edges.some(([p,q])=>{const dx=q[0]-p[0],dy=q[1]-p[1],l=dx*dx+dy*dy;if(l<EPS*EPS)return false;return [a,b].every(r=>{const x=r[0]-p[0],y=r[1]-p[1],t=(x*dx+y*dy)/l;return t>=-EPS/Math.sqrt(l)&&t<=1+EPS/Math.sqrt(l)&&Math.abs(x*dy-y*dx)<=EPS*Math.sqrt(l);});});}
function interior(region){const points=[...region.outer,...region.holes.flat()],triangles=THREE.ShapeUtils.triangulateShape(region.outer.map(p=>new THREE.Vector2(...p)),region.holes.map(h=>h.map(p=>new THREE.Vector2(...p))));let best=null,area=0;for(const tri of triangles){const [a,b,c]=tri.map(i=>points[i]),size=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));if(size>area){area=size;best=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];}}return best;}
function inside(point,edges){let result=false;for(const [a,b]of edges)if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;return result;}
function runsFor(ring,sketchEdges,boundaryEdges){
 const missing=ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return !covers(a,b,sketchEdges)&&covers(a,b,boundaryEdges);});if(!missing.some(Boolean))return [];
 if(missing.every(Boolean))return [{points:ring,closed:true}];
 const first=missing.findIndex(v=>!v),runs=[];let run=null;for(let j=1;j<=ring.length;j++){const i=(first+j)%ring.length;if(missing[i]){if(!run){run={points:[ring[i]],closed:false};runs.push(run);}run.points.push(ring[(i+1)%ring.length]);}else run=null;}return runs;
}

// Copy only the solid boundary needed for a new bounded face. Never use a
// screen silhouette: boundaries are actual sections on this sketch plane.
export function completeSketchWithSolidBoundary(features,source,boundaries,{groupId=source.groupId,idFactory=()=>crypto.randomUUID(),maxSegments=4000}={}){
 if(source.kind!=='sketch'||source.construction||source.textOutline||source.closed||!['line','polyline','spline'].includes(source.profile))return null;
 const basis=basisFor(source),offset=planeCoordinates(source).offset,onPlane=f=>{const b=basisFor(f),dot=b.n.dot(basis.n);return Math.abs(dot)>1-1e-8&&Math.abs(planeCoordinates(f).offset*dot-offset)<EPS;},members=features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&!f.construction&&f.id!==source.id&&(groupId?f.groupId===groupId:!f.groupId&&group(f)===group(source))&&onPlane(f));
 const toLocal=points=>points.map(p=>local(p,basis)),sections=boundaries.filter(b=>b.segments?.length).map(b=>({...b,edges:b.segments.filter(([a,c])=>Math.abs(a.dot(basis.n)-offset)<=EPS&&Math.abs(c.dot(basis.n)-offset)<=EPS).map(edge=>toLocal(edge))})),solidEdges=sections.flatMap(b=>b.edges);if(!solidEdges.length)return null;
 const drawn=sketchPoints(source),ownEdges=drawn.slice(1).map((p,i)=>[drawn[i],p]);if(!ownEdges.length||ownEdges.every(([a,b])=>covers(a,b,solidEdges)))return null;
 const sketchEdges=[...members,source].flatMap(f=>{const p=sketchPoints(f).map(v=>local(worldPoint({...f,offset:planeCoordinates(f).offset},v),basis));return p.slice(1).map((q,i)=>[p[i],q]);});
 if(solidEdges.length+sketchEdges.length>maxSegments)return null;
 // A normal closed sketch needs no borrowed contour. Otherwise the solid's
 // outer boundary could be copied merely because that sketch forms a hole.
 if(findRegions([...members,source]).some(r=>r.sourceIds.includes(source.id)))return null;
 const prefix='boundary-'+source.id+'-',virtual=solidEdges.map(([a,b],i)=>({...source,id:prefix+i,profile:'polyline',points:[a,b],closed:false})),candidateSource={...source},regions=findRegions([...members,candidateSource,...virtual]).filter(r=>r.sourceIds.includes(source.id)&&r.sourceIds.some(id=>id.startsWith(prefix)));
 const candidates=[];for(const region of regions){const convert=p=>local(worldPoint(region,p),basis),normalized={...region,outer:region.outer.map(convert),holes:region.holes.map(h=>h.map(convert))},runs=[normalized.outer,...normalized.holes].flatMap(ring=>runsFor(ring,sketchEdges,solidEdges));if(!runs.length)continue;
  // Reject regions which were already closed by sketches before the solid
  // edges were added, including overlapping copies of an existing outline.
  const length=runs.reduce((sum,r)=>sum+r.points.reduce((n,p,i)=>i?n+Math.hypot(p[0]-r.points[i-1][0],p[1]-r.points[i-1][1]):n,0),0),sample=interior(normalized);if(!sample)continue;const outside=!sections.some(s=>inside(sample,s.edges));candidates.push({region,runs,length,outside});
 }
 candidates.sort((a,b)=>Number(b.outside)-Number(a.outside)||a.region.area-b.region.area||a.length-b.length);const chosen=candidates[0];if(!chosen)return null;
 const bodyIds=sections.filter(s=>chosen.runs.some(r=>r.points.slice(1).some((p,i)=>covers(r.points[i],p,s.edges)))).map(s=>s.bodyId).filter(Boolean);
 const added=chosen.runs.map((run,i)=>{const f={...defaults,id:idFactory(),kind:'sketch',name:'ソリッド境界（自動）'+(chosen.runs.length>1?' '+(i+1):''),profile:'polyline',mode:'thin',plane:source.plane,x:source.x,y:source.y,z:source.z,points:run.points.map(p=>[...p]),closed:run.closed,groupId:source.groupId,groupNumber:source.groupNumber,solidBoundarySource:{bodyIds:[...new Set(bodyIds)]}};if(source.frame)f.frame=structuredClone(source.frame);validateFeature(f);return f;});
 const check=findRegions([...members,source,...added]),seed=interior(chosen.region);if(!check.some(r=>r.sourceIds.includes(source.id)&&r.sourceIds.some(id=>added.some(f=>f.id===id))&&Math.abs(r.area-chosen.region.area)<=Math.max(1e-5,r.area*1e-7)&&seed&&regionContains(r,seed)))return null;
 return {added,region:chosen.region,bodyIds:[...new Set(bodyIds)],outside:chosen.outside};
}
