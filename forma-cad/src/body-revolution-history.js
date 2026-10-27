import * as THREE from 'three';

const vector=a=>new THREE.Vector3(...a);
const finiteVector=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
function sweepSpec(p){return p?.type==='revolve'&&p.bodySweep&&p.sourceBody&&finiteVector(p.origin)&&finiteVector(p.axisVector)&&vector(p.axisVector).length()>1e-8&&Number.isFinite(p.angle)&&p.angle>0&&p.angle<=360&&['片側','逆方向','対称'].includes(p.direction);}
function interval(p,axis){
 let low=p.direction==='対称'?-p.angle/2:p.direction==='逆方向'?-p.angle:0,high=low+p.angle;
 if(vector(p.axisVector).dot(axis)<0)[low,high]=[-high,-low];
 return [low,high];
}
export function lastBodyWriter(features,id,end=features.length){
 for(let index=end-1;index>=0;index--){
  const original=features[index],feature=original.cadResult?{kind:'cadop',...original.cadResult}:original;
  if(feature.kind==='cadop'){
   if(feature.outputs?.some(output=>output.id===id))return {feature,index};
   if(feature.remove?.includes(id))return null;
  }else if(!['sketch','plane','referenceImage'].includes(feature.kind)&&(feature.operation==='new'?feature.id:feature.target)===id)return null;
 }
 return null;
}

// S(a,b, S(c,d, body)) = S(a+c,b+d, body) for the same axis.
// Resolve only uninterrupted, pure sweeps of this output. A move, cut, fillet,
// different axis, or join to a different body is a hard history boundary.
// In particular a same-ID join must read its source BEFORE that history step.
export function coaxialSweepPlan(features,p){
 if(!sweepSpec(p))return null;
 const axis=vector(p.axisVector).normalize(),origin=vector(p.origin);let [low,high]=interval(p,axis),sourceBody=p.sourceBody,end=features.length,count=0,previousSpan=0;
 while(true){
  const writer=lastBodyWriter(features,sourceBody,end);if(!writer)break;
  const {feature,index}=writer,previous=feature.spec;
  if(!sweepSpec(previous)||feature.outputs.length!==1||!(previous.operation==='new'&&sourceBody===previous.id||previous.operation==='join'&&previous.target===previous.sourceBody&&sourceBody===previous.sourceBody))break;
  const previousAxis=vector(previous.axisVector).normalize();
  if(previousAxis.clone().cross(axis).length()>1e-8||vector(previous.origin).sub(origin).cross(axis).length()>1e-7)break;
  const [a,b]=interval(previous,axis);low+=a;high+=b;previousSpan+=b-a;count++;sourceBody=previous.sourceBody;end=index;
 }
 if(!count)return null;
 const angle=Math.min(360,high-low);
 return {sourceBody,end,count,angle,start:angle===360?0:low,alreadyFull:previousSpan>=360,origin:[...p.origin],axisVector:axis.toArray()};
}
