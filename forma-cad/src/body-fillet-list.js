import {filletBodyTargets,isFilletBodySuppressed} from './fillet-state.js';
import {draggableDialog} from './draggable-dialog.js';

export function bodyFilletEntries(features,bodyId){
 return features.flatMap((f,index)=>{
  const targets=filletBodyTargets(f.spec);
  return f.kind==='cadop'&&targets.includes(bodyId)?[{id:f.id,index,name:f.name,radius:f.spec.radius,suppressed:isFilletBodySuppressed(f.spec,bodyId),shared:targets.length>1}]:[];
 });
}

export function createBodyFilletList({getFeatures,bodyName,onEdit,onHighlight=()=>{}}){
 let dialog=null,revision=null;
 const el=name=>dialog.querySelector('#body-fillet-'+name);
 function render(){
  onHighlight(null);
  revision=getFeatures();const bodyId=el('target').value,entries=bodyFilletEntries(revision,bodyId);
  el('status').textContent=entries.length?entries.length+' 工程 · 編集するフィレットを選択してください':'このボディを対象にしたフィレット工程はありません。';
  el('items').replaceChildren();
  for(const entry of entries){
   const button=document.createElement('button');button.type='button';button.dataset.filletId=entry.id;
   button.style.cssText='display:flex;flex-direction:column;gap:5px;width:100%;white-space:normal;text-align:left;padding:12px';
   const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=(entry.index+1)+'. '+entry.name+' · R'+entry.radius+' mm';detail.textContent=(entry.suppressed?'解除中':'適用中')+(entry.shared?' · 複数ボディに共通の工程':'');detail.style.cssText='font-size:12px;color:#a9becb';
   const highlight=()=>{if(dialog.open&&getFeatures()===revision)onHighlight(entry.id,bodyId);};button.onpointerenter=button.onfocus=highlight;button.onpointerleave=button.onblur=()=>{if(dialog.open)onHighlight(null);};
   button.append(title,detail);button.onclick=()=>{if(getFeatures()!==revision){render();el('status').textContent='履歴が変更されたため一覧を更新しました。工程を選び直してください。';return;}dialog.close();onHighlight(null);onEdit(entry.id,bodyId);};el('items').append(button);
  }
 }
 function build(){
  dialog=document.createElement('dialog');dialog.id='body-fillet-dialog';dialog.setAttribute('aria-labelledby','body-fillet-title');dialog.style.cssText='position:fixed;margin:0;box-sizing:border-box;width:min(480px,calc(100vw - 32px));background:#142232;color:#e2edf5;border:1px solid #456176;border-radius:12px;padding:22px;max-height:85vh;overflow:auto';
  dialog.innerHTML='<div class="dialog-heading"><h2 id="body-fillet-title">選択ボディのフィレット</h2><button type="button" id="body-fillet-close" aria-label="フィレット一覧を閉じる">×</button></div><label>対象ボディ<select id="body-fillet-target"></select></label><p id="body-fillet-status" role="status"></p><div id="body-fillet-items" style="display:flex;flex-direction:column;gap:8px;max-height:42vh;overflow:auto"></div><p class="hint" style="margin-top:14px">工程にカーソルを合わせると加工部分を橙色で表示します。解除中は対象の辺を表示します。後続で形が変わった部分は、この工程の時点の形を示します。</p><p class="hint">解除中の工程も編集できます。複数ボディに共通する工程の半径変更は、その工程の適用中のボディに反映されます。</p>';
  dialog.querySelector('.dialog-heading').style.cssText='cursor:grab;touch-action:none';
  document.body.append(dialog);draggableDialog(dialog);el('close').onclick=()=>dialog.close();el('target').onchange=render;dialog.addEventListener('close',()=>{if(!document.querySelector('#fillet-history-dialog[open]'))onHighlight(null);});
 }
 return {open(bodyIds,preferredBody){
  const ids=[...new Set(bodyIds)].filter(id=>typeof id==='string'&&id);if(!ids.length)return;
  if(!dialog)build();el('target').replaceChildren();for(const id of ids)el('target').add(new Option(bodyName(id),id));
  if(ids.includes(preferredBody))el('target').value=preferredBody;render();if(!dialog.open)dialog.showModal();
 }};
}
