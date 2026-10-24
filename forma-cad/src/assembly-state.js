// Relations are history records, so save/load and undo need no separate store.
export function assemblyLinks(features,available=null){
 const links=new Map();
 for(const f of features){
  const spec=f.spec,result=f.cadResult||(f.kind==='cadop'?f:null);
  for(const id of result?.remove||[])for(const [key,link]of links)if(link.bodies.includes(id))links.delete(key);
  if(spec?.type==='assemblyMate'&&typeof spec.source?.bodyId==='string'&&typeof spec.destination?.bodyId==='string')links.set(f.id,{id:f.id,bodies:[spec.source.bodyId,spec.destination.bodyId],mode:spec.mode});
  if(spec?.type==='assemblyRelease')links.delete(spec.linkId);
  for(const link of result?.analysis?.assemblyCopies||[])links.set(link.id,link);
  for(const link of result?.analysis?.supportLinks||[])links.set(link.id,link);
 }
 return [...links.values()].filter(link=>!available||link.bodies.every(id=>available.has(id)));
}
export function assemblyTargets(features,targets,available=null){
 const ids=new Set(targets),links=assemblyLinks(features,available);
 let changed=true;while(changed){changed=false;for(const link of links)if(link.bodies.some(id=>ids.has(id)))for(const id of link.bodies)if(!ids.has(id)){ids.add(id);changed=true;}}
 return [...ids];
}
export function copiedAssemblyLinks(features,targets,outputIds,operationId){
 const mapping=new Map(targets.map((id,i)=>[id,outputIds[i]]));
 return assemblyLinks(features).filter(link=>link.bodies.every(id=>mapping.has(id))).map((link,i)=>({id:operationId+'-relation-'+i,bodies:link.bodies.map(id=>mapping.get(id)),mode:link.mode}));
}
