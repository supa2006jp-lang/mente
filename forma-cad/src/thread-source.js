export function copiedThreadSource(features,feature){
 if(!feature.holesOnly||feature.operation!=='new')return null;
 const id=feature.region?.cadFace?.bodyId||feature.region?.bodyId;
 const source=id&&threadSource(features,id);if(!source||source.spec.threadInternal===false)return null;
 const copyFeature={...feature};delete copyFeature.cadResult;
 return {features:[],spec:{type:'copiedThread',target:feature.id,pitch:source.spec.pitch,leftHand:!!source.spec.leftHand,designation:source.spec.designation,threadInternal:false,copyDistance:0,copySource:structuredClone(source),copyFeature:structuredClone(copyFeature)}};
}
export function threadSource(features,id){
 for(let i=features.length-1;i>=0;i--){
  const f=features[i];
  if(f.kind==='sketch'||f.kind==='plane'||f.kind==='referenceImage')continue;
  const result=f.kind==='cadop'?f:f.cadResult;
  if(result){
   const output=result.outputs?.find(o=>o.id===id);
   if(output){
    if(output.threadSource)return output.threadSource;
    if(f.spec?.type==='thread'&&f.spec.profile==='metric60')return {features:features.slice(0,i),spec:f.spec};
    if(f.spec?.type==='move'&&f.spec.target===id){const source=threadSource(features.slice(0,i),id);return source?{...source,transforms:[...(source.transforms||[]),f.spec]}:null;}
    return copiedThreadSource(features.slice(0,i),f);
   }
   if(result.remove?.includes(id))return null;
   continue;
  }
  if(f.id===id)return copiedThreadSource(features.slice(0,i),f);
  if(f.operation!=='new'&&f.target===id)return null;
 }
 return null;
}

export function threadMateSource(features,id){
 const source=id&&threadSource(features,id),spec=source?.spec;
 return spec?.type==='thread'&&spec.profile==='metric60'&&spec.threadVersion===2?source:null;
}
