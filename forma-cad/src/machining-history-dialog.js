import {draggableDialog} from './draggable-dialog.js';
import {historyImpact} from './history-impact.js';
import {toggleMachiningSuppression} from './machining-suppression.js';

export function createMachiningHistoryDialog({getFeatures,replay,commit,showPreview,clearPreview,cancel}){
 const dialog=document.createElement('dialog');
 dialog.id='machining-history-dialog';
 dialog.setAttribute('aria-labelledby','machining-history-title');
 dialog.style.cssText='position:fixed;right:16px;left:auto;top:82px;width:min(430px,calc(100vw - 32px));max-height:75vh;margin:0;overflow:auto;z-index:1200;background:#142232;color:#e2edf5;border:1px solid #456176;border-radius:12px;padding:20px';
 dialog.innerHTML=`<div class="dialog-heading"><h2 id="machining-history-title"></h2>
 <button type="button" id="machining-history-close" aria-label="閉じる">×</button></div>
 <p id="machining-history-name"></p>
 <div class="editor-actions" role="group" aria-label="比較する形状">
 <button type="button" id="machining-history-current">現在の形状</button>
 <button type="button" id="machining-history-preview">変更後の形状</button></div>
 <p id="machining-history-status" role="status"></p>
 <details id="machining-history-impact"><summary>後続工程</summary><ol id="machining-history-steps"></ol></details>
 <div class="editor-actions"><button type="button" class="accent" id="machining-history-apply"></button></div>`;
 const el=name=>dialog.querySelector('#machining-history-'+name);
 let revision=0,change=null,preview=null;
 document.body.append(dialog);
 draggableDialog(dialog);
 function compare(after){
  try{
   if(after)showPreview(preview);else clearPreview();
   el('current').setAttribute('aria-pressed',String(!after));
   el('preview').setAttribute('aria-pressed',String(after));
   el('current').classList.toggle('accent',!after);
   el('preview').classList.toggle('accent',after);
   el('status').textContent=after?'水色で変更後の形状を表示しています。':'現在の形状を表示しています。';
  }catch(error){
   clearPreview();
   el('status').textContent=error.message;
  }
 }
 el('close').onclick=()=>dialog.close();
 el('current').onclick=()=>compare(false);
 el('preview').onclick=()=>compare(true);
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  revision++;change=preview=null;
  cancel();clearPreview();
 });
 el('apply').onclick=()=>{
  if(!preview||!change)return;
  try{
   if(getFeatures()!==change.before)throw Error('モデルが変更されました。工程を選び直してください');
   clearPreview();
   commit(preview,change.off);
   dialog.close();
  }catch(error){el('status').textContent=error.message;}
 };
 return {async open(id){
  if(dialog.open)return;
  const original=getFeatures(),request=++revision;
  change=toggleMachiningSuppression(original,id);
  preview=null;
  const impact=historyImpact(original,id),steps=impact.steps.filter(step=>step.affected);
  const feature=original[change.start],operation=feature.hole?'穴あけ':'シェル';
  el('title').textContent=operation+'の形状比較';
  el('name').textContent=(change.start+1)+'工程目「'+feature.name+'」 · '+(change.off?'適用中':'一時解除中');
  el('apply').textContent=change.off?'一時解除を適用':'再適用する';
  for(const button of ['current','preview','apply'])el(button).disabled=true;
  el('current').setAttribute('aria-pressed','true');
  el('preview').setAttribute('aria-pressed','false');
  el('current').classList.add('accent');
  el('preview').classList.remove('accent');
  el('impact').hidden=!steps.length;
  el('impact').open=steps.length<=5;
  el('impact').querySelector('summary').textContent='影響を受ける可能性がある後続工程（'+steps.length+'件）';
  el('steps').replaceChildren(...steps.map(step=>{
   const row=document.createElement('li');row.value=step.index+1;row.textContent=step.name;return row;
  }));
  el('status').textContent='後続工程まで計算しています…';
  delete el('status').dataset.failedFeature;
  dialog.show();el('close').focus();
  const isCurrent=()=>request===revision&&dialog.open&&getFeatures()===original;
  try{
   const result=await replay(change,info=>{if(isCurrent())el('status').textContent=info.stage;});
   if(!isCurrent())return;
   preview=result.features;
   for(const button of ['current','preview','apply'])el(button).disabled=false;
   compare(true);
  }catch(error){
   if(!isCurrent())return;
   el('status').textContent=error.message||'後続工程を再計算できませんでした';
   el('status').dataset.failedFeature=error.featureId??'';
  }
 }};
}
