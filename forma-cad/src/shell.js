import * as R from 'replicad';
import {selectedCadFaces} from './face-pull.js';
import {shellCoaxialCircularLoft} from './circular-loft.js';

export function shellBody(base,p,circularLoftInfo=null){
 if(!Number.isFinite(p.thickness)||p.thickness<.1||p.thickness>1000)throw Error('壁厚は0.1〜1000 mmで指定してください');
 if(!p.faces?.length)throw Error('開口にする面を選択してください');
 const faces=selectedCadFaces(base,p.faces),original=R.measureVolume(base);
 let shape,reason='この壁厚ではシェルを作成できません。壁厚を小さくするか、開口面を変更してください';
 try{shape=base.shell(p.direction==='外側'?-p.thickness:p.thickness,face=>face.inList(faces));}catch{}
 if(shape){
  let valid=false,volume=NaN;
  try{
   const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
   try{valid=check.IsValid();}finally{check.delete();}
   volume=R.measureVolume(shape);
  }catch{}
  if(valid&&Number.isFinite(volume)&&volume>1e-8&&(p.direction==='外側'||original-volume>Math.max(1e-7,original*1e-8)))return shape;
  reason=valid&&Number.isFinite(volume)&&volume>1e-8?'壁厚が大きすぎるため内側の空間を作れません。壁厚を小さくしてください':'有効なシェルを作成できません。壁厚と選択面を確認してください';
  shape.delete();
 }
 if(faces.length===1&&circularLoftInfo){
  try{
   const recovered=shellCoaxialCircularLoft(base,faces[0],circularLoftInfo,p.thickness,p.direction);
   if(recovered)return recovered;
  }catch{}
 }
 throw Error(reason);
}
