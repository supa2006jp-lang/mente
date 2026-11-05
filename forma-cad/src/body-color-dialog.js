import {bodyColorThemes} from './automatic-body-colors.js';
import {CLEAR_COLOR,CLEAR_RGB,clearColor,colorChoiceLabel,colorChoiceRgb,isClearColor,isColorChoice} from './color-choice.js';

const filamentStorage='forma-cad.filament-palette';
const defaultFilaments=['#ffffff','#222222','#c54343','#a6a6a6'];
function readFilaments(){
 try{
  const saved=JSON.parse(localStorage.getItem(filamentStorage));
  if(Array.isArray(saved)&&saved.length>0&&saved.length<=32&&saved.every(isColorChoice))return saved;
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
 const clearLabel=document.createElement('label');
 clearLabel.className='clear-color-option';
 clearLabel.innerHTML='<input type="checkbox"> 透明';
 input.parentElement.after(clearLabel);
 const clear=clearLabel.firstElementChild;
 const neutral=document.createElement('button');
 neutral.type='button';
 neutral.textContent='無色にする';
 clearLabel.after(neutral);
 clear.onchange=()=>{neutral.hidden=!clear.checked;};
 neutral.onclick=()=>{input.value=CLEAR_RGB;};
 let apply;
 function finish(color){
  const callback=apply;
  dialog.close();
  callback?.(color);
 }
 dialog.querySelector('form').onsubmit=event=>{event.preventDefault();finish(clear.checked?clearColor(input.value):input.value);};
 reset.onclick=()=>finish(null);
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 return function open({name,color,canReset,onApply,title='ボディの色'}){
  dialog.querySelector('#body-color-title').textContent=title;
  dialog.querySelector('#body-color-name').textContent=name;
  clear.checked=isClearColor(color);
  input.value=colorChoiceRgb(color);
  clear.onchange();
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
 filamentEditor.innerHTML='<legend>フィラメント色</legend><div data-filaments></div><button type="button" data-add-filament>色を追加</button> <button type="button" data-add-clear>透明を追加</button>';
 form.querySelector('[data-status]').before(filamentToggle,filamentEditor);
 const filamentRows=filamentEditor.querySelector('[data-filaments]');
 const addFilament=filamentEditor.querySelector('[data-add-filament]');
 const addClear=filamentEditor.querySelector('[data-add-clear]');
 const filaments=readFilaments();
 function saveFilaments(){
  try{localStorage.setItem(filamentStorage,JSON.stringify(filaments));}catch{}
 }
 function renderFilaments(){
  filamentRows.replaceChildren(...filaments.map((color,index)=>{
   const label=document.createElement('div'),remove=document.createElement('button'),input=document.createElement('input');
   const transparent=isClearColor(color);
   if(transparent){
    const tag=document.createElement('span');
    tag.className='clear-color-swatch';
    tag.textContent='透明';
    label.append(tag);
   }
   input.type='color';
   input.value=colorChoiceRgb(color);
   input.setAttribute('aria-label',(transparent?'透明フィラメント色 ':'フィラメント色 ')+(index+1));
   input.oninput=()=>{filaments[index]=transparent?clearColor(input.value):input.value;saveFilaments();};
   remove.type='button';
   remove.textContent='×';
   remove.disabled=filaments.length===1;
   remove.setAttribute('aria-label','色 '+(index+1)+'を削除');
   remove.onclick=()=>{filaments.splice(index,1);saveFilaments();renderFilaments();refresh();};
   label.append(input,remove);
   return label;
  }));
  addFilament.disabled=filaments.length>=32;
  addClear.disabled=addFilament.disabled;
 }
 addFilament.onclick=()=>{
  filaments.push(defaultFilaments.find(color=>!filaments.includes(color))??'#808080');
  saveFilaments();renderFilaments();refresh();
  filamentRows.lastElementChild?.firstElementChild?.focus();
 };
 addClear.onclick=()=>{
  const startingColors=[CLEAR_RGB,'#579de6','#55ba8a','#e4a953'].map(clearColor);
  filaments.push(startingColors.find(color=>!filaments.includes(color))??CLEAR_COLOR);
  saveFilaments();renderFilaments();refresh();
  filamentRows.lastElementChild?.querySelector('input')?.focus();
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
   '保持する色のうち '+current.outside.map(colorChoiceLabel).join('、')+' が未登録です。同じ色を登録するか、ボディや面の色を調整してください。':current.blocked?
   '保持する色が'+current.fixed.size+'色あります。色数の上限を上げてください。':
   current.used.size+'色を使用（上限 '+limit.valueAsNumber+'色）／ '+current.changes.size+'ボディを変更';
  palette.replaceChildren(...[...(current?.used??[])].map(color=>{
   const item=document.createElement('li'),swatch=document.createElement('span');
   if(isClearColor(color)){
    swatch.className='clear-color-swatch';
    swatch.style.setProperty('--clear-tint',colorChoiceRgb(color)+'80');
   }
   else swatch.style.backgroundColor=color;
   item.append(swatch,colorChoiceLabel(color));return item;
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
