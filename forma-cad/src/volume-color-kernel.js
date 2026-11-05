import * as R from 'replicad';
import {bodyAppearances} from './body-appearance.js';
import {currentBodyMeshRecords} from './mesh-quality.js';
import {DEFAULT_VOLUME_COLOR,volumeParts} from './volume-colors.js';
import {cadMesh} from './cad-mesh.js';
import {serializeCadShape} from './cad-serialization.js';
import {isColorChoice} from './color-choice.js';

export function volumeColorTransfer(features,bodies,onProgress){
 let records,styles;
 const style=id=>{
  styles??=bodyAppearances(features);
  const appearance=styles.get(id);
  return {color:appearance?.color??DEFAULT_VOLUME_COLOR,painted:!!appearance,...(appearance?.opacity!==undefined?{opacity:appearance.opacity}:{})};
 };
 const record=id=>(records??=currentBodyMeshRecords(features)).get(id);
 const parts=id=>volumeParts(record(id),id);
 const key=part=>part.color+'|'+(part.opacity??1);
 return function transfer(output,shape,ids,{transform,additionalTransform,copyColor=false,existingOnly=false}={}){
  ids=[...new Set(ids)].filter(id=>bodies.has(id));if(!ids.length)return;
  if(existingOnly&&!ids.some(id=>parts(id)))return;
  const originals=ids.flatMap(id=>parts(id)||[{...style(id),shape:bodies.get(id)}]);
  const candidates=additionalTransform?[...originals,...originals.map(part=>({...part,transform:additionalTransform}))]:[...originals];
  const painted=part=>part.painted??(part.color!==DEFAULT_VOLUME_COLOR||part.opacity!==undefined);
  // Explicitly colored material keeps its volume inside an uncolored body.
  // Between two colored regions, preserve the target before the tools.
  candidates.sort((a,b)=>Number(painted(b))-Number(painted(a)));
  const savedBase=parts(ids[0])&&record(ids[0]).output.materialBase;
  const base=isColorChoice(savedBase?.color)?savedBase:originals[0];
  const fallback={color:base.color,painted:!!painted(base),...(Number.isFinite(base.opacity)&&base.opacity>=.1&&base.opacity<1?{opacity:base.opacity}:{})};
  if(new Set(candidates.map(key)).size<2){if(copyColor&&(fallback.color!==DEFAULT_VOLUME_COLOR||fallback.opacity!==undefined))output.materialColor=fallback;return;}
  if(candidates.length>150)throw Error('色別の立体領域が多すぎるため結合できません');
  onProgress?.({stage:'色ごとの立体領域を計算しています'});
  const volume=s=>Math.abs(R.measureVolume(s)),whole=volume(shape),epsilon=Math.max(1e-8,whole*1e-10),regions=[];
  let remaining=shape.clone(),remainingVolume=whole;
  const save=(solid,part)=>{
   const check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false);
   try{if(!check.IsValid())throw Error('色別の立体が閉じていません');}finally{check.delete();}
   const {vertices,triangles,normals}=cadMesh(solid,{tolerance:.04,angularTolerance:.12});
   if(!triangles.length)throw Error('色別の立体を描画できません');
   regions.push({color:part.color,painted:painted(part),...(part.opacity!==undefined?{opacity:part.opacity}:{}),vertices,triangles,normals,brep:serializeCadShape(solid)});
  };
  try{
   let last=candidates.length-1;
   while(last>=0&&key(candidates[last])===key(fallback))last--;
   for(let i=0;i<=last&&remainingVolume>epsilon;i++){
    const part=candidates[i];let input=part.shape,owned=null,cell=null,next=null;
    try{
     if(!input)input=owned=R.deserializeShape(part.brep).asShape3D();
     const place=part.transform??transform;
     if(place){const placed=place(input);owned?.delete();input=owned=placed;}
     cell=remaining.intersect(input);const size=volume(cell);if(size<=epsilon)continue;
     if(remainingVolume-size<=epsilon){save(remaining,part);remainingVolume=0;break;}
     next=remaining.cut(cell);const rest=volume(next);
     if(Math.abs(remainingVolume-size-rest)>Math.max(1e-6,whole*1e-7))throw Error('色別の領域に隙間または重複ができました');
     save(cell,part);remaining.delete();remaining=next;next=null;remainingVolume=rest;
    }finally{owned?.delete();cell?.delete();next?.delete();}
   }
   if(remainingVolume>epsilon)save(remaining,fallback);
   if(new Set(regions.map(key)).size>1){output.materialParts=regions;output.materialBase=fallback;}
   else if(regions.length)output.materialColor={color:regions[0].color,...(regions[0].opacity!==undefined?{opacity:regions[0].opacity}:{})};
  }catch(error){throw Error('結合前の色を立体として保持できませんでした。'+(typeof error==='number'?'形状の接触を確認してください。':error.message));}
  finally{remaining.delete();}
 };
}
