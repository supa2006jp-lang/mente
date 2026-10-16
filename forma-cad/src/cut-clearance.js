import * as R from 'replicad';
// Keep encoded, validated offsets rather than shallow native clones: booleans
// may update shared face caches. Each hit reconstructs an independent tool.
const offsetCache=new Map(),offsetLimit=16*1024*1024;let offsetBytes=0;
export const clearanceCacheStats={hits:0,misses:0,builds:0};
export function clearClearanceCache(){offsetCache.clear();offsetBytes=0;clearanceCacheStats.hits=clearanceCacheStats.misses=clearanceCacheStats.builds=0;}
function clearanceOffset(solid,distance,sourceKey,index){
 const key=JSON.stringify([distance,sourceKey??solid.serialize(),index]);
 const cached=offsetCache.get(key);
 if(cached){
  clearanceCacheStats.hits++;offsetCache.delete(key);offsetCache.set(key,cached);
  return R.deserializeShape(cached.brep).asShape3D();
 }
 clearanceCacheStats.misses++;let shape;
 try{
  shape=enlargeForClearance(solid,distance);clearanceCacheStats.builds++;
  const brep=shape.serialize(),bytes=(key.length+brep.length)*2;
  if(bytes<=offsetLimit){offsetCache.set(key,{brep,bytes});offsetBytes+=bytes;while(offsetCache.size>16||offsetBytes>offsetLimit){const oldest=offsetCache.keys().next().value;offsetBytes-=offsetCache.get(oldest).bytes;offsetCache.delete(oldest);}}
  const result=shape;shape=null;return result;
 }finally{shape?.delete();}
}
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
export function cutWithClearance(base,tools,value=0,{fallback,cacheKeys=[]}={}){
 const distance=cutClearanceDistance(value);let result=base.clone();
 try{for(const [toolIndex,tool] of tools.entries()){const solids=distance>0?tool.solids:[tool];try{if(!solids.length)throw Error('切り抜くソリッドがありません');for(const [solidIndex,solid] of solids.entries()){let enlarged;try{if(distance>0){try{enlarged=clearanceOffset(solid,distance,cacheKeys[toolIndex],solidIndex);}catch(error){if(fatal(error))throw error;enlarged=solids.length===1?fallback?.(solid,distance,tool):null;if(!enlarged)throw error;}}const next=clearanceCut(result,enlarged||solid);result.delete();result=next;}finally{enlarged?.delete();}}}finally{if(distance>0)solids.forEach(s=>s.delete());}}const output=result;result=null;return output;}finally{result?.delete();}
}
