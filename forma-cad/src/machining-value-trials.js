import {KernelClient} from './kernel-client.js';

const dimensionFields={shell:'thickness',fillet:'radius',chamfer:'distance'};
export function trialDimension(type){return dimensionFields[type]||null;}

export async function findMachiningValues(features,spec,{signal,isCurrent,onProgress,client=new KernelClient(),budgetMs=9000}={}){
 const key=trialDimension(spec.type),failed=spec[key];
 if(!key||!Number.isFinite(failed)||failed<=0)return [];
 const values=[...new Set([.8,.6,.4,.25].map(ratio=>Number((failed*ratio).toPrecision(6))))].filter(value=>value>=.001&&value<failed);
 const results=[];
 const deadline=performance.now()+budgetMs;
 const cancel=()=>client.reset();
 const watchdog=setTimeout(cancel,budgetMs);
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  for(const value of values){
   const remaining=deadline-performance.now();
   if(remaining<=0||signal?.aborted||!isCurrent())break;
   onProgress?.(value);
   const trial={...spec,[key]:value};
   delete trial.partialMode;
   try{
    const result=await client.run(features,{type:'machiningValueTrial',operation:trial},{timeout:Math.min(2500,remaining)});
    if(signal?.aborted||!isCurrent())break;
    const reports=result.analysis?.geometryHealth?.rows||[];
    if(result.outputs?.length&&result.outputs.every(output=>output.brep&&output.shapeMetrics?.solids>0&&
      reports.some(row=>row.id===output.id&&row.valid))){
     results.push({value,result});
     if(results.length===2)break;
    }
   }catch(error){
    if(signal?.aborted||error.code==='cancelled')break;
   }
  }
  return results;
 }finally{
  clearTimeout(watchdog);
  signal?.removeEventListener('abort',cancel);
  client.reset();
 }
}
