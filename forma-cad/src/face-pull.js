import * as R from 'replicad';
import * as THREE from 'three';

export function selectedCadFaces(base,selections){
 const faces=base.faces,chosen=new Set();
 for(const selection of selections){
  const point=R.makeVertex(selection.point),normal=selection.normal?new THREE.Vector3(...selection.normal):null;
  const matches=faces.map((face,index)=>{
   const d=R.measureDistanceBetween(point,face);
   let alignment=1;try{if(normal)alignment=new THREE.Vector3(...face.normalAt(selection.point).toTuple()).normalize().dot(normal);}catch{}
   return {index,d,alignment};
  }).filter(m=>m.alignment>.3).sort((a,b)=>a.d-b.d);
  point.delete();
  if(!matches.length||matches[0].d>.2)throw Error('選択面を特定できません。面の中央寄りを選択し直してください');
  chosen.add(matches[0].index);
 }
 if(!chosen.size)throw Error('プルする面を選択してください');
 return [...chosen].map(i=>faces[i]);
}
export function pullFaces(base,selections,distance){
 if(!Number.isFinite(distance)||Math.abs(distance)<.001||Math.abs(distance)>1000)throw Error('プル距離は絶対値0.001〜1000 mmで指定してください');
 const faces=selectedCadFaces(base,selections),oc=R.getOC(),tools=[];
 for(const face of faces){
  const builder=new oc.BRepOffsetAPI_MakeThickSolid();
  try{
   builder.MakeThickSolidBySimple(face.wrapped,distance);
   const tool=R.cast(builder.Shape()).asShape3D();
   if(!(Math.abs(R.measureVolume(tool))>1e-10))throw Error('empty');
   tools.push(tool);
  }catch{throw Error('この距離では曲面をオフセットできません。距離を小さくするか、面を分けて実行してください');}
  finally{builder.delete();}
 }
 let result=base;
 try{for(const tool of tools)result=distance<0?result.cut(tool):result.fuse(tool);}
 catch{throw Error('プル後の面が交差しています。距離を小さくして実行してください');}
 const before=R.measureVolume(base),after=R.measureVolume(result);
 const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);const valid=check.IsValid();check.delete();if(!valid)throw Error('この曲面のプルで有効な形状を作れません。距離を小さくして実行してください');
 if(!Number.isFinite(after)||after<=0||(distance<0?before-after:after-before)<1e-7)throw Error('プルで形状を変更できませんでした。距離と選択面を確認してください');
 return result;
}
