import {traceRegularCandidates,regularizeTraceRings} from './reference-trace-regular.js';
import {validateTraceEdits} from './reference-trace-edit.js';
const area=ps=>Math.abs(ps.reduce((s,p,i)=>s+p[0]*ps[(i+1)%ps.length][1]-p[1]*ps[(i+1)%ps.length][0],0)/2);
const aborted=()=>{throw new DOMException('自動調整を中止しました','AbortError');};
export async function suggestTraceTolerance(rings,index,scale=[1,1],size=[1024,1024],{shape='auto',maxTolerance=3,signal,onProgress=()=>{}}={}){
 validateTraceEdits(rings,...size);if(!rings[index]||!Number.isInteger(index)||!scale.every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(maxTolerance)||maxTolerance<.01||maxTolerance>10||!['auto','circle','ellipse','rectangle','roundedRectangle','slot','dShape'].includes(shape))throw Error('自動調整の対象・上限・形を確認してください');
 const source=rings[index],physical=source.points.map(p=>p.map((n,k)=>n*scale[k])),shortSide=Math.min(...[0,1].map(k=>Math.max(...physical.map(p=>p[k]))-Math.min(...physical.map(p=>p[k])))),limit=Math.min(maxTolerance,shortSide*.12),sourceArea=area(source.points),fits=[];
 if(signal?.aborted)aborted();await new Promise(r=>setTimeout(r,0));
 for(const fit of traceRegularCandidates(source,scale,.005)){
  if(signal?.aborted)aborted();if(shape==='auto'||fit.type===shape){const change=Math.abs(area(fit.ring.points)/sourceArea-1);if(fit.error<=limit&&change<=.25)fits.push(fit);}onProgress();await new Promise(r=>setTimeout(r,0));
 }
 fits.sort((a,b)=>a.error-b.error);if(shape==='auto'&&fits.length){const close=fits.filter(f=>f.error<=fits[0].error+.015),order=['circle','rectangle','slot','roundedRectangle','dShape','ellipse'];close.sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)||a.error-b.error);const preferred=close[0];fits.splice(fits.indexOf(preferred),1);fits.unshift(preferred);}
 for(const fit of fits){if(signal?.aborted)aborted();let tolerance=Math.max(.01,Math.ceil((fit.error+.005)*100)/100);
  // Recheck with the exact precision used by the normal preview. A bounded
  // 0.01 mm adjustment avoids relying on monotonicity between shape families.
  for(let step=0;step<3&&tolerance<=limit+1e-9;step++,tolerance=Math.round((tolerance+.01)*100)/100){
   const options=rings.map(()=>({skip:true}));options[index]={tolerance,shape:fit.type};
   try{const single=regularizeTraceRings(rings,tolerance,scale,size,{shape:fit.type,contours:options});const ring=single.rings[index];if(![single.circles,single.ellipses,single.rectangles,single.roundedRectangles,single.slots,single.dShapes].some(Boolean))continue;const proposed=rings.map((r,i)=>i===index?ring:r);validateTraceEdits(proposed,...size);if(Math.abs(area(ring.points)/sourceArea-1)>.25)continue;return {ring,index,type:fit.type,tolerance,error:single.error,limit,areaChange:Math.abs(area(ring.points)/sourceArea-1)};}catch(e){if(e.name==='AbortError')throw e;}
  }
 }
 throw Error('形を大きく変えずに整理できる候補がありません。対象の検出位置・検出方法を見直すか、整理する形を指定してください');
}
