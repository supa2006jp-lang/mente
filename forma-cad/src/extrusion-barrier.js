import * as R from 'replicad';
import {measurePhase} from './phase-timings.js';
import {cutWithClearance} from './cut-clearance.js';
import {validateExtrusionBarrier} from './extrusion-barrier-options.js';
import {cachedBody} from './body-cache.js';
const assessments=new Map(),gapMeshes=new Map();let gapMeshBytes=0;
function rememberGap(token,mesh){
 const bytes=[mesh.vertices,mesh.triangles,mesh.normals].reduce((sum,data)=>sum+(data?.length||0)*8,0);
 gapMeshes.set(token,{mesh,bytes});gapMeshBytes+=bytes;
 while(gapMeshes.size>8||gapMeshBytes>8*1024*1024){const key=gapMeshes.keys().next().value;gapMeshBytes-=gapMeshes.get(key).bytes;gapMeshes.delete(key);}
}
function nearby(tool,shape,gap){
 const a=tool.boundingBox,b=shape.boundingBox;
 try{return a.bounds[0].every((lo,i)=>lo<=b.bounds[1][i]+gap+1e-6&&a.bounds[1][i]>=b.bounds[0][i]-gap-1e-6);}finally{a.delete();b.delete();}
}
function clearanceDistance(left,right){return measurePhase('inspection',()=>{
 const query=new (R.getOC().BRepExtrema_DistShapeShape)();
 try{
  query.LoadS1(left.wrapped);query.LoadS2(right.wrapped);query.Perform();
  const value=query.IsDone()?query.Value():NaN;
  if(!Number.isFinite(value))throw Error('障害物とのすき間を検査できませんでした。形状を確認してください');
  return value;
 }finally{query.delete();}
});}
function cutGapTool(base,tool){
 // The convenience constructor performs a boolean immediately. Supplying its
 // inputs afterwards builds it once and keeps the thread's periodic seams.
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Cut(),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();
 try{
  args.Append(base.wrapped);tools.Append(tool.wrapped);builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.Build();
  if(builder.HasErrors())throw Error('gap boolean failed');
  const raw=builder.Shape();try{return R.cast(raw).asShape3D();}finally{raw.delete();}
 }finally{builder.delete();args.delete();tools.delete();}
}

// Keep the source/join anchor connected. All other bodies are immutable barriers.
// A true surface offset creates clearance around sides and corners as well.
export function barrierGapShape(tool,result,blockers){return measurePhase('display',()=>{
 // Display booleans must not add p-curves or triangulations to model bodies.
 const source=R.deserializeShape(tool.serialize()).asShape3D(),after=R.deserializeShape(result.serialize()).asShape3D();let gap;
 try{
  gap=source.cut(after);
  for(const blocker of blockers){const copy=R.deserializeShape(blocker.serialize()).asShape3D();try{const next=cutGapTool(gap,copy);gap.delete();gap=next;}finally{copy.delete();}}
  const output=gap;gap=null;return output;
 }finally{gap?.delete();after.delete();source.delete();}
});}
export function barrierExtrusion(tool,bodies,f,previewInfo,{fallback,cacheKey,onProgress}={}){
 validateExtrusionBarrier(f);
 const gap=f.barrierGap??.6,source=f.region?.cadFace?.bodyId||f.region?.bodyId||f.region?.gridSourceBodyId;
 const eligible=[...bodies].filter(([id])=>id!==source&&!(f.operation==='join'&&id===f.target));
 let result;
 try{
  let assessment;
  const key='extrusion-barrier:'+(cacheKey||JSON.stringify([gap,tool.serialize(),...eligible.map(([id,shape])=>[id,shape.serialize()])]));
  const entry=cachedBody(key,()=>{
   const blockers=eligible.filter(([,shape])=>nearby(tool,shape,gap)&&clearanceDistance(tool,shape)<=gap+1e-6);
   assessment={ids:blockers.map(([id])=>id),thread:false};
   if(!blockers.length)return tool.clone();
   let candidate;
   try{
    candidate=measurePhase('geometry',()=>cutWithClearance(tool,blockers.map(([,shape])=>shape),gap,{fallback:(...args)=>{const shape=fallback?.(...args,report=>{(assessment.threadProfiles||=[]).push(report);});if(shape)assessment.thread=true;return shape;}}));
    measurePhase('inspection',()=>{const check=new (R.getOC().BRepCheck_Analyzer)(candidate.wrapped,true,false);
    try{if(!check.IsValid()||!Number.isFinite(R.measureVolume(candidate))||R.measureVolume(candidate)<=1e-9)throw Error('障害物とすき間で押し出し形状がなくなるか、不正になります。距離・すき間を調整してください');}finally{check.delete();}});
    for(const [i,[,blocker]] of blockers.entries()){onProgress?.({stage:'障害物とのすき間を検査しています',current:i+1,total:blockers.length});if(clearanceDistance(candidate,blocker)<gap-1e-5)throw Error('指定したバリアのすき間を確保できませんでした。すき間を小さくするか、障害物の形状を確認してください');}
    const output=candidate;candidate=null;return output;
   }finally{candidate?.delete();}
  });
  result=entry.shape;
  assessment||=assessments.get(entry.token);
  if(assessment){assessments.delete(entry.token);assessments.set(entry.token,assessment);while(assessments.size>48)assessments.delete(assessments.keys().next().value);}
  if(previewInfo&&assessment?.thread)previewInfo.barrierThreadRelief=gap;
  if(previewInfo&&assessment?.threadProfiles)previewInfo.barrierThreadProfiles=assessment.threadProfiles.map(report=>({...report}));
  if(previewInfo&&previewInfo.showBarrierGap!==false&&gap>0&&assessment?.ids.length!==0){
   let space;
   try{
    const cached=gapMeshes.get(entry.token);
    if(cached){gapMeshes.delete(entry.token);gapMeshes.set(entry.token,cached);previewInfo.barrierClearance=[cached.mesh];}
    else{
     onProgress?.({stage:'すき間の色表示を作成しています'});
     const blockers=assessment?assessment.ids.map(id=>bodies.get(id)):eligible.filter(([,shape])=>nearby(tool,shape,gap)).map(([,shape])=>shape);
     space=barrierGapShape(tool,result,blockers);
     if(R.measureVolume(space)>1e-9){
      const check=new (R.getOC().BRepCheck_Analyzer)(space.wrapped,true,false);
      try{if(!check.IsValid())throw Error('invalid gap overlay');}finally{check.delete();}
      const mesh=measurePhase('display',()=>space.mesh({tolerance:.025,angularTolerance:.1}));rememberGap(entry.token,mesh);previewInfo.barrierClearance=[mesh];
     }
    }
   }catch(error){
    if(error instanceof WebAssembly.RuntimeError||/indirect call to null|null function|memory access out of bounds|unreachable|table index|function signature mismatch|aborted|RuntimeError/i.test(error?.message||''))throw error;
    previewInfo.barrierClearanceWarning='すき間の色表示を作成できませんでした。押し出し形状は確認できます。';
   }finally{space?.delete();}
  }
  const output=result;result=null;return output;
 }finally{result?.delete();}
}
