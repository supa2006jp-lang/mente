import * as THREE from 'three';
import {basisFor} from './frames.js';
import {cadPosition} from './cad-coordinates.js';
import {sketchPoints,pointInRing,planeCoordinates} from './regions.js';
import {extrusionDragDistance} from './extrusion-drag.js';

const EPS=1e-5,cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
function segmentDistance(p,a,b){const d=sub(b,a),length=d[0]**2+d[1]**2,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/length)):0;return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);}
function footprint(feature){
 const r=feature.region,points=r?r.outer:sketchPoints(feature),rings=r?[r.outer,...(r.holes||[])]:[points],thin=feature.mode==='thin'||points.length<3,segments=[],bounds=[0,1].map(k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))]);
 for(const ring of rings){for(let i=1;i<ring.length;i++)segments.push([ring[i-1],ring[i]]);if(r||!thin)segments.push([ring.at(-1),ring[0]]);}
 const margin=thin?Math.max(0,feature.wall||0)+EPS:EPS,contains=p=>{for(const [a,b]of segments)if(segmentDistance(p,a,b)<=margin)return true;return !thin&&pointInRing(p,points)&&!(r?.holes||[]).some(h=>pointInRing(p,h));};
 return {segments,contains,bounds,margin};
}
// Project real body boundaries onto the swept profile. Their clipped endpoints
// give finite stopping positions, including side contacts and sloping edges.
export function extrusionBoundaryCandidates(features,meshes){
 const output=[],seen=new Set();
 for(const feature of features){
  const b=basisFor(feature.region||feature),start=feature.region?.offset??planeCoordinates(feature).offset,profile=footprint(feature),uv=p=>[p.dot(b.u),p.dot(b.v)];
  for(const [bodyId,mesh]of meshes){
   if(!mesh.visible||mesh.geometry.userData.cadCoordinatePrecision===false)continue;mesh.updateWorldMatrix(true,true);const edges=mesh.children.find(o=>o.isLineSegments),positions=cadPosition(edges?.geometry);if(!positions)continue;
   for(let i=0;i+1<positions.count;i+=2){
    const a=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(edges.matrixWorld),z=new THREE.Vector3().fromBufferAttribute(positions,i+1).applyMatrix4(edges.matrixWorld),p=uv(a),q=uv(z),d=sub(q,p),length=d[0]**2+d[1]**2,ts=[0,1];
    if([0,1].some(k=>Math.max(p[k],q[k])<profile.bounds[k][0]-profile.margin||Math.min(p[k],q[k])>profile.bounds[k][1]+profile.margin))continue;
    for(const [u,v]of profile.segments){const e=sub(v,u),den=cross(d,e),delta=sub(u,p);if(Math.abs(den)>1e-12){const t=cross(delta,e)/den,s=cross(delta,d)/den;if(t>=-EPS&&t<=1+EPS&&s>=-EPS&&s<=1+EPS)ts.push(Math.max(0,Math.min(1,t)));}else if(length>1e-20&&Math.abs(cross(delta,d))<=EPS*Math.sqrt(length)){for(const point of [u,v]){const t=((point[0]-p[0])*d[0]+(point[1]-p[1])*d[1])/length;if(t>=0&&t<=1)ts.push(t);}}}
    for(const t of ts){const projected=[p[0]+d[0]*t,p[1]+d[1]*t];if(!profile.contains(projected))continue;const point=a.clone().lerp(z,t),signed=point.dot(b.n)-start,value=feature.symmetric?Math.abs(signed):signed;if(!Number.isFinite(value)||Math.abs(value)<.1||Math.abs(value)>10000)continue;const key=bodyId+':'+Math.round(value*1e7);if(seen.has(key))continue;seen.add(key);output.push({value,bodyId,point,segments:[[a,z]]});}
   }
  }
 }
 return output.sort((a,b)=>a.value-b.value);
}

export function snapExtrusionBoundary(raw,candidates,{snapEnabled=false,pixelsPerMm=1,tolerancePixels=8}={}){
 if(!snapEnabled||!Number.isFinite(raw))return null;const tolerance=tolerancePixels/Math.max(.001,pixelsPerMm);let closest=null,distance=Infinity;
 for(const candidate of candidates){const delta=Math.abs(candidate.value-raw);if(delta<=tolerance&&delta<distance){closest=candidate;distance=delta;}}
 return closest;
}

export function extrusionBoundaryDistance(raw,candidates,options={}){
 const grid=extrusionDragDistance(raw,options),boundary=snapExtrusionBoundary(raw,candidates,options);
 // Preserve deliberate grid alignment; prefer the closer physical boundary,
 // including an exact tie where native coordinates should win.
 if(boundary&&(!grid.snapped||Math.abs(boundary.value-raw)<=Math.abs(grid.value-raw)+1e-9))return {value:boundary.value,snapped:true,boundary};
 return {...grid,boundary:null};
}
