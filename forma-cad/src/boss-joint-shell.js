import * as R from 'replicad';
import * as THREE from 'three';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};

export function bossShellSettings(p){
 if(p.shellEnabled!==undefined&&typeof p.shellEnabled!=='boolean')throw Error('中空化の設定を確認してください');
 const enabled=p.shellEnabled??false,thickness=p.shellThickness??2;
 if(enabled&&(!Number.isFinite(thickness)||thickness<.1||thickness>1000))throw Error('シェルの壁厚を0.1〜1000 mmで指定してください');
 return {enabled,thickness};
}

// Hollow before creating joints, keeping the outer dimensions and opening at the mating plane.
export function shellBossPart(source,info,side,thickness,label){
 const faces=source.faces,normal=info.basis.n.clone().multiplyScalar(side),opening=[];let result;
 try{
  for(const face of faces)if(face.geomType==='PLANE'&&new THREE.Vector3(...tuple(face.normalAt())).dot(normal)>.999999&&Math.abs(new THREE.Vector3(...tuple(face.center)).dot(info.basis.n)-info.offset)<.02)opening.push(face);
  if(!opening.length)throw Error(label+'の分割面を開口にできません');
  let hasOpening=false;for(const face of opening){// innerWires consumes its face; inspect a clone so the opening remains usable.
   const wires=face.clone().innerWires();try{if(wires.length)hasOpening=true;}finally{wires.forEach(w=>w.delete());}}
  if(hasOpening)return {shape:source.clone(),status:'existing',removedVolume:0};
  const range=side>0?info.a:info.b,depth=range.max[2]-range.min[2],width=range.max[0]-range.min[0],height=range.max[1]-range.min[1];
  if(thickness>=depth-.01||2*thickness>=Math.min(width,height)-.01)throw Error(label+'を中空にする余裕がありません。シェルの壁厚を小さくしてください');
  const original=R.measureVolume(source);result=source.shell(thickness,f=>f.inList(opening));
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false),solids=result.solids;let volume;
  try{volume=R.measureVolume(result);if(!check.IsValid()||solids.length!==1||!Number.isFinite(volume)||volume<=1e-7||original-volume<=Math.max(1e-7,original*1e-8))throw Error('invalid shell');}finally{check.delete();solids.forEach(s=>s.delete());}
  const accepted=result;result=null;return {shape:accepted,status:'created',removedVolume:original-volume};
 }catch(error){if(error.message?.startsWith(label))throw error;throw Error(label+'のシェルを作成できません。壁厚を小さくするか、分割位置を変更してください');}
 finally{result?.delete();faces.forEach(f=>f.delete());}
}
