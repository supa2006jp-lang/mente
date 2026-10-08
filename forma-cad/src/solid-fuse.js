import * as R from 'replicad';
import {solidMeshComplete} from './solid-mesh.js';
// Keep boolean faces separate when simplifying their shared boundary loses a face.
export function fuseSolid(base,tool,{verifyMesh=false}={}){
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
