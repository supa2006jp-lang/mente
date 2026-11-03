import {suggestTraceTolerance} from './reference-trace-auto-tolerance.js';
import {validateTraceEdits} from './reference-trace-edit.js';
import {offsetTraceRings} from './reference-trace-offset.js';
export function validateTraceBatch(entries,size){
 if(!Array.isArray(entries)||entries.length>32)throw Error('一括調整の一覧は32部分以内にしてください');let points=0;const keys=new Set();
 for(const e of entries){if(!e||typeof e.key!=='string'||e.key.length>100||keys.has(e.key)||typeof e.selected!=='boolean'||!['auto','circle','ellipse','rectangle','roundedRectangle','slot','dShape'].includes(e.shape)||!Number.isFinite(e.limit)||e.limit<.01||e.limit>10||typeof e.offset!=='boolean'||typeof e.keep!=='boolean'||!Array.isArray(e.distances)||e.distances.length!==e.rings?.length||e.distances.some(n=>!Number.isFinite(n)||Math.abs(n)<.001||Math.abs(n)>100))throw Error('一括調整のデータが不正です');validateTraceEdits(e.rings,...size);points+=e.rings.reduce((n,r)=>n+r.points.length,0);keys.add(e.key);}if(points>12000)throw Error('一括調整の輪郭は合計12,000頂点以内にしてください');return entries;
}
export async function adjustTraceBatch(entries,scale,size,{signal,onProgress=()=>{}}={}){
 validateTraceBatch(entries,size);const results=[];
 for(const [i,entry]of entries.entries()){if(!entry.selected)continue;if(signal?.aborted)throw new DOMException('一括調整を中止しました','AbortError');onProgress({current:i+1,total:entries.length});
  try{let rings=structuredClone(entry.rings);const fits=[];for(let n=0;n<rings.length;n++){const fit=await suggestTraceTolerance(rings,n,scale,size,{shape:entry.shape,maxTolerance:entry.limit,signal});rings[n]=fit.ring;fits.push({shape:fit.type,tolerance:fit.tolerance});}validateTraceEdits(rings,...size);let groups=[rings];if(entry.offset){const out=offsetTraceRings(rings,entry.distances,scale,size);groups=entry.keep?[rings,out]:[out];}results.push({key:entry.key,ok:true,rings,fits,groups});}
  catch(e){if(e.name==='AbortError')throw e;results.push({key:entry.key,ok:false,error:e.message});}
 }
 return results;
}
