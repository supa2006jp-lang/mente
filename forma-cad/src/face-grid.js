import * as THREE from 'three';
import {regionContains} from './regions.js';
export function faceGridBounds(face,mode){
 const bounds={u:[Math.min(...face.outer.map(p=>p[0])),Math.max(...face.outer.map(p=>p[0]))],v:[Math.min(...face.outer.map(p=>p[1])),Math.max(...face.outer.map(p=>p[1]))]};
 if(mode==='100'||mode==='200')for(const axis of ['u','v']){const center=(bounds[axis][0]+bounds[axis][1])/2;const half=Number(mode)/2;bounds[axis]=[center-half,center+half];}return bounds;
}
export function faceGridContains(face,point,mode){if(mode==='unlimited')return true;if(mode==='face')return regionContains(face,point);const bounds=faceGridBounds(face,mode);return point[0]>=bounds.u[0]&&point[0]<=bounds.u[1]&&point[1]>=bounds.v[0]&&point[1]<=bounds.v[1];}
export function faceGridPatches(face,points,step){
 const onBoundary=point=>[face.outer,...face.holes].some(ring=>ring.some((a,i)=>{const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<1e-6;}));
 const patches=new Map();for(const point of points){if(!point?.every(Number.isFinite)||regionContains(face,point)||onBoundary(point))continue;const center=point.map(value=>Math.round(value/step)*step),key=center.join(',');patches.set(key,{u:[center[0]-2*step,center[0]+2*step],v:[center[1]-2*step,center[1]+2*step]});}return [...patches.values()].sort((a,b)=>a.u[0]-b.u[0]||a.v[0]-b.v[0]);
}
export function scopedFaceGrid(face,mode,snapStep,patches=[]){
 const bounds=faceGridBounds(face,mode);let step=snapStep;while(Math.max(bounds.u[1]-bounds.u[0],bounds.v[1]-bounds.v[0])/step>180)step*=2;const positions=[],rings=[face.outer,...face.holes];
 const append=(fixed,axis,a,b)=>{if(b-a<1e-6)return;positions.push(...(axis===0?[fixed,0,a,fixed,0,b]:[a,0,fixed,b,0,fixed]));};
 for(const axis of [0,1]){const fixedBounds=axis===0?bounds.u:bounds.v,other=axis===0?bounds.v:bounds.u,indices=new Set();
  for(const range of [fixedBounds,...patches.map(p=>axis===0?p.u:p.v)])for(let i=Math.ceil(range[0]/step);i<=Math.floor(range[1]/step);i++)indices.add(i);
  for(const index of [...indices].sort((a,b)=>a-b)){const value=index*step;if(mode==='100'||mode==='200'){append(value,axis,...other);continue;}const crossings=[];
   for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[axis]>value)!==(b[axis]>value))crossings.push(a[1-axis]+(b[1-axis]-a[1-axis])*(value-a[axis])/(b[axis]-a[axis]));}
   // Alternating intersections cover the outer ring and skip its holes.
   crossings.sort((a,b)=>a-b);const intervals=[];for(let i=0;i+1<crossings.length;i+=2)intervals.push([crossings[i],crossings[i+1]]);
   for(const patch of patches){const fixed=axis===0?patch.u:patch.v;if(value>=fixed[0]&&value<=fixed[1])intervals.push([...(axis===0?patch.v:patch.u)]);}
   intervals.sort((a,b)=>a[0]-b[0]);let merged=null;for(const interval of intervals){if(merged&&interval[0]<merged[1]-1e-6)merged[1]=Math.max(merged[1],interval[1]);else{if(merged)append(value,axis,...merged);merged=[...interval];}}if(merged)append(value,axis,...merged);
  }
 }
 const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial());return {grid,step,bounds};
}
