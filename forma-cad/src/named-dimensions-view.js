import {readNamedDimensions} from './named-dimensions.js';

export function installNamedDimensionsView({anchor,getValues,onApply,canOpen,notify}){
 const open=document.createElement('button');
 open.id='named-dimensions-open';
 open.type='button';
 open.textContent='名前付き寸法';
 anchor.append(open);
 const dialog=document.createElement('dialog');
 dialog.id='named-dimensions-dialog';
 dialog.style.cssText='width:min(500px,90vw);max-height:80vh;overflow:auto';
 dialog.innerHTML='<form><h3>名前付き寸法</h3><p>登録後、寸法欄で「=」を押して「壁厚」や「壁厚 * 2」と入力します。スケッチの幅・高さ・円の直径、穴径・座ぐり径、押し出し距離、シェル壁厚、フィレット半径に連動できます。数値を直接入力すると、その欄の連動を解除します。</p><div data-rows></div><button data-add type="button">寸法を追加</button><p data-status role="status"></p><div class="editor-actions"><button data-cancel type="button">閉じる</button><button data-save type="submit" class="accent">適用</button></div></form>';
 document.body.append(dialog);
 const rows=dialog.querySelector('[data-rows]'),status=dialog.querySelector('[data-status]');
 function row(name='',value=''){
  const line=document.createElement('div');
  line.style.cssText='display:flex;gap:8px;align-items:center;margin:6px 0';
  const label=document.createElement('input'),number=document.createElement('input'),remove=document.createElement('button');
  label.setAttribute('aria-label','寸法名');label.placeholder='壁厚';label.maxLength=32;label.required=true;label.value=name;
  number.setAttribute('aria-label','寸法値 (mm)');number.type='number';number.step='any';number.required=true;number.value=value;
  number.style.width='100px';
  remove.type='button';remove.textContent='削除';remove.onclick=()=>line.remove();
  line.append(label,number,remove);rows.append(line);
 }
 open.onclick=()=>{
  if(!canOpen()){notify('編集中のコマンドを閉じてから名前付き寸法を開いてください');return;}
  rows.replaceChildren();status.textContent='';
  const values=Object.entries(getValues());
  for(const [name,value] of values)row(name,value);
  if(!values.length)row();
  dialog.showModal();
 };
 dialog.querySelector('[data-add]').onclick=()=>row();
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();
  if(dialog.dataset.busy)return;
  const inputs=[...rows.children].map(line=>[line.children[0].value.trim(),Number(line.children[1].value)]);
  try{
   if(new Set(inputs.map(([name])=>name)).size!==inputs.length)throw Error('同じ寸法名が複数あります');
   const values=readNamedDimensions(Object.fromEntries(inputs));
   dialog.dataset.busy='true';
   status.textContent='関連する工程を確認しています…';
   for(const control of dialog.querySelectorAll('input,button'))control.disabled=true;
   await onApply(values,()=>dialog.open);
   dialog.close();
  }catch(error){status.textContent=error.message;}
  finally{
   delete dialog.dataset.busy;
   for(const control of dialog.querySelectorAll('input,button'))control.disabled=false;
  }
 };
}
