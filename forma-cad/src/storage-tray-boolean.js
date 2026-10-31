import * as R from 'replicad';
import {fuseSolid,fuseSolids} from './solid-fuse.js';

function batch(base,tools,type){
 const oc=R.getOC(),builder=new oc[type](),args=new oc.NCollection_List_TopoDS_Shape(),list=new oc.NCollection_List_TopoDS_Shape();let result;
 try{
  args.Append(base.wrapped);for(const tool of tools)list.Append(tool.wrapped);
  builder.SetArguments(args);builder.SetTools(list);builder.SetNonDestructive(true);builder.SetToFillHistory(false);builder.SetUseOBB(true);builder.SetFuzzyValue(0);
  // The embossed tools start exactly on the flat top. Their lower faces are
  // contained in that face, so this is a coplanar join, not an intersecting cut.
  if(type==='BRepAlgoAPI_Fuse'){builder.SetGlue(oc.BOPAlgo_GlueEnum.BOPAlgo_GlueShift);builder.SetCheckInverted(false);}
  builder.Build();
  if(!builder.IsDone()||builder.HasErrors())throw Error('トレーの加工を完了できませんでした');
  result=R.cast(builder.Shape()).asShape3D();const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);try{if(!check.IsValid())throw Error('トレーの加工結果を検査できませんでした');}finally{check.delete();}
  const ready=result;result=null;return ready;
 }finally{result?.delete();builder.delete();args.delete();list.delete();}
}
// Set separate tools on a single Cut. Putting overlapping tools in a Compound
// is ambiguous; fusing all disconnected pockets first repeats unnecessary work.
export function cutStorageTray(base,tools){
 try{return batch(base,tools,'BRepAlgoAPI_Cut');}
 catch{const united=fuseSolids(tools);try{return base.cut(united);}finally{united.delete();}}
}
export function fuseStorageTrayLabels(base,tool){
 let result;
 try{
  result=batch(base,[tool],'BRepAlgoAPI_Fuse');const before=R.measureVolume(base),added=R.measureVolume(tool),volume=R.measureVolume(result),tolerance=Math.max(1e-6,(before+added)*1e-8),parts=result.solids;
  try{if(parts.length!==1||!Number.isFinite(volume)||Math.abs(volume-before-added)>tolerance)throw Error('文字の結合を検査できませんでした');}finally{parts.forEach(p=>p.delete());}
  const ready=result;result=null;return ready;
 }catch{return fuseSolid(base,tool);}
 finally{result?.delete();}
}
