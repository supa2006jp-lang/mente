import * as THREE from 'three';
import {regionContains} from './regions.js';
export function faceGridBounds(face,mode){
 const bounds={u:[Math.min(...face.outer.map(p=>p[0])),Math.max(...face.outer.map(p=>p[0]))],v:[Math.min(...face.outer.map(p=>p[1])),Math.max(...face.outer.map(p=>p[1]))]};
 if(mode==='200')for(const axis of ['u','v']){const center=(bounds[axis][0]+bounds[axis][1])/2;bounds[axis]=[center-100,center+100];}return bounds;
}
export function faceGridContains(face,point,mode){if(mode==='unlimited')return true;if(mode==='face')return regionContains(face,point);const bounds=faceGridBounds(face,mode);return point[0]>=bounds.u[0]&&point[0]<=bounds.u[1]&&point[1]>=bounds.v[0]&&point[1]<=bounds.v[1];}
export function scopedFaceGrid(face,mode,snapStep){
 const bounds=faceGridBounds(face,mode);let step=snapStep;while(Math.max(bounds.u[1]-bounds.u[0],bounds.v[1]-bounds.v[0])/step>180)step*=2;const positions=[],rings=[face.outer,...face.holes];
 const append=(fixed,axis,a,b)=>{if(b-a<1e-6)return;positions.push(...(axis===0?[fixed,0,a,fixed,0,b]:[a,0,fixed,b,0,fixed]));};
 for(const axis of [0,1]){const fixedBounds=axis===0?bounds.u:bounds.v,other=axis===0?bounds.v:bounds.u;
  for(let index=Math.ceil(fixedBounds[0]/step);index<=Math.floor(fixedBounds[1]/step);index++){const value=index*step;if(mode==='200'){append(value,axis,...other);continue;}const crossings=[];
   for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[axis]>value)!==(b[axis]>value))crossings.push(a[1-axis]+(b[1-axis]-a[1-axis])*(value-a[axis])/(b[axis]-a[axis]));}
   // Alternating intersections cover the outer ring and skip its holes.
   crossings.sort((a,b)=>a-b);for(let i=0;i+1<crossings.length;i+=2)append(value,axis,crossings[i],crossings[i+1]);
  }
 }
 const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial());return {grid,step,bounds};
}
