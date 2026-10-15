import {filletBodyTargets,isFilletBodySuppressed} from './fillet-state.js';
import {draggableDialog} from './draggable-dialog.js';

export function bodyFilletEntries(features,bodyId){
 return features.flatMap((f,index)=>{
  const targets=filletBodyTargets(f.spec);
  return f.kind==='cadop'&&targets.includes(bodyId)?[{id:f.id,index,name:f.name,radius:f.spec.radius,suppressed:isFilletBodySuppressed(f.spec,bodyId),shared:targets.length>1}]:[];
 });
}

export function createBodyFilletList({getFeatures,bodyName,onEdit,onHighlight=()=>{}}){
 let dialog=null,revision=null,highlighted=null;
 const el=name=>dialog.querySelector('#body-fillet-'+name);
 function locate(entry){
  if(!dialog.open||getFeatures()!==revision||highlighted===entry.id)return;
  highlighted=entry.id;onHighlight(entry.id,el('target').value);
  for(const row of el('items').children){const active=row.dataset.filletId===highlighted;row.style.borderColor=active?'#ffb347':'#3a4b5d';row.querySelector('[data-locate]').setAttribute('aria-pressed',String(active));}
  el('location').textContent=(entry.index+1)+'工程目 · R'+entry.radius+' mm を橙色で表示中';
 }
 function render(){
  highlighted=null;onHighlight(null);el('location').textContent='「位置を表示」で該当箇所を橙色に表示します。';
  revision=getFeatures();const bodyId=el('target').value,entries=bodyFilletEntries(revision,bodyId);
  el('status').textContent=entries.length?entries.length+' 工程 · 編集するフィレットを選択してください':'このボディを対象にしたフィレット工程はありません。';
  el('items').replaceChildren();
  for(const entry of entries){
   const row=document.createElement('div');row.dataset.filletId=entry.id;row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:6px;padding:8px;border:1px solid #3a4b5d;border-radius:6px';
   const button=document.createElement('button');button.type='button';
   button.style.cssText='display:flex;flex-direction:column;gap:5px;min-width:0;white-space:normal;text-align:left;padding:6px;border:0;background:transparent';button.title='このフィレットを編集';
   const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=(entry.index+1)+'. '+entry.name+' · R'+entry.radius+' mm';detail.textContent=(entry.suppressed?'解除中':'適用中')+(entry.shared?' · 複数ボディに共通の工程':'');detail.style.cssText='font-size:12px;color:#a9becb';
   const highlight=()=>locate(entry);row.onpointerenter=highlight;button.onfocus=highlight;
   const show=document.createElement('button');show.type='button';show.dataset.locate='';show.textContent='位置を表示';show.setAttribute('aria-label',(entry.index+1)+'工程目の位置を表示');show.setAttribute('aria-pressed','false');show.style.cssText='align-self:center;color:#ffd28b;border-color:#91642d;padding:7px';show.onclick=show.onfocus=highlight;
   button.append(title,detail);button.onclick=()=>{if(getFeatures()!==revision){render();el('status').textContent='履歴が変更されたため一覧を更新しました。工程を選び直してください。';return;}dialog.close();onHighlight(null);onEdit(entry.id,bodyId);};row.append(button,show);el('items').append(row);
  }
 }
 function build(){
  dialog=document.createElement('dialog');dialog.id='body-fillet-dialog';dialog.setAttribute('aria-labelledby','body-fillet-title');dialog.style.cssText='position:fixed;margin:0;box-sizing:border-box;width:min(420px,calc(100vw - 32px));background:#142232;color:#e2edf5;border:1px solid #456176;border-radius:12px;padding:16px;max-height:72vh;overflow:auto';
  dialog.innerHTML='<div class="dialog-heading"><h2 id="body-fillet-title">選択ボディのフィレット</h2><button type="button" id="body-fillet-close" aria-label="フィレット一覧を閉じる">×</button></div><label>対象ボディ<select id="body-fillet-target"></select></label><p id="body-fillet-status" role="status"></p><div id="body-fillet-items" style="display:flex;flex-direction:column;gap:8px;max-height:42vh;overflow:auto"></div><p class="hint" style="margin-top:14px">工程にカーソルを合わせると加工部分を橙色で表示します。解除中は対象の辺を表示します。後続で形が変わった部分は、この工程の時点の形を示します。</p><p class="hint">解除中の工程も編集できます。複数ボディに共通する工程の半径変更は、その工程の適用中のボディに反映されます。</p>';
  el('items').style.maxHeight='28vh';
  const heading=dialog.querySelector('.dialog-heading');heading.style.cssText='cursor:grab;touch-action:none;position:sticky;top:-16px;background:#142232;z-index:1;padding:8px 0';
  const move=document.createElement('span');move.textContent='⠿ ドラッグで移動';move.style.cssText='display:block;font-size:12px;color:#9dc9d6;font-weight:normal;margin-top:5px';heading.querySelector('h2').append(move);
  heading.querySelector('h2').style.cssText='margin:0;font-size:16px';
  const viewHint=document.createElement('p');viewHint.textContent='モデル上を左ドラッグで回転・右ドラッグで移動・ホイールで拡大';viewHint.style.cssText='font-size:12px;color:#9dc9d6;margin:6px 0 12px';heading.after(viewHint);dialog.style.zIndex='1200';
  const location=document.createElement('p');location.id='body-fillet-location';location.setAttribute('role','status');location.style.cssText='font-size:12px;color:#ffd28b;margin:8px 0';el('items').before(location);
  const hints=dialog.querySelectorAll('.hint');hints[0].textContent='カーソルを合わせるか「位置を表示」で橙色に表示・保持。工程名で編集します。';hints[1].textContent='解除中は元の辺、後続で形が変わった部分は工程時点の形を表示します。共通工程の半径変更は他の適用中ボディにも反映します。';
  const style=document.createElement('style');style.textContent='#body-fillet-dialog::backdrop{background:transparent}';dialog.append(style);
  document.body.append(dialog);draggableDialog(dialog);el('close').onclick=()=>dialog.close();el('target').onchange=render;dialog.addEventListener('close',()=>{if(!document.querySelector('#fillet-history-dialog[open]'))onHighlight(null);});
 }
 return {open(bodyIds,preferredBody){
  const ids=[...new Set(bodyIds)].filter(id=>typeof id==='string'&&id);if(!ids.length)return;
  if(!dialog)build();el('target').replaceChildren();for(const id of ids)el('target').add(new Option(bodyName(id),id));
  if(ids.includes(preferredBody))el('target').value=preferredBody;render();if(!dialog.open)dialog.show();const first=bodyFilletEntries(revision,el('target').value)[0];if(first)locate(first);
 }};
}
