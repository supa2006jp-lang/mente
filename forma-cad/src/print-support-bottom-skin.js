import * as R from 'replicad';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const overlap=(a,b)=>{const shape=a.intersect(b);try{return Math.abs(R.measureVolume(shape));}finally{shape.delete();}};
// Resolve landings after removing the model: bed Z alone would put this skin
// inside the lower plate for a support starting on another part of the model.
export function makeSupportBottomSkins(records,prism,bodies,p,onProgress){
 const skins=[],heights=[],thickness=p.bottomSkinLayers*p.layerHeight;if(!records.length)return {shapes:skins,heights,thickness};let free=prism.clone(),faces=[];
 try{
  if(p.baseMode!=='bed')for(const body of bodies.values()){const next=free.cut(body);free.delete();free=next;}
  faces=free.faces;
  for(const face of faces){if(face.geomType!=='PLANE')continue;const n=tuple(face.normalAt());if(n[2]>-.999999)continue;const z=tuple(face.center)[2];let raw,skin,profile,vector;
   try{
    onProgress?.({stage:'実際の底面に薄皮を作成しています'});profile=face.clone();vector=new R.Vector([0,0,thickness]);raw=R.basicFaceExtrusion(profile,vector);skin=raw.intersect(free);const volume=Math.abs(R.measureVolume(raw)),actual=Math.abs(R.measureVolume(skin));if(actual<.001)continue;
    const parts=skin.solids;let attached;try{attached=parts.every(part=>records.some(r=>overlap(part,r.shape)>.0001));}finally{parts.forEach(part=>part.delete());}if(!attached)continue;
    if(Math.abs(actual-volume)>Math.max(.0001,volume*1e-6))throw Error('底面の薄皮を置く高さが足りないか、モデルと干渉します。層数を減らすか底面の薄皮をオフにしてください');
    for(const body of bodies.values())if(overlap(skin,body)>.0001)throw Error('底面の薄皮がモデルに入り込むため作成を中止しました');skins.push(skin);skin=null;heights.push(Number(z.toFixed(6)));
   }finally{skin?.delete();raw?.delete();profile?.delete();vector?.delete();}
  }
  if(!skins.length)throw Error('底面の薄皮を置ける水平な土台がありません。土台とサポートの高さを確認してください');
  return {shapes:skins,heights,thickness};
 }catch(error){skins.forEach(s=>s.delete());throw error;}finally{faces.forEach(f=>f.delete());free.delete();}
}
