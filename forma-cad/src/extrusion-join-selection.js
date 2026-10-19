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
 if(feature.joinSelectionExact&&feature.targetBodies?.some(id=>!contacts.includes(id)))throw Error('選択したボディの一部がつながっていません。間にあるボディも選択してください');
}
