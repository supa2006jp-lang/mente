import * as THREE from 'three';

// Locate the clicked segment in the same sampled curve used by the viewport.
// Catmull-Rom parameters advance one interval per pair of fit points, including
// the last-to-first interval of a closed curve.
export function splinePointInsertion(feature,pointer,project,tolerance=9){
 const points=feature.points;if(points.length<2)return null;
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p,0)),!!feature.closed,'centripetal');
 const divisions=Math.max(32,points.length*16),intervals=points.length-(feature.closed?0:1);
 let previous=project(points[0]),best=null,distance=tolerance;
 for(let i=1;i<=divisions;i++){
  const sample=curve.getPoint(i/divisions),next=project([sample.x,sample.y]);
  if(previous.z>=-1&&previous.z<=1&&next.z>=-1&&next.z<=1){
   const dx=next.x-previous.x,dy=next.y-previous.y,length=dx*dx+dy*dy;
   const fraction=length?THREE.MathUtils.clamp(((pointer.x-previous.x)*dx+(pointer.y-previous.y)*dy)/length,0,1):0;
   const d=Math.hypot(pointer.x-previous.x-dx*fraction,pointer.y-previous.y-dy*fraction);
   if(d<distance){const t=(i-1+fraction)/divisions,p=curve.getPoint(t);distance=d;best={index:Math.min(points.length,Math.floor(t*intervals)+1),point:[p.x,p.y]};}
  }
  previous=next;
 }
 if(best&&points.some(p=>Math.hypot(p[0]-best.point[0],p[1]-best.point[1])<1e-7))return null;
 return best;
}
