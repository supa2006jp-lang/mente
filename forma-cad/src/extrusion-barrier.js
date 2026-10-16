import * as R from 'replicad';
import {cutWithClearance} from './cut-clearance.js';
import {validateExtrusionBarrier} from './extrusion-barrier-options.js';
import {cachedBody} from './body-cache.js';
const threadReliefs=new Set();

// Keep the source/join anchor connected. All other bodies are immutable barriers.
// A true surface offset creates clearance around sides and corners as well.
export function barrierGapShape(tool,result,blockers){
 // Display booleans must not add p-curves or triangulations to model bodies.
 const source=R.deserializeShape(tool.serialize()).asShape3D(),after=R.deserializeShape(result.serialize()).asShape3D();let gap;
 try{
  gap=source.cut(after);
  for(const blocker of blockers){const copy=R.deserializeShape(blocker.serialize()).asShape3D();try{const next=gap.cut(copy);gap.delete();gap=next;}finally{copy.delete();}}
  const output=gap;gap=null;return output;
 }finally{gap?.delete();after.delete();source.delete();}
}
export function barrierExtrusion(tool,bodies,f,previewInfo,{fallback,cacheKey}={}){
 validateExtrusionBarrier(f);
 const gap=f.barrierGap??.4,source=f.region?.cadFace?.bodyId||f.region?.bodyId||f.region?.gridSourceBodyId;
 const blockers=[...bodies].filter(([id,shape])=>id!==source&&!(f.operation==='join'&&id===f.target)&&R.measureDistanceBetween(tool,shape)<=gap+1e-6).map(([,shape])=>shape);
 if(!blockers.length)return tool.clone();
 let result;
 try{
  let usedThread=false;
  const key='extrusion-barrier:'+(cacheKey||JSON.stringify([gap,tool.serialize(),...blockers.map(shape=>shape.serialize())]));
  const entry=cachedBody(key,()=>{
   let candidate;
   try{
    candidate=cutWithClearance(tool,blockers,gap,{fallback:(...args)=>{const shape=fallback?.(...args);if(shape)usedThread=true;return shape;}});
    const check=new (R.getOC().BRepCheck_Analyzer)(candidate.wrapped,true,false);
    try{if(!check.IsValid()||!Number.isFinite(R.measureVolume(candidate))||R.measureVolume(candidate)<=1e-9)throw Error('障害物とすき間で押し出し形状がなくなるか、不正になります。距離・すき間を調整してください');}finally{check.delete();}
    for(const blocker of blockers)if(R.measureDistanceBetween(candidate,blocker)<gap-1e-5)throw Error('指定したバリアのすき間を確保できませんでした。すき間を小さくするか、障害物の形状を確認してください');
    const output=candidate;candidate=null;return output;
   }finally{candidate?.delete();}
  });
  result=entry.shape;
  if(usedThread){threadReliefs.add(entry.token);while(threadReliefs.size>48)threadReliefs.delete(threadReliefs.values().next().value);}
  if(previewInfo&&threadReliefs.has(entry.token))previewInfo.barrierThreadRelief=gap;
  if(previewInfo&&gap>0){
   let space;
   try{
    space=barrierGapShape(tool,result,blockers);
    if(R.measureVolume(space)>1e-9){
     const check=new (R.getOC().BRepCheck_Analyzer)(space.wrapped,true,false);
     try{if(!check.IsValid())throw Error('invalid gap overlay');}finally{check.delete();}
     previewInfo.barrierClearance=[space.mesh({tolerance:.025,angularTolerance:.1})];
    }
   }catch(error){
    if(error instanceof WebAssembly.RuntimeError||/indirect call to null|null function|memory access out of bounds|unreachable|table index|function signature mismatch|aborted|RuntimeError/i.test(error?.message||''))throw error;
    previewInfo.barrierClearanceWarning='すき間の色表示を作成できませんでした。押し出し形状は確認できます。';
   }finally{space?.delete();}
  }
  const output=result;result=null;return output;
 }finally{result?.delete();}
}
