export function createExportDialog(){
 const dialog=document.createElement('dialog');
 dialog.id='export-dialog';
 dialog.setAttribute('aria-labelledby','export-title');
 dialog.innerHTML='<h2 id="export-title">出力</h2>'+
  '<label>形式<select id="export-format"></select></label>'+
  '<label id="export-target-label">対象<select id="export-target"></select></label>'+
  '<h3>ファイルに含まれる内容</h3><ul id="export-contents" aria-live="polite"></ul>'+
  '<p id="export-detail" role="status"></p><div class="export-actions">'+
  '<button type="button" id="export-cancel">閉じる</button>'+
  '<button type="button" id="export-confirm" class="accent"></button></div>';
 document.body.append(dialog);
 const find=id=>dialog.querySelector('#export-'+id);
 const format=find('format'),target=find('target'),contents=find('contents'),detail=find('detail'),confirm=find('confirm');
 let formats=[],current=()=>true,revision=0,ready=false;
 const entries=()=>formats.find(item=>item.id===format.value)?.entries??[];
 const entry=()=>entries()[Number(target.value)];
 function drawRows(rows){
  contents.replaceChildren(...rows.map(row=>{
   const li=document.createElement('li');li.textContent=row.label;
   if(row.detail){const small=document.createElement('small');small.textContent=row.detail;li.append(small);}
   return li;
  }));
 }
 async function showEntry(){
  const token=++revision,item=entry();
  ready=!item?.load;
  confirm.textContent=item?.action??'保存する';confirm.disabled=!item||!ready;
  drawRows(item?.rows??[]);
  detail.textContent=item?.load?'出力対象を確認しています…':item?.detail??'';
  if(!item?.load)return;
  try{
   const rows=await item.load();
   if(token!==revision||!dialog.open||!current())return;
   drawRows(rows);detail.textContent=item.detail??'';confirm.disabled=false;ready=true;
  }catch(error){if(token===revision&&dialog.open)detail.textContent=error.message;}
 }
 function showFormat(){
  const choices=entries();
  target.replaceChildren(...choices.map((item,i)=>new Option(item.label,String(i))));
  find('target-label').hidden=choices.length<2;
  showEntry();
 }
 find('cancel').onclick=()=>dialog.close();
 format.onchange=showFormat;target.onchange=showEntry;
 confirm.onclick=()=>{
  const item=entry();
  if(!item||!ready)return;
  if(!current()){
   detail.textContent='出力対象が変わりました。閉じて出力を開き直してください。';
   confirm.disabled=true;return;
  }
  dialog.close();
  item.run();
 };
 dialog.addEventListener('close',()=>{if(!dialog.open)revision++;});
 return {
  get active(){return dialog.open;},
  cancel(){if(dialog.open)dialog.close();},
  open({choices,initial,isCurrent=()=>true}){
   formats=choices.filter(choice=>choice.entries.length);
   if(!formats.length)return;
   current=isCurrent;
   format.replaceChildren(...formats.map(item=>new Option(item.label,item.id)));
   if(formats.some(item=>item.id===initial))format.value=initial;
   if(!dialog.open)dialog.showModal();
   showFormat();format.focus();
  },
 };
}
