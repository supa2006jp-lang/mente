export function printSupportExportCandidates(features,bodyIds){
 const visible=new Set(bodyIds);
 return features.flatMap((feature,index)=>feature.kind==='cadop'&&feature.spec?.type==='printSupport'&&feature.spec.style==='walls'&&visible.has(feature.spec.id||feature.id)?[{feature,index,later:index<features.length-1}]:[]);
}
const savedSupportReady=feature=>feature.analysis?.printSupport?.complete!==false&&feature.analysis?.supportExport?.complete!==false;
export function savedSupportExportIds(features,bodyIds){
 return printSupportExportCandidates(features,bodyIds).filter(({feature})=>savedSupportReady(feature)).map(({feature})=>feature.id);
}
export function savedSupportExportGroups(features,bodyIds){
 const visible=new Set(bodyIds),groups=new Map(),eligible=[];
 let legacy=null;
 for(const [index,feature] of features.entries()){
  const spec=feature.spec;
  if(feature.kind!=='cadop'||spec?.type!=='printSupport'||spec.style!=='walls'){
   legacy=null;continue;
  }
  if(spec.batch!==true||spec.batchGroup)legacy=null;
  else if(!legacy||legacy.layerHeight!==spec.layerHeight)legacy={key:'legacy-'+feature.id,layerHeight:spec.layerHeight};
  if(!visible.has(spec.id||feature.id)||!savedSupportReady(feature))continue;
  eligible.push({id:feature.id,index});
  if(spec.batch!==true)continue;
  const key=spec.batchGroup||legacy.key;
  if(!groups.has(key))groups.set(key,{ids:[],index});
  groups.get(key).ids.push(feature.id);
 }
 const rows=[...groups.values()];
 if(eligible.length>1&&eligible.length<=100&&!rows.some(row=>row.ids.length===eligible.length)){
  rows.push({ids:eligible.map(row=>row.id),index:eligible[0].index,all:true});
 }
 return rows;
}
