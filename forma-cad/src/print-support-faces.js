import * as R from 'replicad';
import {selectedConnectedPlanarFace} from './cad-planar-face.js';
import {cadMesh} from './cad-mesh.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
export function validateSupportFaces(faces,target,{allowEmpty=false}={}){
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000);
 if(!Array.isArray(faces)||faces.length>32||!allowEmpty&&!faces.length||faces.some(f=>!f||f.bodyId!==target||!vector(f.point)||f.normal!=null&&(!vector(f.normal)||Math.hypot(...f.normal)<1e-8)))throw Error('同じ対象ボディの下面を1〜32面選択してください');
 return faces.map(f=>({bodyId:f.bodyId,point:[...f.point],...(f.normal!=null?{normal:[...f.normal]}:{})}));
}
// Resolve the same connected native planar patch used by generation. Points on
// a separate coplanar island remain separate; matching the plane alone is unsafe.
export function resolveSupportFaces(model,p,{allowEmpty=false,toggle=null}={}){
 const refs=validateSupportFaces(p.faces,p.target,{allowEmpty}),faces=[],selections=[];
 const same=(ref,face)=>{if(!ref.normal)return false;const n=tuple(face.normalAt()),length=Math.hypot(...ref.normal);if(n.reduce((sum,v,i)=>sum+v*ref.normal[i]/length,0)<.999999)return false;const vertex=R.makeVertex(ref.point);try{return R.measureDistanceBetween(vertex,face)<1e-5;}finally{vertex.delete();}};
 function add(ref){if(faces.some(f=>same(ref,f)))return;const face=selectedConnectedPlanarFace(model,ref);let keep=false;try{const normal=tuple(face.normalAt());if(normal[2]>-.5)throw Error('下向きの平面を選択してください');if(p.style==='walls'&&normal[2]>-.999999)throw Error('薄壁型は水平な平面の下面を選択してください');const center=tuple(face.center);if(p.style==='walls'&&center[2]<=p.bedZ+p.topGap+1)throw Error('選んだ下面はサポートを置く高さが足りません。面を外すかベッド高さを変更してください');if(faces.some(f=>same({...ref,normal},f)))return;if(faces.length>=32)throw Error('一度に選択できる下面は32面までです');faces.push(face);selections.push({...ref,normal});keep=true;}finally{if(!keep)face.delete();}}
 try{
  for(const ref of refs)add(ref);
  if(toggle){const ref=validateSupportFaces([toggle],p.target)[0],index=faces.findIndex(f=>same(ref,f));if(index>=0){faces[index].delete();faces.splice(index,1);selections.splice(index,1);}else add(ref);}
  return {faces,selections};
 }catch(error){faces.forEach(f=>f.delete());throw error;}
}
export function supportSelectedFaceMeshes(resolved){return resolved.faces.map((face,i)=>({selection:resolved.selections[i],area:R.measureArea(face),...cadMesh(face)}));}

export function validateSupportFaceOverrides(overrides,target,wallThickness){
 if(!Array.isArray(overrides)||overrides.length>32)throw Error('下面の個別設定は32面までです');
 const faces=validateSupportFaces(overrides.map(row=>row?.selection),target,{allowEmpty:true});
 return overrides.map((row,i)=>{
  const {wallPitch,roofLayers,bottomSkinLayers,noSupport,edgeAssist}=row;
  if(wallPitch!=null&&(!Number.isFinite(wallPitch)||wallPitch<2||wallPitch>15||wallPitch<=wallThickness))
   throw Error('下面の薄壁間隔は2〜15 mmで、薄壁の厚みより大きくしてください');
  for(const layers of [roofLayers,bottomSkinLayers])if(layers!=null&&(!Number.isInteger(layers)||layers<1||layers>6))
   throw Error('下面の薄皮は1〜6層で指定してください');
  if(noSupport!==undefined&&(!Array.isArray(noSupport)||noSupport.length>8||noSupport.some(zone=>
   !Array.isArray(zone)||zone.length!==4||zone.some(value=>!Number.isFinite(value)||Math.abs(value)>100000)||
   zone[2]-zone[0]<.1||zone[3]-zone[1]<.1)))throw Error('除外範囲は縦横0.1 mm以上で、1面につき8箇所まで指定できます');
  if(edgeAssist!==undefined&&typeof edgeAssist!=='boolean')throw Error('端を支える配置の設定が不正です');
  if([wallPitch,roofLayers,bottomSkinLayers].every(v=>v==null)&&!noSupport?.length&&!edgeAssist)throw Error('下面の個別設定が空です');
  return {selection:faces[i],...(wallPitch!=null?{wallPitch}:{}),...(roofLayers!=null?{roofLayers}:{}),
   ...(bottomSkinLayers!=null?{bottomSkinLayers}:{}),...(noSupport?.length?{noSupport:noSupport.map(zone=>[...zone])}:{}),...(edgeAssist?{edgeAssist}: {})};
 });
}

export function supportFaceContainsPoint(face,coords){
 const point=R.makeVertex(coords);
 try{return R.measureDistanceBetween(point,face)<1e-5;}finally{point.delete();}
}

export function matchSupportFaceOverride(face,overrides,height){
 const matches=overrides.filter(row=>Math.abs(row.selection.point[2]-height)<=1e-5&&supportFaceContainsPoint(face,row.selection.point));
 if(matches.length>1)throw Error('同じ下面に複数の個別設定があります');
 return matches[0];
}
