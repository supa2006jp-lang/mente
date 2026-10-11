import * as THREE from 'three';

// Angles are measured in the sketch plane, in the direction from start to end.
export function splineEndpoint(feature,end){
 const ps=feature.points,i=end==='start'?0:ps.length-1,p=ps[i],q=ps[end==='start'?1:i-1];
 const dx=end==='start'?q[0]-p[0]:p[0]-q[0],dy=end==='start'?q[1]-p[1]:p[1]-q[1];
 const length=Math.hypot(dx,dy);
 return {point:p,angle:feature.tangents?.[end]??Math.atan2(dy,dx)*180/Math.PI,length,handleLength:feature.tangentLengths?.[end]??length/3};
}
export function splineCurve(feature){
 const base=new THREE.CatmullRomCurve3(feature.points.map(p=>new THREE.Vector3(...p,0)),!!feature.closed,'centripetal');
 if(feature.closed||!['start','end'].some(k=>Number.isFinite(feature.tangents?.[k])||Number.isFinite(feature.tangentLengths?.[k])))return base;
 const intervals=feature.points.length-1,deltas={};
 for(const end of ['start','end'])if(Number.isFinite(feature.tangents?.[end])||Number.isFinite(feature.tangentLengths?.[end])){
  const {angle,handleLength}=splineEndpoint(feature,end),a=angle*Math.PI/180;
  const p=feature.points,q=end==='start'?new THREE.Vector3(p[1][0]-p[0][0],p[1][1]-p[0][1],0):new THREE.Vector3(p.at(-1)[0]-p.at(-2)[0],p.at(-1)[1]-p.at(-2)[1],0);
  deltas[end]=new THREE.Vector3(Math.cos(a)*handleLength*3,Math.sin(a)*handleLength*3,0).sub(q);
 }
 const curve=new THREE.Curve();
 curve.getPoint=(t,target=new THREE.Vector3())=>{
  base.getPoint(t,target);const u=t*intervals;
  // Hermite corrections preserve every fit point and the derivative at the
  // adjacent interval. Only the first/last interval changes.
  if(deltas.start&&u<=1)target.addScaledVector(deltas.start,u*(1-u)*(1-u));
  if(deltas.end&&u>=intervals-1){const s=u-(intervals-1);target.addScaledVector(deltas.end,s*s*(s-1));}
  return target;
 };
 return curve;
}
export function splineSamples(feature){
 if(feature.points.length<2)return feature.points.map(p=>[...p]);
 return splineCurve(feature).getPoints(Math.max(32,feature.points.length*16)).map(p=>[p.x,p.y]);
}
