// Some embedded browsers cannot display prompt(). Keep the ordinary dialog
// where supported, with an in-page equivalent for those browsers.
export function createProjectSaveName({host=globalThis,document=globalThis.document}={}){
 let dialog=null;
 return async initial=>{
  try{if(typeof host.prompt==='function')return host.prompt('保存するファイル名を入力してください（.forma.json は自動で付きます）',initial);}
  catch{}
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='project-save-dialog';dialog.setAttribute('aria-labelledby','project-save-dialog-title');
   dialog.style.width='min(440px,calc(100vw - 32px))';
   dialog.innerHTML='<form method="dialog"><div class="dialog-heading"><h2 id="project-save-dialog-title">名前を付けて保存</h2></div><label>ファイル名<input id="project-save-name" type="text" autocomplete="off" required></label><p class="hint">.forma.json は自動で付きます</p><div class="editor-actions"><button id="project-save-name-cancel" type="button">キャンセル</button><button class="accent" value="save">保存</button></div></form>';
   document.body.append(dialog);dialog.querySelector('#project-save-name-cancel').onclick=()=>dialog.close('cancel');
  }
  if(dialog.open)return null;
  const input=dialog.querySelector('#project-save-name');input.value=initial;dialog.returnValue='cancel';
  const result=new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='save'?input.value:null),{once:true}));
  dialog.showModal();input.focus();input.select();return result;
 };
}
