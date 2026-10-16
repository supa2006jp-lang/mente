const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const remap=(value,ids)=>typeof value==='string'?(ids.get(value)??value):Array.isArray(value)?value.map(item=>remap(item,ids)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,remap(item,ids)])):value;
function signature(batch){
 const ids=new Map(batch.map((feature,index)=>[feature.id,'@extrusion-'+index]));
 return JSON.stringify(sorted(batch.map(({id,name,cadResult,...feature})=>remap(feature,ids))));
}
function bytes(value){
 if(typeof value==='string')return value.length*2;
 if(Array.isArray(value))return value.length&&typeof value[0]==='number'?value.length*8:value.reduce((sum,item)=>sum+bytes(item),0);
 if(value&&typeof value==='object')return Object.values(value).reduce((sum,item)=>sum+bytes(item),0);
 return 8;
}
// Keep only the latest complete barrier preview. Model identity, editing scope
// and all feature settings must match before accepting its exact saved outputs.
export class ExtrusionPreviewCache{
 constructor(limit=32*1024*1024){this.limit=limit;this.entry=null;}
 clear(){this.entry=null;}
 store(history,batch,prepared,editingId=null){
  this.clear();
  if(!batch.length||batch.some(feature=>!feature.barrier)||prepared.length!==batch.length)return;
  const records=prepared.map(({cadResult,...feature})=>{
   if(!cadResult?.outputs?.length||!Array.isArray(cadResult.remove)||cadResult.outputs.some(output=>!output.brep))return null;
   const {removed,previewWarnings,...result}=cadResult;
   return {...feature,cadResult:result};
  });
  if(records.some(record=>!record)||bytes(records)>this.limit)return;
  this.entry={history,key:signature(batch),ids:batch.map(feature=>feature.id),records:structuredClone(records),editingId};
 }
 get(history,batch,editingId=null){
  const entry=this.entry;
  if(!entry||entry.history!==history||entry.editingId!==editingId||entry.key!==signature(batch))return null;
  const ids=new Map(entry.ids.map((id,index)=>[id,batch[index].id]));
  const features=structuredClone(entry.records).map(({cadResult,...feature},index)=>{
   const next=remap(feature,ids);next.name=batch[index].name;
   for(const output of cadResult.outputs)output.id=ids.get(output.id)??output.id;
   cadResult.remove=cadResult.remove.map(id=>ids.get(id)??id);
   return {...next,cadResult};
  });
  return {features};
 }
}
