export function syncJoinBodyFields(target,other){
 if(!target||!other)return;
 for(const option of other.options)option.disabled=option.value===target.value;
 if(!other.value||other.value===target.value)other.value=[...other.options].find(option=>!option.disabled)?.value||'';
}
export function bindJoinBodyFields(target,other){
 const sync=()=>syncJoinBodyFields(target,other);target.addEventListener('change',sync);sync();
}
