import * as R from 'replicad';
import {MODEL_PRECISION} from './model-precision.js';
import {solidMeshComplete} from './solid-mesh.js';

function volume(shape){
 const oc=R.getOC(),properties=new oc.GProp_GProps();
 try{oc.BRepGProp.VolumeProperties(shape.wrapped,properties,1e-10,true,false);return properties.Mass();}
 finally{properties.delete();}
}
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
function count(shape){const solids=shape.solids;try{return solids.length;}finally{solids.forEach(s=>s.delete());}}
const allowance=v=>Math.max(MODEL_PRECISION.minVolume,Math.abs(v)*MODEL_PRECISION.relativeVolume);

function continuousPart(part){
 const expected=volume(part),parts=count(part),snapshot=part.serialize();
 if(!valid(part)||!(expected>0)||!parts||!solidMeshComplete(part))throw Error('分離した形状を正常なソリッドにできませんでした。元のボディは変更していません');
 // Unifying edge chains can break periodic seams on joined revolved surfaces.
 // Inspect each independent attempt before replacing the exact split result.
 for(const edges of [true,false]){
  const input=R.deserializeShape(snapshot).asShape3D(),upgrader=new (R.getOC().ShapeUpgrade_UnifySameDomain)(input.wrapped,edges,true,false);let result;
  try{
   upgrader.SetSafeInputMode(true);upgrader.SetLinearTolerance(MODEL_PRECISION.topology);upgrader.SetAngularTolerance(1e-7);upgrader.Build();result=R.cast(upgrader.Shape()).asShape3D();
   if(valid(result)&&count(result)===parts&&Math.abs(volume(result)-expected)<=allowance(expected)&&solidMeshComplete(result)){const output=result;result=null;return output;}
  }catch{}finally{result?.delete();upgrader.delete();input.delete();}
 }
 return part.clone();
}

export function splitSolidSections(base,plane,offset=0){
 // Replicad's splitter uses a destructive OCCT builder. A shallow clone still
 // shares native topology, so isolate it from the document and history cache.
 const input=R.deserializeShape(base.serialize()).asShape3D(),expected=volume(input);let raw,positive,negative;
 try{
  raw=input.split(plane,offset,MODEL_PRECISION.topology);
  if(!raw.positive||!raw.negative||raw.on)throw Error('指定平面がボディを横切っていません');
  if(Math.abs(volume(raw.positive)+volume(raw.negative)-expected)>allowance(expected))throw Error('断面分離で体積を維持できませんでした。元のボディは変更していません');
  positive=continuousPart(raw.positive);negative=continuousPart(raw.negative);
  const result={positive,negative};positive=null;negative=null;return result;
 }finally{positive?.delete();negative?.delete();raw?.positive?.delete();raw?.negative?.delete();raw?.on?.delete();input.delete();}
}
