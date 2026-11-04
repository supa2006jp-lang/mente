import {resultSnapshot,assertPreviewResult} from './preview-result-guard.js';
const safe=new Set(['shell','fillet','chamfer','trimSurface','pipe','enclose','circular','pull','join','revolve']);
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const key=spec=>{const {id,...input}=spec;return JSON.stringify(sorted(input));};
export class MachiningPreviewCache{
 clear(){this.entry=null;}
 store(features,spec,result,editingId=null){this.entry=safe.has(spec.type)?{features,key:key(spec),spec:structuredClone(spec),result,editingId,snapshot:resultSnapshot(result,spec)}:null;}
 get(features,spec,editingId=null){
  const entry=this.entry;if(!entry||entry.features!==features||entry.key!==key(spec)||entry.editingId!==editingId)return null;
  const result=structuredClone(entry.result);delete result.removed;delete result.added;delete result.previewWarnings;
  if(spec.id!==entry.spec.id){const protectedIds=new Set([spec.target,spec.sourceBody,spec.other,...(spec.targets||[]),...(spec.others||[])]),rename=id=>typeof id==='string'&&!protectedIds.has(id)&&(id===entry.spec.id||id.startsWith(entry.spec.id+'-'))?spec.id+id.slice(entry.spec.id.length):id,map=value=>typeof value==='string'?rename(value):Array.isArray(value)?value.map(map):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v)])):value;for(const output of result.outputs)output.id=rename(output.id);if(result.remove)result.remove=result.remove.map(rename);if(result.analysis)result.analysis=map(result.analysis);if(result.diagnostics)result.diagnostics=map(result.diagnostics);}
  try{assertPreviewResult(entry.snapshot,resultSnapshot(result,spec),{bodyIds:result.outputs.map(o=>o.id)});}catch(error){error.localVerification=true;error.verificationSpec=spec;throw error;}
  return result;
 }
}
