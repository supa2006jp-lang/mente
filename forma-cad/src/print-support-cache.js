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
