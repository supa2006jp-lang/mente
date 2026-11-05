import {bodyColorThemes} from './automatic-body-colors.js';

const filamentStorage='forma-cad.filament-palette';
const defaultFilaments=['#ffffff','#222222','#c54343','#a6a6a6'];
function readFilaments(){
 try{
  const saved=JSON.parse(localStorage.getItem(filamentStorage));
  if(Array.isArray(saved)&&saved.length>0&&saved.length<=32&&saved.every(color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)))return saved;
 }catch{}
 return [...defaultFilaments];
}

export function createBodyColorDialog(){
 const dialog=document.createElement('dialog');
 dialog.id='body-color-dialog';
 dialog.setAttribute('aria-labelledby','body-color-title');
 dialog.innerHTML='<form><div class="dialog-heading"><h2 id="body-color-title">ボディの色</h2></div><p id="body-color-name"></p><label>色を選択 <input type="color" required></label><div class="editor-actions"><button type="button" data-reset>元の色に戻す</button><button type="button" data-cancel>キャンセル</button><button class="accent" type="submit">適用</button></div></form>';
 document.body.append(dialog);
 const input=dialog.querySelector('input'),reset=dialog.querySelector('[data-reset]');
 let apply;
 function finish(color){
  const callback=apply;
  dialog.close();
  callback?.(color);
 }
 dialog.querySelector('form').onsubmit=event=>{event.preventDefault();finish(input.value);};
 reset.onclick=()=>finish(null);
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 return function open({name,color,canReset,onApply,title='ボディの色'}){
  dialog.querySelector('#body-color-title').textContent=title;
  dialog.querySelector('#body-color-name').textContent=name;
  input.value=color;
  reset.disabled=!canReset;
  apply=onApply;
  dialog.showModal();
 };
}

export function createAutoColorDialog(){
 const dialog=document.createElement('dialog');
 dialog.id='auto-color-dialog';
 dialog.setAttribute('aria-labelledby','auto-color-title');
 dialog.innerHTML='<form><div class="dialog-heading"><h2 id="auto-color-title">自動彩色</h2></div><label>配色テーマ <select name="theme"></select></label><label>使用する色数の上限 <input name="limit" type="number" min="1" max="32" step="1" value="4" required> 色</label><label><input name="replace" type="checkbox" checked> 以前の自動彩色も変更する</label><p>印刷に使えるフィラメントの色数を指定できます。手動・面・読み込み時の色も数に含めます。</p><p aria-live="polite" data-status></p><ul class="auto-color-palette" aria-label="使用する色"></ul><div class="editor-actions"><button type="button" data-cancel>キャンセル</button><button type="submit" class="accent">適用</button></div></form>';
 document.body.append(dialog);
 const form=dialog.querySelector('form'),{theme,limit,replace}=form.elements;
 const filamentToggle=document.createElement('label');
 filamentToggle.innerHTML='<input type="checkbox"> 登録したフィラメント色だけを使う';
 const useFilaments=filamentToggle.firstElementChild;
 const filamentEditor=document.createElement('fieldset');
 filamentEditor.className='filament-palette-editor';
 filamentEditor.innerHTML='<legend>フィラメント色</legend><div data-filaments></div><button type="button" data-add-filament>色を追加</button>';
 form.querySelector('[data-status]').before(filamentToggle,filamentEditor);
 const filamentRows=filamentEditor.querySelector('[data-filaments]');
 const addFilament=filamentEditor.querySelector('[data-add-filament]');
 const filaments=readFilaments();
 function saveFilaments(){
  try{localStorage.setItem(filamentStorage,JSON.stringify(filaments));}catch{}
 }
 function renderFilaments(){
  filamentRows.replaceChildren(...filaments.map((color,index)=>{
   const label=document.createElement('div'),input=document.createElement('input'),remove=document.createElement('button');
   input.type='color';
   input.value=color;
   input.setAttribute('aria-label','フィラメント色 '+(index+1));
   input.oninput=()=>{filaments[index]=input.value;saveFilaments();};
   remove.type='button';
   remove.textContent='×';
   remove.disabled=filaments.length===1;
   remove.setAttribute('aria-label','色 '+(index+1)+'を削除');
   remove.onclick=()=>{filaments.splice(index,1);saveFilaments();renderFilaments();refresh();};
   label.append(input,remove);
   return label;
  }));
  addFilament.disabled=filaments.length>=32;
 }
 addFilament.onclick=()=>{
  filaments.push(defaultFilaments.find(color=>!filaments.includes(color))??'#808080');
  saveFilaments();renderFilaments();refresh();
  filamentRows.lastElementChild?.firstElementChild?.focus();
 };
 renderFilaments();
 for(const [id,label] of Object.entries(bodyColorThemes))theme.add(new Option(label,id));
 const palette=form.querySelector('ul'),status=form.querySelector('[data-status]'),apply=form.querySelector('[type=submit]');
 let current,options;
 function refresh(){
  filamentEditor.hidden=!useFilaments.checked;
  current=limit.validity.valid?options.preview({theme:theme.value,limit:limit.valueAsNumber,replace:replace.checked,filaments:useFilaments.checked?filaments:null}):null;
  if(!current)options.clear();
  apply.disabled=!current||current.blocked||!current.changes.size;
  status.textContent=!current?'色数は1〜32の整数で指定してください。':current.outside?.length?
   '保持する色のうち '+current.outside.map(color=>color.toUpperCase()).join('、')+' が未登録です。同じ色を登録するか、ボディや面の色を調整してください。':current.blocked?
   '保持する色が'+current.fixed.size+'色あります。色数の上限を上げてください。':
   current.used.size+'色を使用（上限 '+limit.valueAsNumber+'色）／ '+current.changes.size+'ボディを変更';
  palette.replaceChildren(...[...(current?.used??[])].map(color=>{
   const item=document.createElement('li'),swatch=document.createElement('span');
   swatch.style.backgroundColor=color;item.append(swatch,color.toUpperCase());return item;
  }));
 }
 function finish(accept){
  const active=options;
  options=null;
  dialog.close();
  active?.clear();
  if(accept)active?.apply(current.changes);
 }
 form.oninput=refresh;
 form.onsubmit=event=>{event.preventDefault();if(!apply.disabled)finish(true);};
 form.querySelector('[data-cancel]').onclick=()=>finish(false);
 dialog.oncancel=event=>{event.preventDefault();finish(false);};
 return function open(config){options=config;dialog.showModal();refresh();};
}
