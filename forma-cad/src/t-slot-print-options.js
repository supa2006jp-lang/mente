import {partChoices,preferredRailLimit,rememberRailLimit} from './t-slot-parts.js';
import {panelFaces} from './t-slot-panels.js';

export const manualControls='<fieldset class="t-slot-extras"><legend>フレームの分割設定</legend>'+
  '<label>フレーム1本の長さの上限（mm）<input id="t-slot-manual-limit" type="number" max="180" step="any" required></label>'+
  '<p>上限はこのブラウザーに保存します。長い辺は等分し、継ぎ目ごとに2穴プレート1個とM8×16ボルト・ナット各2個を加えます。</p></fieldset>'+
  '<fieldset class="t-slot-extras"><legend>印刷する部品</legend><div id="t-slot-order-lines"></div>'+
  '<button type="button" id="t-slot-add-line">部品の行を追加</button></fieldset>';

export function bindManualControls(panel,refresh){
  const limit=panel.querySelector('#t-slot-manual-limit'),list=panel.querySelector('#t-slot-order-lines');
  limit.value=preferredRailLimit();
  limit.oninput=refresh;
  limit.onchange=()=>{try{rememberRailLimit(limit.valueAsNumber);}catch{}};
  function addLine(initialCount){
    const row=document.createElement('div');row.className='t-slot-order-row';
    row.innerHTML='<label>部品<select></select></label><label class="order-dimension"><span></span><input type="number" step="any"></label>'+
      '<label>数量<input class="order-count" type="number" min="0" max="10000" step="1" required></label>'+
      '<button type="button" aria-label="この部品の行を削除">削除</button>';
    const type=row.querySelector('select'),dim=row.querySelector('.order-dimension'),length=dim.querySelector('input'),count=row.querySelector('.order-count');
    type.replaceChildren(...partChoices.map(c=>new Option(c.label,c.id)));
    function sync(){
      const choice=partChoices[type.selectedIndex];dim.hidden=!choice.dimension;
      dim.querySelector('span').textContent=(choice.dimension??'長さ')+'（mm）';
      if(choice.dimension)length.value=choice.id==='rail'?limit.value:choice.initial;
    }
    count.value=initialCount;sync();list.append(row);
    type.onchange=()=>{sync();refresh();};length.oninput=count.oninput=refresh;
    row.querySelector('button').onclick=()=>{row.remove();refresh();};
  }
  addLine(0);panel.querySelector('#t-slot-add-line').onclick=()=>{addLine(1);refresh();};
  return {limit,lines:()=>[...list.children].map(row=>({id:row.querySelector('select').value,
    length:row.querySelector('.order-dimension input').valueAsNumber,count:row.querySelector('.order-count').valueAsNumber}))};
}
export function panelControls(manual){
  const check=face=>'<label><input type="checkbox" value="'+face.id+'" id="t-slot-panel-'+face.id+'">'+face.label+'</label>';
  return '<fieldset class="t-slot-extras t-slot-panel-options"><legend>透明板（厚さ2 mm・四隅の穴付き）</legend>'+
    '<div class="t-slot-face-options">'+check(panelFaces[0])+'<label><input type="checkbox" id="t-slot-panel-sides">側面4枚</label>'+check(panelFaces.at(-1))+'</div>'+
    '<div class="t-slot-face-options t-slot-side-options">'+panelFaces.slice(1,-1).map(check).join('')+'</div>'+
    (manual?'<div class="t-slot-panel-size" hidden><p>取り付ける枠の内寸</p><div class="t-slot-quantities">'+
      ['幅','奥行き','高さ'].map((s,i)=>'<label>'+s+'（mm）<input type="number" step="any" required value="100" id="t-slot-opening-'+i+'"></label>').join('')+'</div></div>':'')+
    '<p class="t-slot-panel-note" hidden>板の周囲には片側0.5 mmのすき間を設けます。大きい板は台形の継ぎ手で分割し、裏の継ぎ板とM8ボルトで固定します。透明PETG用のプレートに板を並べ、必要な固定部品も加えます。</p></fieldset>';
}
export function bindPanelControls(panel,refresh){
  const checks=panelFaces.map(f=>panel.querySelector('#t-slot-panel-'+f.id)),sides=checks.slice(1,-1);
  const all=panel.querySelector('#t-slot-panel-sides'),dims=panel.querySelector('.t-slot-panel-size');
  const selected=()=>checks.filter(c=>c.checked).map(c=>c.value);
  function update(){
    all.checked=sides.every(c=>c.checked);all.indeterminate=!all.checked&&sides.some(c=>c.checked);
    const hide=!selected().length;
    if(dims)dims.hidden=hide;
    panel.querySelector('.t-slot-panel-note').hidden=hide;refresh();
  }
  checks.forEach(c=>{c.onchange=update;});
  all.onchange=()=>{sides.forEach(c=>{c.checked=all.checked;});update();};
  for(const input of dims?.querySelectorAll('input')??[])input.oninput=refresh;
  return {selected,box:()=>({size:[...dims.querySelectorAll('input')].map(input=>input.valueAsNumber),
    origin:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]]})};
}
