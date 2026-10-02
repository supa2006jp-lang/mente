import * as THREE from 'three';
import {sketchPoints,planeCoordinates} from './regions.js';
import {worldPoint} from './frames.js';
export function sketchIntersections(features){
 const segments=[],out=[],seen=new Set();
 for(const f of features.filter(f=>f.kind==='sketch')){const r={...f,offset:planeCoordinates(f).offset},ps=sketchPoints(f).map(p=>worldPoint(r,p));for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i];if(a.distanceToSquared(b)<1e-14)continue;segments.push({a,b,min:Math.min(a.x,b.x),max:Math.max(a.x,b.x)});}}
 segments.sort((a,b)=>a.min-b.min);
 for(let i=0;i<segments.length;i++){const a=segments[i],r=a.b.clone().sub(a.a);for(let j=i+1;j<segments.length&&segments[j].min<=a.max+1e-5;j++){const b=segments[j];if(['y','z'].some(k=>Math.max(a.a[k],a.b[k])+1e-5<Math.min(b.a[k],b.b[k])||Math.max(b.a[k],b.b[k])+1e-5<Math.min(a.a[k],a.b[k])))continue;const s=b.b.clone().sub(b.a),cross=r.clone().cross(s),den=cross.lengthSq();if(den<1e-14)continue;const delta=b.a.clone().sub(a.a),t=delta.clone().cross(s).dot(cross)/den,u=delta.clone().cross(r).dot(cross)/den;if(t< -1e-8||t>1+1e-8||u< -1e-8||u>1+1e-8)continue;const p=a.a.clone().addScaledVector(r,t),q=b.a.clone().addScaledVector(s,u);if(p.distanceTo(q)>1e-5)continue;const key=p.toArray().map(v=>Math.round(v*1e5)).join(',');if(!seen.has(key)){seen.add(key);out.push(p);}}}
 // Keep actual crossings and T junctions, not adjacent curve tessellation vertices.
 return out.filter(p=>segments.some(s=>{const d=s.b.clone().sub(s.a),t=p.clone().sub(s.a).dot(d)/d.lengthSq();return t>1e-6&&t<1-1e-6&&s.a.clone().addScaledVector(d,t).distanceTo(p)<1e-5;}));
}
