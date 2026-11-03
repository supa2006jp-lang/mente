import {splineEndpoint} from './spline-curve.js';
import {curvePolyline,polylineDifference,polylineIntersections,pointSegmentDistance2} from './spline-analysis.js';

export async function simplifySpline(feature,tolerance,{cancelled=()=>false,onProgress=()=>{},yieldWork=()=>new Promise(r=>setTimeout(r,0)),maxAttempts=400}={}){
 if(!Number.isFinite(tolerance)||tolerance<.001||tolerance>10)throw Error('許容誤差は0.001〜10 mmで指定してください');if(feature.profile!=='spline'||feature.points.length<3)throw Error('3点以上のスプラインを選んでください');
 const precision=tolerance/10,original=curvePolyline(feature,precision),baseline=structuredClone(feature);if(original.limited)throw Error('曲線が細かすぎます。許容誤差を少し大きくしてください');if(polylineIntersections(original,{closed:!!feature.closed,maxResults:1}).length)throw Error('自己交差している箇所を修正してから整理してください');
 const protectedPoints=new Set();
 if(!feature.closed){baseline.tangents={...feature.tangents};baseline.tangentLengths={...feature.tangentLengths};for(const end of ['start','end']){const data=splineEndpoint(feature,end);baseline.tangents[end]=data.angle;if(data.handleLength>=.01&&data.handleLength<=10000)baseline.tangentLengths[end]=data.handleLength;else protectedPoints.add(end==='start'?baseline.points[1]:baseline.points.at(-2));}}
 let next=baseline,attempts=0,error=0,limited=false;const minimum=feature.closed?3:2,area=ps=>ps.reduce((n,a,i)=>n+a[0]*ps[(i+1)%ps.length][1]-a[1]*ps[(i+1)%ps.length][0],0);
 while(next.points.length>minimum){let accepted=false;const ps=next.points,indices=ps.map((_,i)=>i).filter(i=>(feature.closed?i>0:i>0&&i<ps.length-1)&&!protectedPoints.has(ps[i])).sort((a,b)=>pointSegmentDistance2(ps[a],ps[(a+ps.length-1)%ps.length],ps[(a+1)%ps.length])-pointSegmentDistance2(ps[b],ps[(b+ps.length-1)%ps.length],ps[(b+1)%ps.length]));
  for(const index of indices){if(cancelled())throw Object.assign(Error('整理をキャンセルしました'),{name:'AbortError'});if(attempts++>=maxAttempts){limited=true;break;}if(attempts%4===1){onProgress({points:next.points.length,attempts});await yieldWork();if(cancelled())throw Object.assign(Error('整理をキャンセルしました'),{name:'AbortError'});}
   const candidate={...next,points:next.points.filter((_,i)=>i!==index)},samples=curvePolyline(candidate,precision);if(samples.limited||polylineIntersections(samples,{closed:!!feature.closed,maxResults:1}).length||feature.closed&&area(original)*area(samples)<=0)continue;const measured=polylineDifference(original,samples,tolerance);if(measured+precision*2>tolerance)continue;next=candidate;error=measured+precision*2;accepted=true;break;
  }if(!accepted||limited)break;
 }
 return {feature:next.points.length===feature.points.length?structuredClone(feature):next,before:feature.points.length,after:next.points.length,error,limited,attempts,tolerance};
}
