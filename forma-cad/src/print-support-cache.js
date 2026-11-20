import * as R from 'replicad';

// These caches are local to the CAD worker. Account for large meshes and BREP
// snapshots as well as the number of recently used entries.
export function createPrintSupportCache(maxSize,maxEntries){
 const entries=new Map();
 let size=0;
 function remove(key){
  const entry=entries.get(key);
  if(entry){size-=entry.weight;entries.delete(key);}
 }
 return {
  get(key){
   const entry=entries.get(key);
   if(!entry)return null;
   entries.delete(key);
   entries.set(key,entry);
   return entry.value;
  },
  set(key,value,weight){
   remove(key);
   if(weight>maxSize)return;
   while(entries.size>=maxEntries||size+weight>maxSize)remove(entries.keys().next().value);
   entries.set(key,{value,weight});
   size+=weight;
  },
  delete:remove,
 };
}
// Cache exact geometry as an independent snapshot. Boolean operations can
// change the topology data shared by a native clone.
export function cachedSupportGeometry(cache,key,build){
 if(!cache)return build();
 const entry=cache.get(key);
 if(entry){
  const {brep,...details}=entry;
  try{return {...details,shape:brep?R.deserializeShape(brep).asShape3D():null,reused:true};}
  catch(error){cache.delete(key);if(error instanceof WebAssembly.RuntimeError)throw error;}
 }
 const result=build();
 const {shape,...details}=result;
 try{
  const brep=shape?.serialize()??null;
  cache.set(key,{...details,brep},key.length+(brep?.length||0)+128);
 }catch(error){
  if(error instanceof WebAssembly.RuntimeError){shape?.delete();throw error;}
 }
 return result;
}
