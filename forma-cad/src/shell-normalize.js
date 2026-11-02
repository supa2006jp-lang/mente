import * as R from 'replicad';
import {selectedCadFaces} from './face-pull.js';

function count(shape,key){const parts=shape[key];try{return parts.length;}finally{parts.forEach(p=>p.delete());}}
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}

// Offset algorithms can fail on coplanar caps left by successive unions.
// Normalize topology only, and reject a merge that would open an unselected cap.
export function normalizeShellOpenings(base,selections,originalFaces){
 const upgrader=new (R.getOC().ShapeUpgrade_UnifySameDomain)(base.wrapped,true,true,false);let shape,faces,accepted=false;
 try{
  upgrader.SetSafeInputMode(true);upgrader.Build();shape=R.cast(upgrader.Shape()).asShape3D();
  if(!valid(shape)||Math.abs(R.measureVolume(shape)-R.measureVolume(base))>Math.max(1e-6,Math.abs(R.measureVolume(base))*1e-8)||Math.abs(R.measureArea(shape)-R.measureArea(base))>Math.max(1e-6,R.measureArea(base)*1e-8))throw Error('同じ形状のまま面の継ぎ目を整理できませんでした');
  if(count(shape,'faces')>=count(base,'faces')&&count(shape,'edges')>=count(base,'edges'))throw Error('整理できる面の継ぎ目がありません');
  faces=selectedCadFaces(shape,selections);const before=originalFaces.reduce((area,face)=>area+R.measureArea(face),0),after=faces.reduce((area,face)=>area+R.measureArea(face),0);
  if(Math.abs(after-before)>Math.max(1e-7,before*1e-8)){const error=Error('同じ平面の一部だけが開口として選択されています。同じ平面の面をすべて選択して再実行してください');error.code='shell-partial-opening';throw error;}
  const a=base.boundingBox,b=shape.boundingBox;try{for(let i=0;i<2;i++)for(let j=0;j<3;j++)if(Math.abs(a.bounds[i][j]-b.bounds[i][j])>1e-5)throw Error('外形を保ったまま面の継ぎ目を整理できませんでした');}finally{a.delete();b.delete();}
  accepted=true;return {shape,faces};
 }finally{upgrader.delete();if(!accepted){faces?.forEach(face=>face.delete());shape?.delete();}}
}
