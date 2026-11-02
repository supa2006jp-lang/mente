import * as R from 'replicad';
import {MODEL_PRECISION} from './model-precision.js';
import {solidMeshComplete} from './solid-mesh.js';

function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
function count(shape,key){const parts=shape[key];try{return parts.length;}finally{parts.forEach(part=>part.delete());}}
function metrics(shape){const box=shape.boundingBox;try{return {volume:R.measureVolume(shape),area:R.measureArea(shape),bounds:box.bounds.map(p=>[...p]),solids:count(shape,'solids'),faces:count(shape,'faces'),edges:count(shape,'edges')};}finally{box.delete();}}
// Keep an absolute ceiling as well as a relative limit. Large curved bodies
// can pass a relative-only check despite a changed integration result.
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(MODEL_PRECISION.minVolume,Math.min(1e-6,Math.abs(b)*MODEL_PRECISION.relativeVolume));
function preserved(before,after){return after.solids===before.solids&&close(after.volume,before.volume)&&close(after.area,before.area)&&before.bounds.every((p,i)=>p.every((v,j)=>Math.abs(v-after.bounds[i][j])<=MODEL_PRECISION.topology*10));}

// Return an owned, independent result. A shallow clone shares native face and
// triangulation caches with the inputs; even mesh verification must be isolated.
// Never heal gaps, delete small parts or change modelling/contact tolerances.
export function finalizeUnion(shape,{onProgress}={}){
 const before=metrics(shape);
 if(!valid(shape)||!Number.isFinite(before.volume)||before.volume<=MODEL_PRECISION.minVolume||!before.solids)throw Error('結合結果に形状の不整合があります。元のボディは変更していません');
 const snapshot=shape.serialize();
 onProgress?.({stage:'結合面の継ぎ目を整理・検査しています'});
 for(const edges of [true,false]){
  const input=R.deserializeShape(snapshot).asShape3D(),upgrader=new (R.getOC().ShapeUpgrade_UnifySameDomain)(input.wrapped,edges,true,false);let result;
  try{
   upgrader.SetSafeInputMode(true);upgrader.SetLinearTolerance(MODEL_PRECISION.topology);upgrader.SetAngularTolerance(MODEL_PRECISION.angular);upgrader.Build();result=R.cast(upgrader.Shape()).asShape3D();
   if(!valid(result))continue;
   const after=metrics(result);
   if((after.faces>=before.faces&&after.edges>=before.edges)||!preserved(before,after)||!solidMeshComplete(result))continue;
   onProgress?.({stage:'結合結果の検査が完了しました',unionResult:{normalized:true,edges,before,after}});
   const output=result;result=null;return output;
  }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
  finally{result?.delete();upgrader.delete();input.delete();}
 }
 // Periodic seams can become invalid when unified. Retain the exact union only
 // after checking its independent CAD and mesh rather than forcing simplification.
 const original=R.deserializeShape(snapshot).asShape3D();let accepted=false;
 try{
  if(!valid(original)||!solidMeshComplete(original))throw Error('結合した面の接続を確認できませんでした。元のボディは変更していません');
  onProgress?.({stage:'結合結果の検査が完了しました',unionResult:{normalized:false,before,after:before}});
  accepted=true;return original;
 }finally{if(!accepted)original.delete();}
}
