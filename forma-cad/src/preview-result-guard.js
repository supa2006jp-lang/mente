// Keep only small measurements, never another copy of a BREP or display mesh.
// A preview belongs to an immutable document and to all of its input settings.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
const verifiable=new Set(['extrusion','extrusionBatch','fillet','chamfer','shell','join','split','trimSurface','trimInterior','pull','move','mirror','revolve','pipe','loft','sphere','circular','rectangular','honeycomb','storageTray','dovetail','bossJoint','simpleBoss','ballJoint','snapLid','slideLid','cylinderHinge','printSupport','printLayout','assemblyMate','thread','copiedThread','coil','svgWrap','imageRelief','surfacePattern','qrCode','resize']);
function scope(spec){
 const preview=spec?.type==='preview'||spec?.type==='exactExtrusionPreview'||spec?.preview===true;
 let operation=spec?.type==='preview'?spec.operation:spec;
 if(operation?.type==='exactExtrusionPreview'){
  // An edited extrusion's preview includes successor replay; compare that at
  // the edit boundary rather than against the isolated replacement feature.
  if(operation.editingId)return null;
  operation={type:'extrusionBatch',features:operation.features};
 }
 if(!verifiable.has(operation?.type))return null; // inspections/replay and intentionally incomplete coil previews
 const ids=new Map(),protectedIds=new Set([operation.target,...(operation.targets||[]),operation.other,...(operation.others||[]),operation.sourceBody]);
 if(operation.id&&!protectedIds.has(operation.id))ids.set(operation.id,'@operation');
 for(const [i,f]of (operation.type==='extrusionBatch'?operation.features||[]:[]).entries())ids.set(f.id,'@extrusion-'+i);
 const rename=id=>{if(typeof id!=='string'||protectedIds.has(id))return id;for(const [from,to]of ids)if(id===from||id.startsWith(from+'-'))return to+id.slice(from.length);return id;};
 const map=value=>typeof value==='string'?rename(value):Array.isArray(value)?value.map(map):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v)])):value;
 const clean={...operation};delete clean.id;delete clean.preview;
 if(clean.type==='extrusionBatch')clean.features=clean.features.map(({id,name,cadResult,...f})=>f);
 return {preview,key:JSON.stringify(canonical(map(clean))),rename,type:operation.type};
}
function metrics(output,result){
 const row=result.analysis?.geometryHealth?.rows?.find(r=>r.id===output.id);
 const value=output.shapeMetrics||(row?{volume:row.after.volume,solids:row.after.solids,bounds:row.bounds}:null);
 if(!value||!Number.isFinite(value.volume)||!Number.isInteger(value.solids)||!Array.isArray(value.bounds)||value.bounds.length!==2||value.bounds.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v))))return null;
 return structuredClone(value);
}
export function resultSnapshot(result,spec){
 const descriptor=scope(spec);if(!descriptor)return null;
 const outputs=new Map(),remove=new Set(),metadata=new Map();
 for(const f of result.projectFeatures||result.features||[]){const r=f.cadResult||(f.kind==='cadop'?f:null);if(!r)continue;for(const id of r.remove||[])metadata.delete(id);for(const o of r.outputs||[])metadata.set(o.id,{o,r});}
 const add=r=>{for(const id of r.remove||[]){outputs.delete(id);remove.add(id);}for(const o of r.outputs||[]){const saved=metadata.get(o.id),measure=metrics(o,r)||(saved?metrics(saved.o,saved.r):null);outputs.set(o.id,{id:descriptor.rename(o.id),metrics:measure});remove.delete(o.id);}};
 if(Array.isArray(result.outputs))add(result);else for(const f of result.features||[])if(f.cadResult)add(f.cadResult);
 if(!Array.isArray(result.outputs)&&!result.features)return null;
 return {outputs:[...outputs.values()].sort((a,b)=>a.id.localeCompare(b.id)),remove:[...remove].map(descriptor.rename).sort()};
}
export function assertPreviewResult(expected,actual,{bodyIds=[]}={}){
 if(!expected||!actual)return {checked:false};
 const issues=[],old=new Map(expected.outputs.map(o=>[o.id,o])),next=new Map(actual.outputs.map(o=>[o.id,o]));let measured=0;
 if(JSON.stringify([...old.keys()])!==JSON.stringify([...next.keys()]))issues.push({code:'body-count',message:'加工されるボディの数または対象が変わりました'});
 if(JSON.stringify(expected.remove)!==JSON.stringify(actual.remove))issues.push({code:'removed-bodies',message:'削除されるボディが変わりました'});
 for(const [id,a]of old){const b=next.get(id);if(!b)continue;if(a.metrics&&!b.metrics){issues.push({code:'missing-measurements',id,message:'確定結果の形状を照合する検査値がありません',bounds:a.metrics.bounds});continue;}if(!a.metrics||!b.metrics)continue;measured++;const x=a.metrics,y=b.metrics;
  if(Math.abs(x.volume-y.volume)>Math.max(1e-6,Math.abs(x.volume)*1e-7))issues.push({code:'volume',id,message:'加工後の体積がプレビューと一致しません',expected:x.volume,actual:y.volume,bounds:x.bounds});
  if(x.solids!==y.solids)issues.push({code:'solid-count',id,message:'立体の分離数がプレビューと一致しません',expected:x.solids,actual:y.solids,bounds:x.bounds});
  if(x.bounds.some((p,i)=>p.some((v,k)=>Math.abs(v-y.bounds[i][k])>Math.max(2e-5,Math.abs(v)*1e-8))))issues.push({code:'bounds',id,message:'加工後の位置・大きさがプレビューと一致しません',bounds:x.bounds});
 }
 if(issues.length)throw Object.assign(Error('プレビューと確定結果が一致しないため中止しました。元のモデルと履歴は変更していません。プレビューを更新して再実行してください'),{code:'preview-mismatch',diagnostics:{kind:'preview-mismatch',certainty:'measured',bodyIds,issues,suggestion:'入力・対象を確認し、プレビューを更新してください。同じ状態で再発する場合は「失敗時の記録」を保存してください。'}});
 return {checked:true,measured,bodies:expected.outputs.length};
}
export class PreviewResultGuard{
 constructor(){this.documents=new WeakMap();}
 remember(features,spec,result){const d=scope(spec);if(!d||!features||result.contactOnly)return;const snapshot=resultSnapshot(result,spec);if(!snapshot)return;let entries=this.documents.get(features);if(!entries){entries=new Map();this.documents.set(features,entries);}entries.delete(d.key);entries.set(d.key,snapshot);while(entries.size>8)entries.delete(entries.keys().next().value);}
 accept(features,spec,result){if(spec?.type!=='preview'&&spec?.type!=='exactExtrusionPreview'&&spec?.preview!==true&&!this.documents.has(features))return;const d=scope(spec);if(!d)return;if(d.preview){this.remember(features,spec,result);return;}const expected=this.documents.get(features)?.get(d.key);if(expected)return assertPreviewResult(expected,resultSnapshot(result,spec),{bodyIds:(result.outputs||[]).map(o=>o.id)});}
}
// Exact extrusion previews and commits use separate workers, but the same
// immutable UI document. Sharing measurements allows them to be compared.
export const previewResultGuard=new PreviewResultGuard();
