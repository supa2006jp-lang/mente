// Hide only the sketch groups that produced the shelled body; keep them editable.
export function hideShellProfiles(features,target){
 const ids=new Set(),visited=new Set();
 function trace(body,before=features.length){const key=body+':'+before;if(visited.has(key))return;visited.add(key);
  for(let i=before-1;i>=0;i--){const f=features[i];if(f.kind==='sketch'||f.kind==='plane')continue;
   if(f.kind==='cadop'){if(!f.outputs?.some(o=>o.id===body))continue;const s=f.spec||{};for(const r of [s.region,...(s.sections||[])])for(const id of r?.sourceIds||[])ids.add(id);if(s.target)trace(s.target,i);for(const id of s.others||[])trace(id,i);if(s.other)trace(s.other,i);return;}
   if((f.operation==='new'&&f.id===body)||(f.operation!=='new'&&f.target===body)){for(const id of f.region?.sourceIds||[])ids.add(id);if(f.operation==='new')return;}
  }
 }
 trace(target);const groups=new Set(features.filter(f=>ids.has(f.id)&&f.groupId).map(f=>f.groupId));return features.map(f=>f.kind==='sketch'&&(ids.has(f.id)||groups.has(f.groupId))?{...f,groupHidden:true}:f);
}
