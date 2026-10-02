import * as THREE from 'three';
import {selectedCadFaces} from './face-pull.js';

export {threadSource} from './thread-source.js';

export {allThreadPullSpec} from './thread-pull-spec.js';

export function offsetThreadProfile(points,offsets){
 const area=points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-a[1]*b[0];},0),sign=Math.sign(area);
 const lines=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),n=[sign*dy/length,-sign*dx/length];return {n,c:n[0]*a[0]+n[1]*a[1]+(offsets[i]||0)};});
 // Intersect all half-planes: a narrow crest may disappear while the two
 // flanks still enclose a valid triangular ridge.
 const result=[];
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j],det=a.n[0]*b.n[1]-a.n[1]*b.n[0];
  if(Math.abs(det)<1e-10)continue;
  const p=[(a.c*b.n[1]-a.n[1]*b.c)/det,(a.n[0]*b.c-a.c*b.n[0])/det];
  if(p.every(Number.isFinite)&&lines.every(l=>p[0]*l.n[0]+p[1]*l.n[1]<=l.c+1e-8)&&!result.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-8))result.push(p);
 }
 if(result.length<3)throw Error('距離が大きすぎてねじ山がなくなります。小さい距離で実行してください');
 const center=result.reduce((s,p)=>[s[0]+p[0]/result.length,s[1]+p[1]/result.length],[0,0]);
 result.sort((a,b)=>sign*(Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0])));
 const newArea=result.reduce((s,a,i)=>{const b=result[(i+1)%result.length];return s+a[0]*b[1]-a[1]*b[0];},0);
 if(Math.abs(newArea)<1e-10)throw Error('距離が大きすぎてねじ山がなくなります。小さい距離で実行してください');
 return result;
}

export function threadPullSpec(original,current,selections,spec,distance){
 const chosen=selectedCadFaces(current,selections);
 if(chosen.some(f=>f.geomType!=='BSPLINE_SURFACE'))return null;
 const point=new THREE.Vector3(...spec.surfacePoint);
 let axis=null;
 for(const f of original.faces){
  if(f.geomType!=='CYLINDRE')continue;
  const c=f.surface.wrapped.Cylinder(),l=c.Location(),d=c.Axis().Direction(),n=new THREE.Vector3(d.X(),d.Y(),d.Z()),delta=point.clone().sub(new THREE.Vector3(l.X(),l.Y(),l.Z())),v=delta.dot(n);
  if(Math.abs(delta.addScaledVector(n,-v).length()-c.Radius())<.3&&v>=f.UVBounds.vMin-.1&&v<=f.UVBounds.vMax+.1){axis=n;break;}
 }
 if(!axis)return null;
 if(spec.threadVersion===2){const a=axis.toArray(),dominant=a.reduce((best,v,i)=>Math.abs(v)>Math.abs(a[best])?i:best,0);if(a[dominant]<0)axis.negate();}
 const offsets=[...(spec.threadFaceOffsets||[0,0,0,0])],indices=new Set();
 for(const selection of selections){
  const n=new THREE.Vector3(...selection.normal).normalize(),z=n.dot(axis);
  indices.add(Math.abs(z)<.3?1:z<0?0:2);
 }
 for(const index of indices)offsets[index]+=distance;
 if(offsets.some(x=>Math.abs(x)>spec.pitch*.4))throw Error('ねじ山の調整距離が大きすぎます。ピッチの40%以内で指定してください');
 return {...spec,threadFaceOffsets:offsets};
}
