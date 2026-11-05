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
 return function open({name,color,canReset,onApply}){
  dialog.querySelector('#body-color-name').textContent=name;
  input.value=color;
  reset.disabled=!canReset;
  apply=onApply;
  dialog.showModal();
 };
}
