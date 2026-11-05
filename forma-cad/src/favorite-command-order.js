const validId=id=>typeof id==='string'&&/^[\w-]{1,80}$/.test(id);
export function readCommandUsage(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([id,count])=>validId(id)&&Number.isSafeInteger(count)&&count>=0).slice(0,200));
}
export function orderFavoriteCommands(ids,usage){
 return ids.map((id,index)=>({id,index,count:usage[id]||0})).sort((a,b)=>b.count-a.count||a.index-b.index).map(item=>item.id);
}
export function moveFavoriteCommand(ids,id,target,before){
 if(id===target||!ids.includes(id)||!ids.includes(target))return [...ids];
 const next=ids.filter(value=>value!==id),at=next.indexOf(target)+(before?0:1);next.splice(at,0,id);return next;
}
