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
// Bounded LRU of complete previews for the current immutable model snapshot.
// Editing scope and all feature settings must match before accepting outputs.
export class ExtrusionPreviewCache{
 constructor(limit=32*1024*1024,maxEntries=4){this.limit=limit;this.maxEntries=maxEntries;this.clear();}
 clear(){this.entries=new Map();this.history=null;this.size=0;}
 scope(history){if(this.history!==history){this.clear();this.history=history;}}
 key(batch,editingId){return JSON.stringify([editingId,signature(batch)]);}
 store(history,batch,prepared,editingId=null,display=null,contacts=false){
  this.scope(history);
  if(!batch.length||!contacts&&batch.some(feature=>!feature.barrier&&feature.operation!=='join')||prepared.length!==batch.length)return;
  const records=prepared.map(({cadResult,...feature})=>{
   if(!cadResult?.outputs?.length||!Array.isArray(cadResult.remove)||!contacts&&cadResult.outputs.some(output=>!output.brep))return null;
   const {removed,previewWarnings,...result}=cadResult;
   return {...feature,cadResult:result};
  });
  if(records.some(record=>!record))return;
  const key=(contacts?'contacts:':'')+this.key(batch,editingId),size=key.length*2+bytes(records)+bytes(display);
  if(size>this.limit||this.maxEntries<1)return;
  if(this.entries.has(key)){this.size-=this.entries.get(key).size;this.entries.delete(key);}
  this.entries.set(key,{ids:batch.map(feature=>feature.id),records:structuredClone(records),display:structuredClone(display),size});this.size+=size;
  while(this.entries.size>this.maxEntries||this.size>this.limit){const oldest=this.entries.keys().next().value;this.size-=this.entries.get(oldest).size;this.entries.delete(oldest);}
 }
 read(history,batch,editingId,withDisplay,showGap,contacts=false){
  this.scope(history);const key=(contacts?'contacts:':'')+this.key(batch,editingId),entry=this.entries.get(key);
  if(!entry||withDisplay&&(!entry.display||showGap&&!entry.display.showGap))return null;
  this.entries.delete(key);this.entries.set(key,entry);
  const ids=new Map(entry.ids.map((id,index)=>[id,batch[index].id]));
  const features=structuredClone(entry.records).map(({cadResult,...feature},index)=>{
   const next=remap(feature,ids);next.name=batch[index].name;
   for(const output of cadResult.outputs)output.id=ids.get(output.id)??output.id;
   cadResult.remove=cadResult.remove.map(id=>ids.get(id)??id);
   if(cadResult.analysis)cadResult.analysis=remap(cadResult.analysis,ids);
   return {...next,cadResult};
  });
  if(!withDisplay)return {...(contacts?{contactOnly:true}:{}),features};
  const previews=structuredClone(entry.display.previews).map(preview=>{
   const next={...preview,outputs:preview.outputs.map(output=>({...output,id:ids.get(output.id)??output.id}))};
   if(next.removed)next.removed=next.removed.map(output=>({...output,id:ids.get(output.id)??output.id}));
   if(!showGap){delete next.barrierClearance;delete next.barrierClearanceWarning;}
   return next;
  });
  return {features,previews};
 }
 get(history,batch,editingId=null){return this.read(history,batch,editingId,false,false);}
 storeContacts(history,batch,result,editingId=null){if(result.contactOnly)this.store(history,batch,result.features,editingId,null,true);}
 getContacts(history,batch,editingId=null){return this.read(history,batch,editingId,false,false,true);}
 getPreview(history,batch,editingId=null,showGap=true){return this.read(history,batch,editingId,true,showGap);}
}
