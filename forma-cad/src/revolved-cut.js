import * as R from 'replicad';
import {MODEL_PRECISION as P,volumeAllowance} from './model-precision.js';
import {solidMeshComplete} from './solid-mesh.js';

function planarBoundaries(shape){
 const faces=shape.faces;
 try{return faces.filter(face=>face.geomType==='PLANE').map(face=>{
  const center=face.center,normal=face.normalAt(),box=face.boundingBox;
  try{return {point:center.toTuple(),normal:normal.toTuple(),bounds:box.bounds.map(p=>[...p])};}
  finally{center.delete();normal.delete();box.delete();}
 });}finally{faces.forEach(face=>face.delete());}
}
function touchingPlanes(a,b){
 for(const x of a)for(const y of b){
  if(x.bounds[0].some((v,i)=>v>y.bounds[1][i]+P.contact||x.bounds[1][i]<y.bounds[0][i]-P.contact))continue;
  const dot=x.normal.reduce((n,v,i)=>n+v*y.normal[i],0);
  if(1-Math.abs(dot)>P.angular*P.angular/2)continue;
  const distance=Math.abs(x.normal.reduce((n,v,i)=>n+v*(y.point[i]-x.point[i]),0));
  if(distance<=P.contact)return true;
 }
 return false;
}

// Coplanar sweep caps can be displaced by sub-micron transform roundoff.
// An exact cut retains that discrepancy as a real wafer of material. Apply
// the shared contact policy only at overlapping, coincident planar bounds;
// do not grow/offset the cutter or change the user's sweep dimensions.
export function cutRevolvedSolid(base,tool,{onProgress}={}){
 const inputs=[base,tool].map(shape=>R.deserializeShape(shape.serialize()).asShape3D());
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Cut(),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();let result;
 try{
  const tolerance=touchingPlanes(planarBoundaries(inputs[0]),planarBoundaries(inputs[1]))?P.contact:0;
  onProgress?.({stage:tolerance?'回転切り取りの一致する境界面を処理しています':'回転範囲を切り取っています'});
  args.Append(inputs[0].wrapped);tools.Append(inputs[1].wrapped);
  builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);builder.Build();
  if(builder.HasErrors())throw Error('回転範囲を正常に切り取れませんでした。元のボディは変更していません');
  result=R.cast(builder.Shape()).asShape3D();
  const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false),parts=result.solids;
  try{
   const before=Math.abs(R.measureVolume(inputs[0])),after=R.measureVolume(result);
   if(!parts.length)throw Error('回転切り取りで対象ボディ全体がなくなります。対象と回転範囲を確認してください');
   if(!check.IsValid()||!Number.isFinite(after)||after<0||after>before+volumeAllowance(before)+tolerance*R.measureArea(inputs[0])||!solidMeshComplete(result))throw Error('回転切り取りの形状を正常に作成できませんでした。元のボディは変更していません');
  }finally{check.delete();parts.forEach(part=>part.delete());}
  const output=result;result=null;return output;
 }finally{result?.delete();builder.delete();args.delete();tools.delete();inputs.forEach(shape=>shape.delete());}
}
