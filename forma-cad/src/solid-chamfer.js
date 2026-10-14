import * as R from 'replicad';
import {resolveFilletEdges} from './solid-fillet.js';

function failure(message,code){const error=new Error(message);error.code=code;return error;}
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
function resolve(shape,selection){
 try{return resolveFilletEdges(shape,selection);}
 catch(error){throw failure(error.message.replaceAll('丸める','面取りする').replaceAll('丸めたい','面取りしたい').replaceAll('丸められる','面取りできる'),error.code?.replace('fillet','chamfer')||'chamfer-selection');}
}
function build(shape,distance,selection){
 const edges=resolve(shape,selection);let result;
 try{
  // A numeric distance applies equal setbacks to the two adjacent faces.
  // Match native topology so display tessellation cannot change the selection.
  result=shape.chamfer(distance,finder=>finder.when(({element})=>edges.some(edge=>edge.isSame(element))));
  if(!valid(result))throw Error('invalid chamfer');
  const output=result;result=null;return {shape:output,edgeCount:edges.length};
 }catch{throw failure('選択した辺の隣接面・肉厚の条件で面取りできません。面取り幅を小さくするか、辺を1本ずつ選んで確認してください','chamfer-geometry');}
 finally{result?.delete();edges.forEach(edge=>edge.delete());}
}
export function chamferSolid(base,distance,selection={},onProgress){
 if(!Number.isFinite(distance)||distance<=0)throw failure('面取り幅は0より大きくしてください','chamfer-distance');
 if(!valid(base))throw failure('元のソリッドに形状の不整合があるため面取りできません。結合・切り取り前の形状を確認してください','chamfer-input');
 let originalError;
 try{return {...build(base,distance,selection),normalized:false,distance};}
 catch(error){if(error.code!=='chamfer-geometry')throw error;originalError=error;}
 onProgress?.({stage:'面の継ぎ目を整理して、同じ面取り幅で再計算しています'});
 const upgrader=new (R.getOC().ShapeUpgrade_UnifySameDomain)(base.wrapped,true,true,false);let normalized;
 try{
  upgrader.SetSafeInputMode(true);upgrader.Build();normalized=R.cast(upgrader.Shape()).asShape3D();
  const before=R.measureVolume(base),after=R.measureVolume(normalized);
  if(!valid(normalized)||Math.abs(after-before)>Math.max(1e-6,Math.abs(before)*1e-8))throw originalError;
  return {...build(normalized,distance,selection),normalized:true,distance};
 }catch{throw originalError;}
 finally{normalized?.delete();upgrader.delete();}
}
