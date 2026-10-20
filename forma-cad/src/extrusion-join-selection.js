export function canInspectExtrusionJoins(batch){return batch.length>0&&batch.some(f=>f.operation==='join')&&batch.every(f=>['new','join'].includes(f.operation)&&!f.barrier);}

export function extrusionJoinSources(plan){return [...new Set(plan.entries.map(e=>e.sourceId).filter(id=>id&&plan.bodyIds.includes(id)))];}

export function selectExtrusionJoins(batch,plan,selected){
 const wanted=new Set(selected),allowed=new Set(plan.bodyIds),sources=extrusionJoinSources(plan);
 if([...wanted].some(id=>!allowed.has(id))||sources.some(id=>!wanted.has(id)))throw Error('押し出し元を含め、一覧から結合するボディを選択してください');
 return batch.map((feature,index)=>{
  const entry=plan.entries.find(e=>e.index===index);if(!entry)return feature;
  if(!entry.bodyIds.some(id=>allowed.has(id)))return feature;
  const targetBodies=[...new Set([entry.sourceId,...entry.bodyIds.filter(id=>wanted.has(id))].filter(Boolean))];
  if(!targetBodies.length)throw Error('結合するボディを1個以上選択してください');
  return {...feature,target:entry.sourceId||targetBodies[0],targetAllBodies:false,cutAllBodies:false,targetBodies,joinSourceContacts:!!entry.sourceId,joinSelectionExact:true};
 });
}

export function assertExtrusionJoinContacts(feature,contacts){
 if(feature.joinSelectionExact&&feature.targetBodies?.some(id=>!contacts.includes(id)))throw Object.assign(Error('選択したボディの一部がつながっていません。間にあるボディも選択してください'),{code:'EXTRUSION_JOIN_DISCONNECTED'});
}

// Prefer paths that add fewer unchecked bodies. A tool contact is a root;
// body-to-body links are available only when source contact expansion is enabled.
export function extrusionJoinConnectionPath({bodyIds,directBodyIds,bodyLinks},selected){
 const allowed=new Set(bodyIds),wanted=new Set(selected),included=new Set(selected),links=new Map(bodyIds.map(id=>[id,[]]));
 if([...wanted].some(id=>!allowed.has(id)))return null;
 for(const [a,b]of bodyLinks)if(allowed.has(a)&&allowed.has(b)){links.get(a).push(b);links.get(b).push(a);}
 const required=new Set();
 for(const target of wanted){
  const best=new Map(),queue=[];
  const push=next=>{const previous=best.get(next.id);if(previous&&(previous.cost<next.cost||previous.cost===next.cost&&previous.path.length<=next.path.length))return;best.set(next.id,next);queue.push(next);};
  for(const id of directBodyIds)if(allowed.has(id))push({id,path:[id],cost:included.has(id)?0:1});
  let path=null;
  while(queue.length){queue.sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length);const next=queue.shift();if(best.get(next.id)!==next)continue;if(next.id===target){path=next.path;break;}for(const id of links.get(next.id)||[])push({id,path:[...next.path,id],cost:next.cost+(included.has(id)?0:1)});}
  if(!path)return null;
  for(const id of path)if(!included.has(id)){included.add(id);required.add(id);}
 }
 return [...required];
}

// Each proposed repair is rechecked against the complete sequential batch.
// Geometry failures, stale requests and unavailable paths never become advice.
export async function completeExtrusionJoinSelection(selected,allowed,error,validate){
 const permitted=new Set(allowed),chosen=new Set(selected),added=[];
 for(let attempt=0;attempt<allowed.length;attempt++){
  if(error?.code!=='EXTRUSION_JOIN_DISCONNECTED')return [];
  const next=error.diagnostics?.extrusionJoinConnections;
  if(!Array.isArray(next)||!next.length||next.some(id=>!permitted.has(id)))return [];
  const fresh=next.filter(id=>!chosen.has(id));if(!fresh.length)return [];
  for(const id of fresh){chosen.add(id);added.push(id);}
  try{await validate([...chosen]);return added;}catch(nextError){error=nextError;}
 }
 return [];
}
