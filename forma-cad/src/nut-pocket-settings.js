import {freeHexNutSettings} from './free-screw-settings.js';

function nutPocketDimensions(bodyId,diameter,pitch,leftHand,nut,screwId){
 const across=diameter+2*nut.wall,depth=nut.height;
 if(![diameter,pitch,across,depth].every(Number.isFinite)||diameter<=0||pitch<=0||across<=diameter||depth<=0)return null;
 return {bodyId,screwId,diameter,pitch,leftHand:!!leftHand,across,depth};
}

export function nutPocketSource(features,bodyId){
 if(!bodyId)return null;
 for(let i=features.length-1;i>=0;i--){
  const feature=features[i],spec=feature.spec,result=feature.cadResult??feature;
  if(result.remove?.includes(bodyId))return null;
  if(spec?.nut?.shape!=='hex'||!result.outputs?.some(output=>output.id===bodyId))continue;
  const nut=spec.nut;
  if(spec.type==='freeScrew'&&(nut.id??spec.id+'-nut')===bodyId)return nutPocketDimensions(bodyId,spec.diameter,spec.pitch,spec.leftHand,nut,spec.id);
  if(spec.type==='nutPocket'&&nut.id===bodyId)return nutPocketDimensions(bodyId,nut.diameter,nut.pitch,nut.leftHand,nut);
 }
 return null;
}

export function newPocketNut(spec){
 const nut=freeHexNutSettings(spec);
 return nutPocketDimensions(nut.id,nut.diameter,nut.pitch,nut.leftHand,nut);
}

export function validateNutPocket(spec){
 if(!spec.sourceBody||!spec.target||spec.sourceBody===spec.target)throw Error('六角ナットと加工先ボディを選択してください');
 if(spec.nut!==undefined&&(!spec.nut||freeHexNutSettings(spec.nut).id!==spec.sourceBody))throw Error('六角ナットの作成先が不正です');
 const vector3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 const plane=(point,normal)=>vector3(point)&&vector3(normal)&&Math.abs(Math.hypot(...normal)-1)<=1e-5;
 if(spec.placement!==undefined){
  const {point,normal,snap}=spec.placement??{};
  if(spec.opening!==undefined||!plane(point,normal)||!['center','grid'].includes(snap))throw Error('加工する平面の中心かグリッドの交点を選択してください');
  if(!Number.isFinite(spec.boreDiameter)||spec.boreDiameter<.1||spec.boreDiameter>10000){
   throw Error('ねじ用の貫通穴の直径を0.1〜10000 mmで指定してください');
  }
 }else{
  const rim=spec.opening;
  if(!plane(rim?.center,rim?.normal)||!Number.isFinite(rim.radius)||rim.radius<=0)throw Error('加工する円穴の開口を選択してください');
 }
 if(!Number.isFinite(spec.clearance)||spec.clearance<0)throw Error('片側のすき間を0 mm以上で指定してください');
 return spec;
}
