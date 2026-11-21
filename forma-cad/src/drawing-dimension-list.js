import {dimensionLabel,drawingDimensionColor,validDimensionColor} from './drawing-dimensions.js';
import {drawingProjections} from './drawing-view-preferences.js';

const kinds={horizontal:'水平',vertical:'垂直',aligned:'２点間',diameter:'直径',radius:'半径 R',angle:'角度'};
const identity=d=>JSON.stringify([d.view,d.kind,d.a,d.b,d.vertex,d.center,d.radius,d.centers,d.modelA,d.modelB]);
export function editDrawingDimensions(dimensions,indices,patch){
 const chosen=new Set(indices);if([...chosen].some(i=>!Number.isInteger(i)||i<0||i>=dimensions.length))throw Error('寸法を選び直してください');
 for(const [key,value] of Object.entries(patch)){
  if(key==='fontSize'){if(!Number.isFinite(value)||value<1.5||value>10)throw Error('文字サイズは1.5〜10 mmで指定してください');}
  else if(key==='hidden'){if(typeof value!=='boolean')throw Error('表示設定が不正です');}
  else if(!['lineColor','textColor'].includes(key)||value!==null&&!validDimensionColor(value))throw Error('寸法の色が不正です');
 }
 return dimensions.map((d,i)=>{if(!chosen.has(i))return d;const next={...d};for(const [key,value] of Object.entries(patch)){if(value===null||key==='hidden'&&!value)delete next[key];else next[key]=value;}return next;});
}

export function installDrawingDimensionList(anchor,{read,onChange,onFocus,notify}){
 const panel=document.createElement('details');panel.id='drawing-dimension-list';panel.innerHTML='<summary>寸法一覧・一括編集</summary>'+
  '<div class="drawing-controls"><label>図<select id="drawing-dimension-list-view"><option value="">すべて</option></select></label><label>検索<input id="drawing-dimension-list-search" type="search" placeholder="R2、直径、TOP など"></label><button type="button" id="drawing-dimension-list-all">絞り込み結果を選択</button><button type="button" id="drawing-dimension-list-none">選択を解除</button><output id="drawing-dimension-list-count"></output></div>'+
  '<div class="drawing-controls"><label>文字サイズ (mm)<input id="drawing-bulk-font" type="number" min="1.5" max="10" step="0.1" placeholder="混在"></label><button type="button" id="drawing-bulk-font-apply">サイズを適用</button><label>寸法線の色<input id="drawing-bulk-line-color" type="color"></label><label>数字・注記の色<input id="drawing-bulk-text-color" type="color"></label><button type="button" id="drawing-bulk-colors-reset">図面の色に戻す</button><button type="button" id="drawing-bulk-show">表示</button><button type="button" id="drawing-bulk-hide">非表示</button></div>'+
  '<small>チェックした寸法だけに適用します。寸法名を押すと図中を強調します。非表示の寸法は保存され、SVG・PDFには出ません。</small><div id="drawing-dimension-list-rows"></div>';
 anchor.before(panel);
 const style=document.createElement('style');style.textContent='#drawing-dimension-list{margin:8px 0}#drawing-dimension-list summary{cursor:pointer}#drawing-dimension-list-rows{max-height:240px;overflow:auto;margin-top:6px}#drawing-dimension-list-rows>div{display:flex;align-items:center;gap:7px;padding:3px 6px;border-bottom:1px solid #8193a333}#drawing-dimension-list-rows button{flex:1;min-width:0;width:auto;text-align:left;padding:4px 7px;min-height:28px}#drawing-dimension-list-rows label{display:flex;align-items:center;gap:4px;white-space:nowrap}#drawing-dimension-list-rows input[type=checkbox]{width:16px;min-width:16px;height:16px;flex:0 0 16px;margin:0}#drawing-dimension-list input[type=number]{width:85px}#drawing-preview [data-bulk-selected]>path{stroke:#e76f00;stroke-width:.6}#drawing-preview [data-bulk-selected]>text{fill:#bd5400}';document.head.append(style);
 const q=id=>panel.querySelector('#drawing-'+id),rows=q('dimension-list-rows'),chosen=new Set();let previous=[],filtered=[];
 const labelView=view=>view==='iso'?'ISO':drawingProjections[view]?.label??view;
 function highlight(){for(const node of anchor.parentElement.querySelectorAll('#drawing-preview [data-dimension]'))node.toggleAttribute('data-bulk-selected',chosen.has(Number(node.dataset.dimension)));}
 function state(){const current=read(),next=current.dimensions.map(identity);if(next.length!==previous.length||next.some((id,i)=>id!==previous[i]))chosen.clear();previous=next;return current;}
 function apply(patch){const current=state();if(!current.ready||!chosen.size)return;try{const next=editDrawingDimensions(current.dimensions,[...chosen],patch);onChange(next,{reflow:patch.fontSize!==undefined||patch.hidden===false});notify(chosen.size+' 件の寸法を変更しました。元に戻すで取り消せます');}catch(error){notify(error.message);}}
 function sync(){
  const current=state(),{dimensions,ready,colors}=current;panel.firstElementChild.textContent='寸法一覧・一括編集（'+dimensions.length+'件'+(dimensions.some(d=>d.hidden)?'／非表示 '+dimensions.filter(d=>d.hidden).length+'件':'')+'）';highlight();
  if(!panel.open)return;
  const view=q('dimension-list-view'),value=view.value;view.replaceChildren(new Option('すべて',''));for(const id of new Set(dimensions.map(d=>d.view)))view.add(new Option(labelView(id),id));view.value=[...view.options].some(o=>o.value===value)?value:'';
  const search=q('dimension-list-search').value.trim().toLowerCase();filtered=dimensions.flatMap((d,i)=>(!view.value||d.view===view.value)&&(!search||[labelView(d.view),kinds[d.kind],dimensionLabel(d),d.hidden?'非表示':''].join(' ').toLowerCase().includes(search))?[i]:[]);
  rows.replaceChildren();
  for(const index of filtered){const d=dimensions[index],row=document.createElement('div'),check=document.createElement('input'),button=document.createElement('button'),visible=document.createElement('input'),visibleLabel=document.createElement('label');row.dataset.dimensionRow=index;
   check.type=visible.type='checkbox';check.checked=chosen.has(index);check.disabled=visible.disabled=button.disabled=!ready;check.setAttribute('aria-label','寸法 '+(index+1)+' を一括編集に選択');check.onchange=()=>{check.checked?chosen.add(index):chosen.delete(index);sync();};
   button.type='button';button.textContent=labelView(d.view)+' · '+kinds[d.kind]+' · '+dimensionLabel(d)+(d.review?'（要確認）':'');button.onclick=()=>{onFocus(index);highlight();};
   visible.checked=!d.hidden;visible.setAttribute('aria-label','寸法 '+(index+1)+' を表示');visible.onchange=()=>{const current=read();if(!current.ready)return;onChange(editDrawingDimensions(current.dimensions,[index],{hidden:!visible.checked}),{reflow:visible.checked});};visibleLabel.append(visible,'表示');row.append(check,button,visibleLabel);rows.append(row);
  }
  q('dimension-list-count').textContent=chosen.size+'件選択／'+filtered.length+'件表示';const selected=[...chosen].map(i=>dimensions[i]),same=values=>values.every(v=>v===values[0]);
  const fonts=selected.map(d=>d.fontSize??3.2);if(document.activeElement!==q('bulk-font'))q('bulk-font').value=fonts.length&&same(fonts)?fonts[0]:'';
  for(const [key,id] of [['lineColor','line'],['textColor','text']]){const input=q('bulk-'+id+'-color'),values=selected.map(d=>drawingDimensionColor(key,d,colors));input.value=values[0]??drawingDimensionColor(key,null,colors);input.title=values.length&&!same(values)?'色が混在しています。選ぶと選択した寸法だけに適用します':'';input.disabled=!ready||!chosen.size;}
  for(const id of ['bulk-font','bulk-font-apply','bulk-colors-reset','bulk-show','bulk-hide'])q(id).disabled=!ready||!chosen.size;
  q('dimension-list-all').disabled=!ready||!filtered.length;q('dimension-list-none').disabled=!chosen.size;view.disabled=q('dimension-list-search').disabled=!ready;
 }
 q('dimension-list-view').onchange=sync;q('dimension-list-search').oninput=sync;panel.ontoggle=sync;
 q('dimension-list-all').onclick=()=>{filtered.forEach(i=>chosen.add(i));sync();};q('dimension-list-none').onclick=()=>{chosen.clear();sync();};
 q('bulk-font-apply').onclick=()=>apply({fontSize:q('bulk-font').valueAsNumber});
 q('bulk-font').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();apply({fontSize:q('bulk-font').valueAsNumber});}};
 for(const [key,id] of [['lineColor','line'],['textColor','text']])q('bulk-'+id+'-color').onchange=()=>apply({[key]:q('bulk-'+id+'-color').value});
 q('bulk-colors-reset').onclick=()=>apply({lineColor:null,textColor:null});q('bulk-show').onclick=()=>apply({hidden:false});q('bulk-hide').onclick=()=>apply({hidden:true});
 return {sync,highlight,clear(){chosen.clear();previous=[];sync();}};
}
