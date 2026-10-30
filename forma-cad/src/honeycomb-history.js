import {compactKernelData} from './kernel-transfer.js';
// Use the latest exact target snapshot, retaining full history for operations
// whose source still depends on earlier geometry. Never send other display meshes.
export function honeycombTargetHistory(features,target){
 for(let i=features.length-1;i>=0;i--){
  const f=features[i],result=f.cadResult||(f.kind==='cadop'?f:null);
  if(result){
   if(result.remove?.includes(target))break;
   const output=result.outputs?.find(o=>o.id===target);
   if(!output)continue;
   if(!output.brep||f.spec?.type==='enclose'&&!f.spec.boxMode&&!f.spec.hinge)break;
   return compactKernelData([{kind:'cadop',id:target,outputs:[output],remove:[]}]);
  }
  if(f.kind==='sketch'||f.kind==='plane'||f.kind==='referenceImage')continue;
  if((f.operation==='new'?f.id:f.target)!==target)continue;
  if(f.kind==='extrusion'&&f.operation==='new'&&['circle','rect'].includes(f.profile)&&!f.region&&!f.barrier&&!f.untilSolid&&!f.overlapOnly&&!f.holesOnly&&!f.faceBatch)return compactKernelData([f]);
  break;
 }
 return compactKernelData(features);
}
