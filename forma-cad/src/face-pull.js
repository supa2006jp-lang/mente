import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolids} from './solid-fuse.js';

export function selectedCadFaces(base,selections){
 const faces=base.faces,chosen=new Set();
 try{
 for(const selection of selections){
  const point=R.makeVertex(selection.point),normal=selection.normal?new THREE.Vector3(...selection.normal):null;
  try{
  const matches=faces.map((face,index)=>{
   const d=R.measureDistanceBetween(point,face);
   let alignment=1;if(normal){let n;try{n=face.normalAt(selection.point);alignment=new THREE.Vector3(...n.toTuple()).normalize().dot(normal);}catch{}finally{n?.delete();}}
   return {index,d,alignment};
  }).filter(m=>m.alignment>.3).sort((a,b)=>a.d-b.d);
  if(!matches.length||matches[0].d>.2)throw Error('選択面を特定できません。面の中央寄りを選択し直してください');
  chosen.add(matches[0].index);
  }finally{point.delete();}
 }
 if(!chosen.size)throw Error('プルする面を選択してください');
 return [...chosen].map(i=>faces[i].clone());
 }finally{faces.forEach(face=>face.delete());}
}
export function pullFaces(base,selections,distance){
 if(!Number.isFinite(distance)||Math.abs(distance)<.001||Math.abs(distance)>1000)throw Error('プル距離は絶対値0.001〜1000 mmで指定してください');
 // Slabs on an inner periodic wall share its exact cylindrical boundary.
 // The ordinary fuse/simplify path can discard both valid solids. Use the
 // verified native batch fuse, preserving the selected wall's orientation.
 // Independent input topology also protects cached source triangulations.
 const source=R.deserializeShape(base.serialize()).asShape3D(),oc=R.getOC(),tools=[];let faces=[],result;
 try{
  faces=selectedCadFaces(source,selections);
  for(const face of faces){
   const builder=new oc.BRepOffsetAPI_MakeThickSolid();let tool;
   try{
    builder.MakeThickSolidBySimple(face.wrapped,distance);
    tool=R.cast(builder.Shape()).asShape3D();
    const volume=R.measureVolume(tool);if(!(Math.abs(volume)>1e-10))throw Error('empty');
    // Normalize the slab's solid orientation, not the offset direction.
    if(volume<0){const reversed=tool.wrapped.Reversed();try{const oriented=R.cast(reversed).asShape3D();tool.delete();tool=oriented;}finally{reversed.delete();}}
    tools.push(tool);tool=null;
   }catch(error){if(fatal(error))throw error;throw Error('この距離では曲面をオフセットできません。距離を小さくするか、面を分けて実行してください');}
   finally{tool?.delete();builder.delete();}
  }
  try{
   if(distance>0)result=fuseSolids([source,...tools],{verifyMesh:true});
   else{result=source.clone();for(const tool of tools){const next=result.cut(tool);result.delete();result=next;}}
  }catch(error){if(fatal(error))throw error;throw Error('プル後の面が交差しています。距離を小さくして実行してください');}
  const before=R.measureVolume(source),after=R.measureVolume(result);
  const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);let valid;try{valid=check.IsValid();}finally{check.delete();}if(!valid)throw Error('この曲面のプルで有効な形状を作れません。距離を小さくして実行してください');
  if(!Number.isFinite(after)||after<=0||(distance<0?before-after:after-before)<1e-7)throw Error('プルで形状を変更できませんでした。距離と選択面を確認してください');
  const output=result;result=null;return output;
 }finally{result?.delete();tools.forEach(tool=>tool.delete());faces.forEach(face=>face.delete());source.delete();}
}
const fatal=error=>error instanceof WebAssembly.RuntimeError||/memory access out of bounds|indirect call to null|null function|table index|function signature mismatch|unreachable|aborted|RuntimeError/i.test(error?.message||'');
