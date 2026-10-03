const safe=new Set(['shell','fillet','trimSurface','pipe','enclose']);
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const key=spec=>{const {id,...input}=spec;return JSON.stringify(sorted(input));};
export class MachiningPreviewCache{
 clear(){this.entry=null;}
 store(features,spec,result,editingId=null){this.entry=safe.has(spec.type)?{features,key:key(spec),spec,result,editingId}:null;}
 get(features,spec,editingId=null){
  const entry=this.entry;if(!entry||entry.features!==features||entry.key!==key(spec)||entry.editingId!==editingId)return null;
  const result=structuredClone(entry.result);delete result.removed;
  if(spec.id!==entry.spec.id)for(const output of result.outputs){if(output.id!==spec.target&&(output.id===entry.spec.id||output.id.startsWith(entry.spec.id+'-')))output.id=spec.id+output.id.slice(entry.spec.id.length);}
  return result;
 }
}
