const storageKey='forma-command-toolbar-v1';
export function readFavoriteCommands(value){
 const ids=list=>[...new Set(Array.isArray(list)?list.filter(id=>typeof id==='string'&&/^[\w-]{1,80}$/.test(id)):[])].slice(0,100);
 return {favorites:ids(value?.favorites),hidden:ids(value?.hidden),collapsed:value?.collapsed===true};
}
export function installFavoriteCommands({bar,notify=()=>{}}){
 const document=bar.ownerDocument;
 let settings;try{settings=readFavoriteCommands(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{settings=readFavoriteCommands();}
 const open=document.createElement('button');open.id='favorite-commands-open';open.type='button';open.textContent='☆ ツール設定';
 const tabs=bar.parentElement;tabs.insertBefore(open,bar);
 const favorites=document.createElement('nav');favorites.id='favorite-commands';favorites.setAttribute('aria-label','よく使うコマンド');favorites.hidden=true;tabs.after(favorites);
 const dialog=document.createElement('dialog');dialog.id='favorite-commands-dialog';
 dialog.innerHTML='<form><h2>よく使うコマンド</h2><p>「すべて登録」で一括追加、「＋ 登録」で個別追加できます。登録後に↑↓で並べ替えます。変更は「保存」でバーに反映されます。「表示」を外したコマンドは元のバーで非表示になります。</p><label><input type="checkbox" data-collapse> 元のコマンドバーを畳む</label><div data-list></div><p data-status role="status"></p><div class="editor-actions"><button type="button" data-reset>初期設定</button><button type="button" data-cancel>キャンセル</button><button type="submit" class="accent">保存</button></div></form>';
 document.body.append(dialog);
 const style=document.createElement('style');style.textContent='#favorite-commands-dialog [data-order-preview]{padding:9px;border:1px solid #4b7788;border-radius:5px;font-size:13px;max-height:90px;overflow:auto}#favorite-commands-dialog [data-list]>h3{margin:10px 0 5px;font-size:13px;color:#75d6df}#favorite-commands-dialog .favorite-moved{background:#134b5c;outline:1px solid #46cbe0}.command-toolbar[hidden]{display:none!important}#favorite-commands-open{flex:none;font-size:12px;padding:6px 8px;margin-right:6px}#favorite-commands{display:flex;gap:5px;align-items:center;overflow-x:auto;flex:none;padding:5px 16px;background:#172a39;border-bottom:1px solid #354253}#favorite-commands[hidden]{display:none}#favorite-commands button{display:flex;align-items:center;gap:5px;padding:5px 9px;font-size:13px}#favorite-commands svg{width:21px;height:21px}#favorite-commands-dialog{width:min(680px,94vw);max-height:85vh;overflow:auto}#favorite-commands-dialog [data-list]{max-height:50vh;overflow:auto;margin:12px 0}#favorite-commands-dialog .favorite-row{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #8da5b433}#favorite-commands-dialog .favorite-name{flex:1;min-width:0}#favorite-commands-dialog label{display:flex;gap:5px;align-items:center;margin:0}#favorite-commands-dialog input[type=checkbox]{width:auto;margin:0}#favorite-commands-dialog .favorite-row button{padding:4px 8px}';document.head.append(style);
 let catalog=[],signature='',draft=null;const proxies=new Map(),list=dialog.querySelector('[data-list]'),collapse=dialog.querySelector('[data-collapse]'),status=dialog.querySelector('[data-status]');
 const orderPreview=document.createElement('p');orderPreview.dataset.orderPreview='';orderPreview.setAttribute('role','status');list.before(orderPreview);
 const bulk=document.createElement('div');bulk.className='editor-actions';bulk.style.cssText='display:flex;gap:8px;padding:6px 0;background:transparent;position:static';
 const registerAll=document.createElement('button'),clearAll=document.createElement('button');
 registerAll.type=clearAll.type='button';registerAll.textContent='すべて登録';clearAll.textContent='登録をすべて解除';
 registerAll.onclick=()=>{draft.favorites=[...draft.favorites.filter(id=>catalog.some(button=>button.id===id)),...catalog.map(button=>button.id).filter(id=>!draft.favorites.includes(id))];renderRows();list.scrollTop=0;};
 clearAll.onclick=()=>{draft.favorites=[];renderRows();list.scrollTop=0;};
 bulk.append(registerAll,clearAll);orderPreview.before(bulk);
 const label=button=>button.textContent.trim().replace(/^[↔⟳⊖↻↶↷]+\s*/u,'')||button.title||button.id;
 function sync(){
  const available=[...bar.querySelectorAll('button[id]')],nextSignature=available.map(button=>button.id).sort().join('|');
  catalog=available;
  if(nextSignature!==signature){signature=nextSignature;if(dialog.open)renderRows();}
  for(const button of catalog){const hidden=settings.hidden.includes(button.id);button.toggleAttribute('data-user-hidden',hidden);if(hidden)button.hidden=true;}
  bar.hidden=settings.collapsed;
  const ordered=settings.favorites.map(id=>catalog.find(button=>button.id===id)).filter(Boolean);
  for(const [id,proxy] of proxies)if(!ordered.some(button=>button.id===id)){proxy.remove();proxies.delete(id);}
  for(const original of ordered){
   let proxy=proxies.get(original.id);if(!proxy){proxy=document.createElement('button');proxy.type='button';proxy.dataset.favoriteCommand=original.id;proxy.onclick=()=>original.click();proxies.set(original.id,proxy);}
   if(proxy.innerHTML!==original.innerHTML){proxy.innerHTML=original.innerHTML;for(const el of proxy.querySelectorAll('[id]'))el.removeAttribute('id');}
   proxy.title=original.title;proxy.disabled=original.disabled;proxy.setAttribute('aria-disabled',original.getAttribute('aria-disabled')||'false');
   proxy.classList.toggle('active',original.classList.contains('active'));
   if(original.hasAttribute('aria-pressed'))proxy.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));else proxy.removeAttribute('aria-pressed');
   favorites.append(proxy);
  }
  favorites.hidden=!ordered.length;
 }
 function renderRows(movedId=null){
  if(!draft)return;list.replaceChildren();
  const registered=draft.favorites.filter(id=>catalog.some(button=>button.id===id));
  orderPreview.textContent=registered.length?'登録する順番：'+registered.map((id,index)=>(index+1)+'. '+label(catalog.find(button=>button.id===id))).join(' → '):'まだ登録されていません。使いたいコマンドの「＋ 登録」を押してください。';
  const ordered=[...draft.favorites,...catalog.map(b=>b.id).filter(id=>!draft.favorites.includes(id))];
  let previousGroup=null;
  for(const id of ordered){const command=catalog.find(b=>b.id===id);if(!command)continue;
   const index=draft.favorites.indexOf(id),group=index<0?'未登録':'登録済み（↑↓で並べ替え）';
   if(group!==previousGroup){const heading=document.createElement('h3');heading.textContent=group;list.append(heading);previousGroup=group;}
   const row=document.createElement('div');row.className='favorite-row';row.dataset.command=id;
   const star=document.createElement('button');star.type='button';star.textContent=index>=0?'★':'☆';star.setAttribute('aria-label',label(command)+(index>=0?'の登録を解除':'を登録'));star.setAttribute('aria-pressed',String(index>=0));
   star.onclick=()=>{draft.favorites=draft.favorites.includes(id)?draft.favorites.filter(value=>value!==id):[...draft.favorites,id];renderRows();};
   const name=document.createElement('span');name.className='favorite-name';name.textContent=(index>=0?(index+1)+'. ':'')+label(command);
   const show=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!draft.hidden.includes(id);check.setAttribute('aria-label',label(command)+'を元のバーに表示');check.onchange=()=>{draft.hidden=draft.hidden.filter(value=>value!==id);if(!check.checked)draft.hidden.push(id);};show.append(check,'表示');row.append(star,name,show);
   if(index<0){
    const register=document.createElement('button');register.type='button';register.textContent='＋ 登録';register.setAttribute('aria-label',label(command)+'を登録する');register.title='登録すると↑↓で順番を変更できます';
    register.onclick=()=>{draft.favorites.push(id);renderRows(id);};row.append(register);
   }else for(const [text,step]of [['↑',-1],['↓',1]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label(command)+(step<0?'を前へ':'を後へ'));button.disabled=index+step<0||index+step>=draft.favorites.length;button.title=button.disabled?(step<0?'先頭です':'最後です'):(step<0?'1つ前へ移動':'1つ後へ移動');button.onclick=()=>{[draft.favorites[index],draft.favorites[index+step]]=[draft.favorites[index+step],draft.favorites[index]];renderRows(id);const next=list.querySelector('[data-command="'+id+'"] button[aria-label="'+button.getAttribute('aria-label')+'"]');if(next&&!next.disabled)next.focus({preventScroll:true});};row.append(button);}
   if(id===movedId)row.classList.add('favorite-moved');
   list.append(row);
  }
  if(movedId)list.querySelector('[data-command="'+movedId+'"]')?.scrollIntoView({block:'nearest'});
 }
 open.onclick=()=>{sync();draft=readFavoriteCommands(settings);collapse.checked=draft.collapsed;status.textContent='';renderRows();dialog.showModal();};
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-reset]').onclick=()=>{draft=readFavoriteCommands();collapse.checked=false;renderRows();};
 dialog.querySelector('form').onsubmit=event=>{
  event.preventDefault();draft.collapsed=collapse.checked;
  if(draft.collapsed&&!draft.favorites.some(id=>catalog.some(b=>b.id===id))){status.textContent='バーを畳む前にコマンドを1つ以上登録してください';return;}
  try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{status.textContent='設定を保存できませんでした。ブラウザーの保存設定を確認してください';return;}
  for(const original of catalog)if(settings.hidden.includes(original.id)&&!draft.hidden.includes(original.id))original.hidden=false;
  settings=readFavoriteCommands(draft);sync();window.dispatchEvent(new Event('resize'));dialog.close();notify('ツールバーの設定を保存しました');
 };
 let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});}).observe(bar,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-disabled','aria-pressed','title','class']});
 sync();return {sync};
}
