export function nutPocketSource(features,bodyId){
 if(!bodyId)return null;
 for(let i=features.length-1;i>=0;i--){
  const feature=features[i],spec=feature.spec,result=feature.cadResult??feature;
  if(result.remove?.includes(bodyId))return null;
  if(spec?.type!=='freeScrew'||spec.nut?.shape!=='hex'||(spec.nut.id??spec.id+'-nut')!==bodyId||
   !result.outputs?.some(output=>output.id===bodyId))continue;
  const across=spec.diameter+2*spec.nut.wall,depth=spec.nut.height;
  if(Number.isFinite(across)&&across>0&&Number.isFinite(depth)&&depth>0)return {bodyId,screwId:spec.id,across,depth};
 }
 return null;
}

export function validateNutPocket(spec){
 const rim=spec.opening;
 if(!spec.sourceBody||!spec.target||spec.sourceBody===spec.target)throw Error('六角ナットと加工先ボディを選択してください');
 if(![rim?.center,rim?.normal].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||
  !Number.isFinite(rim.radius)||rim.radius<=0||Math.abs(Math.hypot(...rim.normal)-1)>1e-5){
  throw Error('加工する円穴の開口を選択してください');
 }
 if(!Number.isFinite(spec.clearance)||spec.clearance<0)throw Error('片側のすき間を0 mm以上で指定してください');
 return spec;
}
