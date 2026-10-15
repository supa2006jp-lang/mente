import {filletBodyTargets,isFilletBodySuppressed,filletSuppressionState,setFilletBodySuppressed} from './fillet-state.js';

function filletIndex(features,id){
 const start=features.findIndex(f=>f.id===id),feature=features[start];
 if(feature?.kind!=='cadop'||feature.spec?.type!=='fillet')throw Error('変更するフィレット工程が見つかりません');
 return start;
}
export function filletHistoryChange(features,id,suppressed){
 const start=filletIndex(features,id);
 if(typeof suppressed!=='boolean')throw Error('フィレットの適用状態が不正です');
 const next=structuredClone(features),spec=next[start].spec;delete spec.suppressedTargets;
 if(suppressed)spec.suppressed=true;else delete spec.suppressed;
 return {before:features,features:next,start,id,suppressed,action:'toggle'};
}
export function filletRadiusChange(features,id,radius){
 const start=filletIndex(features,id);
 if(!Number.isFinite(radius)||radius<=0)throw Error('半径は0より大きい数値で指定してください');
 const next=structuredClone(features);next[start].spec.radius=radius;
 return {before:features,features:next,start,id,radius,action:'radius'};
}
export function bodyFilletFeatures(features,bodyId){
 return features.filter(f=>f.kind==='cadop'&&filletBodyTargets(f.spec).includes(bodyId)&&!isFilletBodySuppressed(f.spec,bodyId));
}
export function bodyFilletsChange(features,bodyId){
 const affected=bodyFilletFeatures(features,bodyId),ids=new Set(affected.map(f=>f.id));
 if(!ids.size)throw Error('このボディに適用中のフィレットはありません');
 const next=structuredClone(features),start=features.findIndex(f=>ids.has(f.id));
 for(const f of next)if(ids.has(f.id))f.spec=setFilletBodySuppressed(f.spec,bodyId);
 return {before:features,features:next,start,ids:[...ids],bodyId,count:ids.size,action:'batch'};
}

export function createFilletHistoryDialog({getFeatures,apply,cancel,bodyName=id=>id}){
 let dialog=null,id=null,busy=false,revision=0;
 const el=name=>dialog.querySelector('#fillet-history-'+name);
 function close(){dialog.close();}
 function update(){
  const features=getFeatures(),index=features.findIndex(f=>f.id===id),feature=features[index];if(!feature)return;
  const state=filletSuppressionState(feature.spec),suppressed=state==='suppressed',radius=Number(el('radius').value);
  el('name').textContent=(index+1)+'工程目「'+feature.name+'」 · 半径 '+feature.spec.radius+' mm';
  el('status').textContent=(suppressed?'解除中（丸める前の形状）':state==='partial'?'一部のボディで解除中':'適用中')+' · 後続 '+(features.length-index-1)+' 工程';
  el('radius-help').textContent=suppressed?'解除中は半径だけを保存し、解除状態を維持します。':'指定した半径で丸め直し、後続の加工も再計算します。';
  el('apply').textContent=suppressed?'フィレットを再適用':'この工程のフィレットを解除';
  el('apply').disabled=busy;el('radius').disabled=busy;el('body').disabled=busy;
  el('radius-apply').disabled=busy||!el('radius').value.trim()||!Number.isFinite(radius)||radius<=0||radius===feature.spec.radius;
  const count=bodyFilletFeatures(features,el('body').value).length;
  el('batch-status').textContent='選んだボディのフィレット '+count+' 工程が対象です。';el('batch').disabled=busy||!count;
 }
 async function commit(makeChange){
  if(busy)return;const request=revision;
  try{
   const change=makeChange(getFeatures());busy=true;update();el('error').textContent='形状と後続工程を再計算しています…';
   await apply(change,()=>dialog.open&&request===revision,progress=>{if(dialog.open&&request===revision)el('error').textContent=progress.stage||'形状と後続工程を再計算しています…';});
   if(dialog.open&&request===revision){busy=false;close();}
  }catch(e){if(dialog.open&&request===revision)el('error').textContent=e.message||'フィレットを変更できませんでした';}
  finally{busy=false;if(dialog.open&&request===revision)update();}
 }
 function build(){
  dialog=document.createElement('dialog');dialog.id='fillet-history-dialog';dialog.setAttribute('aria-labelledby','fillet-history-title');dialog.style.cssText='width:min(500px,calc(100vw - 32px));background:#142232;color:#e2edf5;border:1px solid #456176;border-radius:12px;padding:24px;max-height:85vh;overflow:auto';
  dialog.innerHTML='<div class="dialog-heading"><h2 id="fillet-history-title">フィレットの編集</h2><button type="button" id="fillet-history-close" aria-label="閉じる">×</button></div><p id="fillet-history-name"></p><p id="fillet-history-status"></p><form id="fillet-history-radius-form" style="padding:0;display:block"><label>半径 (mm)<input id="fillet-history-radius" type="number" min="0" step="any" required aria-describedby="fillet-history-radius-help"></label><p class="hint" id="fillet-history-radius-help"></p><button type="submit" class="accent" id="fillet-history-radius-apply">半径を変更</button></form><div style="margin:16px 0"><button type="button" id="fillet-history-apply">この工程のフィレットを解除</button></div><fieldset style="border:1px solid #456176;border-radius:6px;padding:12px"><legend>同じボディをまとめて解除</legend><label>対象ボディ<select id="fillet-history-body"></select></label><p id="fillet-history-batch-status" class="hint"></p><button type="button" id="fillet-history-batch">このボディのフィレットを全解除</button></fieldset><p id="fillet-history-error" role="status" aria-live="polite" style="color:#ffb295"></p><div class="editor-actions"><button type="button" id="fillet-history-cancel">閉じる</button></div>';
  document.body.append(dialog);el('close').onclick=el('cancel').onclick=close;
  dialog.addEventListener('close',()=>{revision++;if(busy)cancel?.();});
  el('radius').addEventListener('input',update);el('body').addEventListener('change',update);
  el('radius-form').onsubmit=e=>{e.preventDefault();if(el('radius-apply').disabled)return;commit(features=>filletRadiusChange(features,id,Number(el('radius').value)));};
  el('apply').onclick=()=>commit(features=>filletHistoryChange(features,id,filletSuppressionState(features.find(f=>f.id===id)?.spec)!=='suppressed'));
  el('batch').onclick=()=>commit(features=>bodyFilletsChange(features,el('body').value));
 }
 return {open(featureId,preferredBody=null){
  if(busy)return;const feature=getFeatures().find(f=>f.id===featureId);if(feature?.spec?.type!=='fillet')return;
  if(!dialog)build();id=featureId;revision++;el('error').textContent='';el('radius').value=feature.spec.radius;
  el('body').replaceChildren();for(const bodyId of filletBodyTargets(feature.spec))el('body').add(new Option(bodyName(bodyId),bodyId));
  if(filletBodyTargets(feature.spec).includes(preferredBody))el('body').value=preferredBody;
  update();if(!dialog.open)dialog.showModal();el('radius').focus();el('radius').select();
 }};
}
