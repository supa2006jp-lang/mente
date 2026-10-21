import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {sketchPoints,planeCoordinates} from './regions.js';
import {splineCurve} from './spline-curve.js';

// Extents along the movement direction, using analytic circle and cubic
// extrema rather than the display mesh's tessellation or world axis box.
export function mirrorSketchRange(sources,normal){
 const n=normal.clone().normalize();let low=Infinity,high=-Infinity;
 const add=value=>{low=Math.min(low,value);high=Math.max(high,value);};
 for(const f of sources){
  const basis=basisFor(f),frame={...f,offset:planeCoordinates(f).offset};
  if(f.profile==='circle'){
   const center=new THREE.Vector3(f.x,f.y,f.z).dot(n),radius=f.diameter/2*Math.hypot(basis.u.dot(n),basis.v.dot(n));add(center-radius);add(center+radius);
  }else if(f.profile==='spline'&&f.points.length>1){
   const curve=splineCurve(f),count=f.closed?f.points.length:f.points.length-1;
   const value=t=>{const p=curve.getPoint(t);return worldPoint(frame,[p.x,p.y]).dot(n);};
   for(let i=0;i<count;i++){
    const values=[0,1/3,2/3,1].map(t=>value((i+t)/count)),[y0,y1,y2,y3]=values,d1=y1-y0,d2=y2-y0,d3=y3-y0,a=4.5*(d3-3*d2+3*d1),b=4.5*(d2-2*d1)-a,c=d3-a-b;
    add(y0);add(y3);const A=3*a,B=2*b,C=c,tolerance=1e-12*Math.max(1,Math.abs(A),Math.abs(B),Math.abs(C)),roots=[];
    if(Math.abs(A)<tolerance){if(Math.abs(B)>=tolerance)roots.push(-C/B);}else{const discriminant=B*B-4*A*C;if(discriminant>=0){const root=Math.sqrt(discriminant);roots.push((-B-root)/(2*A),(-B+root)/(2*A));}}
    for(const t of roots)if(t>0&&t<1)add(((a*t+b)*t+c)*t+y0);
   }
  }else for(const p of sketchPoints(f))add(worldPoint(frame,p).dot(n));
 }
 if(!Number.isFinite(low)||!Number.isFinite(high))throw Error('ミラーする図形を選択してください');
 return [low,high];
}

export function mirrorGapOffset(range,spec,gap,side=1){
 if(!Number.isFinite(gap)||gap<0||gap>10000)throw Error('すき間は0〜10000 mmで入力してください');
 const normal=new THREE.Vector3(...spec.mirrorNormal).normalize(),origin=new THREE.Vector3(...spec.mirrorOrigin).dot(normal),plane=side<0?range[0]-gap/2:range[1]+gap/2,offset=plane-origin;
 if(Math.abs(offset)>10000)throw Error('配置が移動できる範囲を超えています');
 return offset;
}
