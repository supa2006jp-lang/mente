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
