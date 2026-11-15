export function createBodyRenameDialog(){
 const dialog=document.createElement('dialog');
 dialog.id='body-rename-dialog';
 dialog.setAttribute('aria-labelledby','body-rename-title');
 dialog.innerHTML='<form><div class="dialog-heading"><h2 id="body-rename-title">ボディの名前を変更</h2></div><label>ボディ名<input id="body-rename-name" type="text" required maxlength="100" autocomplete="off"></label><div class="editor-actions"><button type="button" data-cancel>キャンセル</button><button class="accent" type="submit">変更する</button></div></form>';
 document.body.append(dialog);
 const input=dialog.querySelector('input');
 let apply;
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=event=>{
  event.preventDefault();
  const name=input.value.trim();
  if(!name){
   input.setCustomValidity('ボディ名を入力してください');
   input.reportValidity();
   return;
  }
  dialog.close();
  apply(name);
 };
 input.oninput=()=>input.setCustomValidity('');
 return (name,onApply)=>{
  if(dialog.open)return;
  apply=onApply;
  input.setCustomValidity('');
  input.value=name;
  dialog.showModal();
  input.focus();
  input.select();
 };
}
