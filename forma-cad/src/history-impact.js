const strings=value=>Array.isArray(value)?value.filter(v=>typeof v==='string'):typeof value==='string'?[value]:[];
export function featureReads(feature){
 const ids=new Set(),add=value=>strings(value).forEach(id=>ids.add(id)),spec=feature.spec||{};
 add(feature.target);add(feature.targetBodies);add(feature.sourceSketchIds);add(feature.offsetLink?.region?.sourceIds);
 for(const key of ['target','targets','other','others','path','sourceBody'])add(spec[key]);
 for(const ref of [...(spec.edges||[]),...(spec.faces||[]),spec.face,spec.rim,spec.placement].filter(Boolean))add(ref.bodyId);
 for(const region of [feature.region,spec.region,...(spec.sections||[])].filter(Boolean)){add(region.sourceIds);add(region.bodyId);add(region.cadFace?.bodyId);add(region.overlapTargets);add(region.overlapSource?.sourceIds);}
 if(feature.kind==='extrusion'&&feature.operation==='new')ids.delete(feature.target);
 return ids;
}
export function featureWrites(feature){
 const result=feature.cadResult||(feature.kind==='cadop'?feature:null),ids=new Set(result?.outputs?.map(o=>o.id)||[]);
 for(const id of result?.remove||[])ids.add(id);
 if(!result)ids.add(feature.kind==='extrusion'&&feature.operation!=='new'?feature.target:feature.id);
 return ids;
}
export function historyImpact(features,id){
 const index=features.findIndex(f=>f.id===id);if(index<0)return {index:-1,steps:[],affected:0};
 const changed=new Set([id,...featureWrites(features[index])]),steps=[];
 for(let i=index+1;i<features.length;i++){
  const feature=features[i],references=[...featureReads(feature)].filter(resource=>changed.has(resource)),affected=references.length>0;
  if(affected){changed.add(feature.id);for(const resource of featureWrites(feature))changed.add(resource);}
  steps.push({id:feature.id,index:i,name:feature.name||feature.spec?.type||'工程',affected,references});
 }
 return {index,steps,affected:steps.filter(step=>step.affected).length};
}
