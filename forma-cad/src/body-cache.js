// Bounded LRU: keys compare exact input data; cached shapes are never handed out.
const entries=new Map();let serial=0,bytes=0;
export const bodyCacheStats={hits:0,misses:0};
export function cachedBody(key,build){let entry=entries.get(key);if(entry){bodyCacheStats.hits++;entries.delete(key);entries.set(key,entry);}else{bodyCacheStats.misses++;entry={shape:build(),token:++serial};entries.set(key,entry);bytes+=key.length*2;}const result={shape:entry.shape.clone(),token:entry.token};while(entries.size>48||bytes>24*1024*1024){const [old,value]=entries.entries().next().value;entries.delete(old);bytes-=old.length*2;value.shape.delete();}return result;}
export function rememberBody(brep,shape){const result=cachedBody('brep:'+brep,()=>shape.clone());result.shape.delete();}
export function clearBodyCache(){for(const entry of entries.values())entry.shape.delete();entries.clear();bytes=0;bodyCacheStats.hits=bodyCacheStats.misses=0;}
