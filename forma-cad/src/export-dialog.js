export function createExportDialog({createPreview}={}){
 const dialog=document.createElement('dialog');
 dialog.id='export-dialog';
 dialog.setAttribute('aria-labelledby','export-title');
 dialog.innerHTML='<h2 id="export-title">出力</h2>'+
  '<label>形式<select id="export-format"></select></label>'+
  '<label id="export-target-label">対象<select id="export-target"></select></label>'+
  '<div class="export-review"><section><h3>ファイルに含まれる内容</h3><ul id="export-contents" aria-live="polite"></ul></section>'+
  '<section id="export-preview" hidden><div class="export-preview-controls">'+
  '<button type="button" id="export-preview-all">全体表示</button><button type="button" id="export-preview-top">上から見る</button></div>'+
  '<div id="export-viewport"></div><p id="export-preview-status" role="status"></p></section></div>'+
  '<p id="export-detail" role="status"></p><div class="export-actions">'+
  '<button type="button" id="export-cancel">閉じる</button>'+
  '<button type="button" id="export-confirm" class="accent"></button></div>';
 document.body.append(dialog);
 const find=id=>dialog.querySelector('#export-'+id);
 const format=find('format'),target=find('target'),contents=find('contents'),detail=find('detail'),confirm=find('confirm');
 const preview=find('preview'),view=createPreview?.(find('viewport')),previewStatus=find('preview-status');
 let formats=[],current=()=>true,revision=0,ready=false,payload;
 const entries=()=>formats.find(item=>item.id===format.value)?.entries??[];
 const entry=()=>entries()[Number(target.value)];
 function selectPart(id,label){
  view?.focus(id);previewStatus.textContent=id===null?'一覧の名前を選ぶと、その部品を強調します。':label+'を強調しています。';
  for(const button of contents.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.exportPartId===id));
 }
 find('preview-all').onclick=()=>{selectPart(null);view?.view();};
 find('preview-top').onclick=()=>view?.view(true);
 function clearPreview(){
  payload=undefined;view?.clear();preview.hidden=true;
  dialog.classList.remove('has-model-preview');
 }
 function drawRows(rows){
  contents.replaceChildren(...rows.map(row=>{
   const item=document.createElement('li'),interactive=view?.has(row.id);
   const text=interactive?document.createElement('button'):item;
   text.textContent=row.label;
   if(row.detail){const small=document.createElement('small');small.textContent=row.detail;text.append(small);}
   if(interactive){
    text.type='button';text.exportPartId=row.id;text.dataset.exportPart=String(row.id);
    if(row.color)text.style.setProperty('--part-color',row.color);
    text.setAttribute('aria-pressed','false');
    text.onclick=()=>selectPart(view.focused===row.id?null:row.id,row.label);
    item.append(text);
   }
   return item;
  }));
 }
 async function showEntry(){
  const token=++revision,item=entry();
  const currentEntry=()=>token===revision&&dialog.open&&current();
  clearPreview();
  ready=!item?.load;
  confirm.textContent=item?.action??'保存する';confirm.disabled=!item||!ready;
  drawRows(item?.rows??[]);
  detail.textContent=item?.load?'出力対象を確認しています…':item?.detail??'';
  if(!item?.load)return;
  try{
   const {rows,parts,plateSize,data}=await item.load(currentEntry);
   if(!currentEntry())return;
   let warning='';
   if(view&&parts?.length){
    preview.hidden=false;dialog.classList.add('has-model-preview');
    if(view.show(parts,plateSize))selectPart(null);
    else{
     preview.hidden=true;dialog.classList.remove('has-model-preview');
     warning='3Dプレビューを表示できませんでした。';
    }
   }
   drawRows(rows);detail.textContent=[item.detail,warning].filter(Boolean).join(' ');
   payload=data;confirm.disabled=false;ready=true;
  }catch(error){if(token===revision&&dialog.open)detail.textContent=error.message;}
 }
 function showFormat(initialTarget=0){
  const choices=entries();
  target.replaceChildren(...choices.map((item,i)=>new Option(item.label,String(i))));
  if(choices[initialTarget])target.value=String(initialTarget);
  find('target-label').hidden=choices.length<2;
  showEntry();
 }
 find('cancel').onclick=()=>dialog.close();
 format.onchange=()=>showFormat();target.onchange=showEntry;
 confirm.onclick=()=>{
  const item=entry();
  if(!item||!ready)return;
  if(!current()){
   detail.textContent='出力対象が変わりました。閉じて出力を開き直してください。';
   confirm.disabled=true;return;
  }
  const data=payload;dialog.close();
  item.run(data);
 };
 dialog.addEventListener('close',()=>{if(!dialog.open){revision++;clearPreview();formats=[];contents.replaceChildren();}});
 return {
  get active(){return dialog.open;},
  cancel(){if(dialog.open)dialog.close();},
  open({choices,initial,initialTarget,isCurrent=()=>true}){
   formats=choices.filter(choice=>choice.entries.length);
   if(!formats.length)return;
   current=isCurrent;
   format.replaceChildren(...formats.map(item=>new Option(item.label,item.id)));
   if(formats.some(item=>item.id===initial))format.value=initial;
   if(!dialog.open)dialog.showModal();
   showFormat(initialTarget);format.focus();
  },
 };
}
