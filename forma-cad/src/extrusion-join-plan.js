export function extrusionJoinPlan(batch,prepared,originalIds){
 const ids=new Set(originalIds),owners=new Map([...ids].map(id=>[id,new Set([id])])),created=new Set(),entries=[];
 const expand=values=>[...new Set(values.flatMap(id=>[...(owners.get(id)||[])]))];
 for(let index=0;index<prepared.length;index++){
  const f=batch[index],result=prepared[index].cadResult;if(!result?.outputs?.length)continue;
  if(f.operation!=='join'){if(f.operation==='new')for(const output of result.outputs){created.add(output.id);owners.set(output.id,new Set([output.id]));}continue;}
  const info=result.analysis?.extrusionJoin,contacts=info?.bodyIds||[...result.outputs.map(o=>o.id),...result.remove],bodyIds=expand(contacts);
  const source=f.region?.cadFace?.bodyId||f.region?.bodyId||f.region?.gridSourceBodyId||info?.sourceId;
  const sourceId=ids.has(source)?source:created.has(f.target)?f.target:null,candidates=expand(info?.destinationCandidates||contacts).filter(id=>id!==sourceId),tipIds=expand(info?.endBodyIds||[]).filter(id=>candidates.includes(id));
  // A side contact is not a destination. Even two existing bodies require a
  // choice when the sweep would absorb a neighbour without reaching its end.
  const picked=f.endPlane?.bodyId,options=sourceId&&info?[...new Set([...tipIds,...(candidates.includes(picked)?[picked]:[])])]:candidates;
  const destinationId=options.includes(picked)?picked:options[0]||null;
  const incidental=!!sourceId&&bodyIds.some(id=>id!==sourceId&&!options.includes(id));
  entries.push({index,bodyIds,sourceId,destinationId,options,incidental,...(info?.sourceContactIds?.length?{sourceContactIds:expand(info.sourceContactIds)}:{})});
  for(const id of result.remove||[])owners.delete(id);
  for(const output of result.outputs)owners.set(output.id,new Set(bodyIds));
 }
 // Count the new sweep as one body too: two existing bodies plus the sweep
 // already meet the user's three-body threshold.
 const groups=[...owners.values()].filter(group=>group.size>=2),bodyIds=[...new Set(groups.flatMap(group=>[...group]))];
 return bodyIds.length?{bodyIds,entries}:null;
}

export function restrictExtrusionJoins(batch,plan,destinations={}){
 return batch.map((feature,index)=>{
  const entry=plan.entries.find(item=>item.index===index);if(!entry)return feature;
  const destinationId=destinations[index]||entry.destinationId;
  if(destinationId?!entry.options.includes(destinationId):!entry.sourceId)throw Error('押し出し先のボディを選択してください');
  const targetBodies=[...new Set([entry.sourceId,destinationId].filter(Boolean))];
  return {...feature,target:entry.sourceId||destinationId,targetAllBodies:false,cutAllBodies:false,targetBodies,joinSourceContacts:false};
 });
}
