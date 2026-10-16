import * as R from 'replicad';
import {measurePhase} from './phase-timings.js';
import {solidMeshComplete} from './solid-mesh.js';

// Offset/cut results can wrap one oriented solid in a compound. OCCT's fuse
// classifies that wrapper differently and can omit the entire input body.
// Use its actual solid while retaining the source and its shared native data.
function singleSolidInput(shape){
 if(shape instanceof R.Solid)return shape;
 const solids=shape.solids;
 try{return solids.length===1?solids[0].clone():shape;}
 finally{solids.forEach(solid=>solid.delete());}
}

// Build one boolean operation for all inputs. Repeated pairwise fuses re-split
// an ever larger result and retain native intermediate shapes until deleted.
export function fuseSolids(shapes,{onProgress}={}){
 const inputs=[];try{for(const shape of shapes)inputs.push(singleSolidInput(shape));return fuseBatch(inputs,{onProgress});}
 finally{inputs.forEach((shape,i)=>{if(shape!==shapes[i])shape.delete();});}
}
function fuseBatch(shapes,{onProgress}={}){
 if(!shapes.length)throw Error('結合するボディを選択してください');
 if(shapes.length===1)return shapes[0].clone();
 const oc=R.getOC(),volumes=shapes.map(shape=>Math.abs(R.measureVolume(shape))),sum=volumes.reduce((a,b)=>a+b,0),largest=Math.max(...volumes),eps=Math.max(1e-6,sum*1e-8);
 for(const tolerance of [0,1e-6]){
  const builder=new oc.BRepAlgoAPI_Fuse(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),toolsList=new oc.NCollection_List_TopoDS_Shape();let result=null;
  try{
   argumentsList.Append(shapes[0].wrapped);for(const shape of shapes.slice(1))toolsList.Append(shape.wrapped);
   builder.SetArguments(argumentsList);builder.SetTools(toolsList);builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);
   onProgress?.({stage:shapes.length+'個のボディをまとめて結合しています'+(tolerance?'（境界を再確認）':'')});
   builder.Build();if(builder.HasErrors())continue;result=R.cast(builder.Shape()).asShape3D();
   onProgress?.({stage:'結合したソリッドを検査しています'});
   const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);let valid;
   try{const volume=R.measureVolume(result);valid=check.IsValid()&&Number.isFinite(volume)&&volume>=largest-eps&&volume<=sum+eps;}finally{check.delete();}
   if(valid){const output=result;result=null;return output;}
  }catch{}finally{result?.delete();builder.delete();argumentsList.delete();toolsList.delete();}
 }
 throw Error('正常なソリッドとして結合できませんでした。元のボディは変更していません');
}
// Keep boolean faces separate when simplifying their shared boundary loses a face.
export function fuseSolid(base,tool,options={}){return measurePhase('geometry',()=>{
 const left=singleSolidInput(base);let right;
 try{right=singleSolidInput(tool);return fusePair(left,right,options);}
 finally{if(left!==base)left.delete();if(right&&right!==tool)right.delete();}
});}
function fusePair(base,tool,{verifyMesh=false}={}){
 const oc=R.getOC(),a=Math.abs(R.measureVolume(base)),b=Math.abs(R.measureVolume(tool)),eps=Math.max(1e-6,(a+b)*1e-8);
 const acceptable=shape=>{
  const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);
  try{const volume=R.measureVolume(shape);return check.IsValid()&&Number.isFinite(volume)&&volume>=Math.max(a,b)-eps&&volume<=a+b+eps&&(!verifyMesh||solidMeshComplete(shape));}finally{check.delete();}
 };
 let result;
 if(!verifyMesh){try{result=base.fuse(tool);if(acceptable(result))return result;}catch{}result?.delete();}
 // Grid profiles are rounded from display coordinates. Start the non-destructive
 // operation before building, and retry sub-millimetre boundary discrepancies.
 // Independent inputs also keep failed attempts out of the body/history cache.
 const snapshots=verifyMesh?[base.serialize(),tool.serialize()]:null;
 for(const tolerance of (verifyMesh?[0,1e-6,1e-5,1e-4,.001]:[0,1e-6])){
  const left=snapshots?R.deserializeShape(snapshots[0]).asShape3D():base,right=snapshots?R.deserializeShape(snapshots[1]).asShape3D():tool;
  const builder=new oc.BRepAlgoAPI_Fuse(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),toolsList=new oc.NCollection_List_TopoDS_Shape();result=null;
  try{
   argumentsList.Append(left.wrapped);toolsList.Append(right.wrapped);builder.SetArguments(argumentsList);builder.SetTools(toolsList);
   builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);builder.Build();
   result=R.cast(builder.Shape()).asShape3D();if(acceptable(result))return result;
  }catch{}finally{builder.delete();argumentsList.delete();toolsList.delete();if(snapshots){left.delete();right.delete();}}
  result?.delete();
 }
 throw Error('正常なソリッドとして結合できませんでした。元のボディは変更していません');
}
