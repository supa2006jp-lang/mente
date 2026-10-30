// Explain the dimensions used by the existing layout without changing inputs
// or asking the CAD worker to calculate another solid.
export function installHoneycombAppliedDimensions(dialog,getContext){
 const $=key=>dialog.querySelector('#honeycomb-'+key),frames=['border','topBorder','bottomBorder'];
 const describe=(input,id)=>{input.setAttribute('aria-describedby',[...new Set((input.getAttribute('aria-describedby')||'').split(' ').filter(Boolean).concat(id))].join(' '));};
 function output(key,input){const node=document.createElement('output');node.id='honeycomb-'+key+'-applied';node.className='honeycomb-applied';input.closest('label').append(node);describe(input,node.id);return node;}
 const notes=Object.fromEntries(frames.map(key=>[key,output(key,$(key))])),cellNote=output('cell',$('cell')),countNote=document.createElement('output');
 countNote.id='honeycomb-count-cell-applied';countNote.className='honeycomb-applied honeycomb-count-applied';$('count-fields').after(countNote);for(const key of ['columns','rows'])describe($(key),countNote.id);
 const style=document.createElement('style');style.textContent='#honeycomb-dialog .honeycomb-applied{display:block;font-size:12px;font-weight:400;line-height:1.5;color:#456477}#honeycomb-dialog .honeycomb-applied[data-adjusted=true]{color:#825600;background:#fff3cf;border-radius:4px;padding:4px 6px}#honeycomb-dialog label[data-applied-adjusted=true] input{border-color:#b98110;box-shadow:0 0 0 1px #b98110}#honeycomb-dialog .honeycomb-count-applied{margin:0 0 12px;padding:7px;background:#e5f3f8;border-radius:5px}#honeycomb-dialog .honeycomb-applied[hidden]{display:none}';document.head.append(style);
 const number=key=>{const input=$(key),value=Number(input.value);return input.value.trim()!==''&&input.validity.valid&&Number.isFinite(value)?value:null;};
 function update(){
  const context=getContext(),thickness=number('thickness');
  for(const key of frames){const note=notes[key],input=$(key),value=number(key),label=input.closest('label');delete note.dataset.value;note.dataset.adjusted='false';label.dataset.appliedAdjusted='false';
   if(key==='border'&&context.kind==='cylinder'){note.textContent='円柱では使用しません';continue;}
   if(value===null||thickness===null){note.textContent='入力範囲を確認してください';continue;}
   const applied=Math.max(value,thickness),adjusted=applied!==value,prefix=key==='border'&&!context.kind?'箱での適用':'適用';note.dataset.value=String(applied);note.dataset.adjusted=String(adjusted);label.dataset.appliedAdjusted=String(adjusted);
   note.textContent=adjusted?'入力 '+value+' mm → '+prefix+' '+applied+' mm（'+($('hollow').checked?'壁厚':'加工深さ')+' '+thickness+' mm 以上を確保）':prefix+'：'+applied+' mm';
  }
  const count=$('layout').value==='count',cell=number('cell');countNote.hidden=!count;delete countNote.dataset.value;delete cellNote.dataset.value;
  if(cell===null){cellNote.textContent='入力範囲を確認してください';}else{cellNote.textContent='適用する穴幅：'+cell+' mm';cellNote.dataset.value=String(cell);}
  if(count){if(Number.isFinite(context.cell)&&context.cell>0){const rounded=Number(context.cell.toFixed(3));countNote.dataset.value=String(context.cell);countNote.textContent='自動計算の穴幅：'+(Math.abs(context.cell-rounded)>1e-8?'約 ':'')+rounded+' mm';}else countNote.textContent=context.error?'この設定では穴幅を計算できません':'自動計算の穴幅：配置の確認後に表示';}
 }
 return {update};
}
