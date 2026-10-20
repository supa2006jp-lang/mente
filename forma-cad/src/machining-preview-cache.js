const safe=new Set(['shell','fillet','trimSurface','pipe','enclose','circular','pull']);
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const key=spec=>{const {id,...input}=spec;return JSON.stringify(sorted(input));};
export class MachiningPreviewCache{
 clear(){this.entry=null;}
 store(features,spec,result,editingId=null){this.entry=safe.has(spec.type)?{features,key:key(spec),spec,result,editingId}:null;}
 get(features,spec,editingId=null){
  const entry=this.entry;if(!entry||entry.features!==features||entry.key!==key(spec)||entry.editingId!==editingId)return null;
  const result=structuredClone(entry.result);delete result.removed;delete result.previewWarnings;
  if(spec.id!==entry.spec.id){const rename=id=>id!==spec.target&&!spec.targets?.includes(id)&&(id===entry.spec.id||id.startsWith(entry.spec.id+'-'))?spec.id+id.slice(entry.spec.id.length):id;for(const output of result.outputs)output.id=rename(output.id);for(const output of result.analysis?.patternHybrid?.newBodies||[])output.id=rename(output.id);}
  return result;
 }
}
