import * as R from 'replicad';
export function cutClearanceDistance(value=0){if(!Number.isFinite(value)||value<0||value>1000)throw Error('切り取りのすき間は0〜1000 mmで指定してください');return value;}
function enlargedSolid(solid,distance){
 // Offsets may change shared native flags, so work on an independent copy.
 const source=R.deserializeShape(solid.serialize()).asShape3D(),oc=R.getOC(),builder=new oc.BRepOffsetAPI_MakeOffsetShape();let shape;
 try{builder.PerformByJoin(source.wrapped,distance,1e-6,oc.BRepOffset_Mode.BRepOffset_Skin,false,false,oc.GeomAbs_JoinType.GeomAbs_Arc,false);if(!builder.IsDone())throw Error('offset');const raw=builder.Shape();try{shape=R.cast(raw).asShape3D();}finally{raw.delete();}if(shape instanceof R.Shell){const closed=R.makeSolid([shape]);shape.delete();shape=closed;}const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{const volume=R.measureVolume(shape);if(!check.IsValid()||!Number.isFinite(volume)||volume<=R.measureVolume(source))throw Error('invalid offset');const missing=source.cut(shape);try{if(Math.abs(R.measureVolume(missing))>Math.max(1e-6,R.measureVolume(source)*1e-8))throw Error('incomplete offset');}finally{missing.delete();}}finally{check.delete();}const result=shape;shape=null;return result;
 }catch{throw Error('この形状には指定したすき間を作れません。すき間を小さくするか、切り抜くボディを単純な形状にしてください');}finally{shape?.delete();builder.delete();source.delete();}
}
export function cutWithClearance(base,tools,value=0){
 const distance=cutClearanceDistance(value);let result=base.clone();
 try{for(const tool of tools){const solids=distance>0?tool.solids:[tool];try{if(!solids.length)throw Error('切り抜くソリッドがありません');for(const solid of solids){let enlarged;try{const cutter=distance>0?(enlarged=enlargedSolid(solid,distance)):solid,next=result.cut(cutter);result.delete();result=next;}finally{enlarged?.delete();}}}finally{if(distance>0)solids.forEach(s=>s.delete());}}const output=result;result=null;return output;}finally{result?.delete();}
}
