import * as R from 'replicad';
export function cutClearanceDistance(value=0){if(!Number.isFinite(value)||value<0||value>1000)throw Error('切り取りのすき間は0〜1000 mmで指定してください');return value;}
export function enlargeForClearance(solid,distance){
 // Offsets may change shared native flags, so work on an independent copy.
 const source=R.deserializeShape(solid.serialize()).asShape3D(),oc=R.getOC(),builder=new oc.BRepOffsetAPI_MakeOffsetShape();let shape;
 try{builder.PerformByJoin(source.wrapped,distance,1e-6,oc.BRepOffset_Mode.BRepOffset_Skin,false,false,oc.GeomAbs_JoinType.GeomAbs_Arc,false);if(!builder.IsDone())throw Error('offset');const raw=builder.Shape();try{shape=R.cast(raw).asShape3D();}finally{raw.delete();}if(shape instanceof R.Shell){const closed=R.makeSolid([shape]);shape.delete();shape=closed;}const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{const volume=R.measureVolume(shape);if(!check.IsValid()||!Number.isFinite(volume)||volume<=R.measureVolume(source))throw Error('invalid offset');const missing=source.cut(shape);try{if(Math.abs(R.measureVolume(missing))>Math.max(1e-6,R.measureVolume(source)*1e-8))throw Error('incomplete offset');}finally{missing.delete();}}finally{check.delete();}const result=shape;shape=null;return result;
 }catch(error){if(fatal(error))throw error;throw Error('この形状には指定したすき間を作れません。すき間を小さくするか、切り抜くボディを単純な形状にしてください');}finally{shape?.delete();builder.delete();source.delete();}
}
const fatal=error=>error instanceof WebAssembly.RuntimeError||/memory access out of bounds|indirect call to null|null function|table index|function signature mismatch|unreachable|aborted|RuntimeError/i.test(error?.message||'');
function clearanceCut(base,tool){
 const oc=R.getOC();let result;
 const valid=shape=>{const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{return check.IsValid()&&Number.isFinite(R.measureVolume(shape));}finally{check.delete();}};
 try{result=base.cut(tool);if(valid(result)){const output=result;result=null;return output;}}catch(error){if(fatal(error))throw error;}finally{result?.delete();}
 // Simplifying a cut can merge periodic thread faces incorrectly. Retain
 // their native boundaries if the ordinary cut is not a valid solid.
 for(const tolerance of [0,1e-6,1e-5]){
  const builder=new oc.BRepAlgoAPI_Cut(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),toolsList=new oc.NCollection_List_TopoDS_Shape();result=null;
  try{argumentsList.Append(base.wrapped);toolsList.Append(tool.wrapped);builder.SetArguments(argumentsList);builder.SetTools(toolsList);builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);builder.Build();if(builder.HasErrors())continue;result=R.cast(builder.Shape()).asShape3D();if(valid(result)){const output=result;result=null;return output;}}
  catch(error){if(fatal(error))throw error;}
  finally{result?.delete();builder.delete();argumentsList.delete();toolsList.delete();}
 }
 throw Error('すき間で切り抜いた形状を正常に作れませんでした。元のボディは変更していません');
}
export function cutWithClearance(base,tools,value=0,{fallback}={}){
 const distance=cutClearanceDistance(value);let result=base.clone();
 try{for(const tool of tools){const solids=distance>0?tool.solids:[tool];try{if(!solids.length)throw Error('切り抜くソリッドがありません');for(const solid of solids){let enlarged;try{if(distance>0){try{enlarged=enlargeForClearance(solid,distance);}catch(error){if(fatal(error))throw error;enlarged=solids.length===1?fallback?.(solid,distance,tool):null;if(!enlarged)throw error;}}const next=clearanceCut(result,enlarged||solid);result.delete();result=next;}finally{enlarged?.delete();}}}finally{if(distance>0)solids.forEach(s=>s.delete());}}const output=result;result=null;return output;}finally{result?.delete();}
}
