export function filletHistoryChange(features,id,suppressed){
 const start=features.findIndex(f=>f.id===id),feature=features[start];
 if(feature?.kind!=='cadop'||feature.spec?.type!=='fillet')throw Error('解除するフィレット工程が見つかりません');
 if(typeof suppressed!=='boolean')throw Error('フィレットの適用状態が不正です');
 const next=structuredClone(features),spec=next[start].spec;
 if(suppressed)spec.suppressed=true;else delete spec.suppressed;
 return {before:features,features:next,start,id,suppressed};
}

export function createFilletHistoryDialog({getFeatures,apply,cancel}){
 let dialog=null,id=null,busy=false,revision=0;
 function close(){dialog.close();}
 function build(){
  dialog=document.createElement('dialog');dialog.id='fillet-history-dialog';dialog.setAttribute('aria-labelledby','fillet-history-title');dialog.style.cssText='width:min(460px,calc(100vw - 32px));background:#142232;color:#e2edf5;border:1px solid #456176;border-radius:12px;padding:24px;max-height:85vh;overflow:auto';
  dialog.innerHTML='<div class="dialog-heading"><h2 id="fillet-history-title">フィレットの解除・再適用</h2><button type="button" id="fillet-history-close" aria-label="閉じる">×</button></div><p id="fillet-history-name"></p><p id="fillet-history-status"></p><p class="hint">この工程で丸めた辺を元に戻します。後続の加工は再計算します。再適用すると、保存した半径・辺の指定で丸め直します。</p><p id="fillet-history-error" role="status" aria-live="polite"></p><div class="editor-actions"><button type="button" id="fillet-history-cancel">キャンセル</button><button type="button" class="accent" id="fillet-history-apply">フィレットを解除</button></div>';
  dialog.querySelector('#fillet-history-error').style.color='#ffb295';
  document.body.append(dialog);
  dialog.querySelector('#fillet-history-close').onclick=dialog.querySelector('#fillet-history-cancel').onclick=close;
  dialog.addEventListener('close',()=>{revision++;if(busy)cancel?.();});
  dialog.querySelector('#fillet-history-apply').onclick=async()=>{
   if(busy)return;
   const error=dialog.querySelector('#fillet-history-error'),button=dialog.querySelector('#fillet-history-apply'),request=revision;
   try{
    const features=getFeatures(),feature=features.find(f=>f.id===id),change=filletHistoryChange(features,id,feature?.spec?.suppressed!==true);
    busy=true;button.disabled=true;error.textContent='形状と後続工程を再計算しています…';
    await apply(change,()=>dialog.open&&request===revision,progress=>{if(dialog.open&&request===revision)error.textContent=progress.stage||'形状と後続工程を再計算しています…';});
    if(dialog.open&&request===revision){busy=false;close();}
   }catch(e){if(dialog.open&&request===revision)error.textContent=e.message||'フィレットを変更できませんでした';}
   finally{busy=false;button.disabled=false;}
  };
 }
 return {open(featureId){
  if(busy)return;
  const features=getFeatures(),index=features.findIndex(f=>f.id===featureId),feature=features[index];
  if(feature?.spec?.type!=='fillet')return;
  if(!dialog)build();id=featureId;revision++;
  const suppressed=feature.spec.suppressed===true;
  dialog.querySelector('#fillet-history-name').textContent=(index+1)+'工程目「'+feature.name+'」 · 半径 '+feature.spec.radius+' mm';
  dialog.querySelector('#fillet-history-status').textContent=(suppressed?'解除中（丸める前の形状）':'適用中')+' · 後続 '+(features.length-index-1)+' 工程';
  dialog.querySelector('#fillet-history-error').textContent='';
  const button=dialog.querySelector('#fillet-history-apply');button.textContent=suppressed?'フィレットを再適用':'フィレットを解除';button.disabled=false;
  if(!dialog.open)dialog.showModal();button.focus();
 }};
}
