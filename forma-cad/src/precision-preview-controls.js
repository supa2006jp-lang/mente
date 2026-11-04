import {precisionPreviewMode,setPrecisionPreviewMode,subscribePrecisionPreviewMode,precisionPreviewWaiting,authorizePrecisionPreview,clearPrecisionPreviewRequests,isPrecisionPreview} from './precision-preview-mode.js';
import {cancelAutomaticPrecisionPreviews,subscribeKernelActivity} from './kernel-client.js';
import {clearPreviewTimeouts} from './preview-timeout-cache.js';

export function installPrecisionPreviewControls(){
 const panels=new Set(),dialogs=new WeakSet();
 function refresh(explicit){
  if(explicit){
   clearPreviewTimeouts();
   authorizePrecisionPreview();
  }else cancelAutomaticPrecisionPreviews();
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.dispatchEvent(new Event('forma-preview-retry'));
  document.dispatchEvent(new CustomEvent('forma-precision-preview-refresh',{detail:{explicit}}));
 }
 function sync(){
  for(const {select,button} of panels){
   select.value=precisionPreviewMode();
   if(select.disabled)select.disabled=false;
   const disabled=!precisionPreviewWaiting();
   if(button.disabled!==disabled)button.disabled=disabled;
  }
 }
 function add(parent){
  const panel=document.createElement('span'),label=document.createElement('label');
  const select=document.createElement('select'),button=document.createElement('button');
  panel.className='precision-preview-controls';
  panel.style.cssText='display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;margin:5px 8px';
  select.className='precision-preview-mode';
  for(const [value,title] of [['automatic','自動（ON）'],['adaptive','おまかせ'],['manual','手動（OFF）']])select.add(new Option(title,value));
  select.title='おまかせでは複雑な切り取りや時間のかかった加工を簡易表示します';
  label.append('精密プレビュー',select);
  button.type='button';
  button.className='precision-preview-confirm';
  button.textContent='精密確認';
  panel.append(label,button);
  const heading=parent.querySelector('.dialog-heading');
  if(heading)heading.after(panel);
  else parent.prepend(panel);
  panels.add({select,button});
  select.onchange=()=>{setPrecisionPreviewMode(select.value);refresh(false);};
  button.onclick=()=>refresh(true);
  new MutationObserver(sync).observe(panel,{subtree:true,attributes:true,attributeFilter:['disabled']});
  sync();
 }
 const style=document.createElement('style');
 style.textContent='#tools-dialog .precision-preview-controls label,.precision-preview-controls label{flex-direction:row;display:inline-flex;align-items:center;gap:5px;margin:0;font-size:12px}#tools-dialog .precision-preview-mode,.precision-preview-mode,.precision-preview-controls button{width:auto;margin:0;padding:5px 8px;font-size:12px}';
 document.head.append(style);
 add(document.querySelector('.navigation')||document.getElementById('status').parentElement);
 subscribePrecisionPreviewMode(sync);
 subscribeKernelActivity(event=>{
  if(!isPrecisionPreview(event.spec,event.automaticPreview))return;
  const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
  if(!dialog||dialogs.has(dialog))return;
  dialogs.add(dialog);
  add(dialog.querySelector('form')||dialog);
  dialog.addEventListener('close',clearPrecisionPreviewRequests);
 });
}
