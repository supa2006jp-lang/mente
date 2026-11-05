import {readCommandUsage,orderFavoriteCommands,moveFavoriteCommand} from './favorite-command-order.js';
import {fitCommandToolbar} from './command-toolbar.js';
import {readCommandColors,applyCommandColor} from './favorite-command-colors.js';
const storageKey='forma-command-toolbar-v1';
const usageKey='forma-command-usage-v1';
export function readFavoriteCommands(value){
 const ids=list=>[...new Set(Array.isArray(list)?list.filter(id=>typeof id==='string'&&/^[\w-]{1,80}$/.test(id)):[])].slice(0,100);
 return {favorites:ids(value?.favorites),hidden:ids(value?.hidden),collapsed:value?.collapsed===true,autoSort:value?.autoSort===true,colors:readCommandColors(value?.colors)};
}
export function installFavoriteCommands({bar,notify=()=>{}}){
 const document=bar.ownerDocument;
 let settings;try{settings=readFavoriteCommands(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{settings=readFavoriteCommands();}
 let usage;try{usage=readCommandUsage(JSON.parse(localStorage.getItem(usageKey)||'null'));}catch{usage={};}
 let invokingFavorite=null;
 const open=document.createElement('button');open.id='favorite-commands-open';open.type='button';open.textContent='☆ ツール設定';
 const tabs=bar.parentElement;tabs.insertBefore(open,bar);
 const favorites=document.createElement('nav');favorites.id='favorite-commands';favorites.setAttribute('aria-label','よく使うコマンド');favorites.hidden=true;tabs.after(favorites);
 const dialog=document.createElement('dialog');dialog.id='favorite-commands-dialog';
 dialog.innerHTML='<form><h2>よく使うコマンド</h2><p>「すべて登録」で一括追加、「＋ 登録」で個別追加できます。登録後にドラッグまたは↑↓で並べ替えます。変更は「保存」でバーに反映されます。「表示」を外したコマンドは元のバーで非表示になります。</p><label><input type="checkbox" data-collapse> 元のコマンドバーを畳む</label><div data-list></div><p data-status role="status"></p><div class="editor-actions"><button type="button" data-reset>初期設定</button><button type="button" data-cancel>キャンセル</button><button type="submit" class="accent">保存</button></div></form>';
 document.body.append(dialog);
 dialog.querySelector('form>p').append(' 各コマンドの「色」で背景色を選べます。「標準」で元の色に戻せます。');
 const colorStyle=document.createElement('style');
 colorStyle.textContent='#favorite-commands button[data-command-color],#favorite-commands-dialog .favorite-name[data-command-color]{background:var(--favorite-bg);color:var(--favorite-fg);border-color:var(--favorite-fg)}#favorite-commands button[data-command-color] :is(span,svg){color:inherit}#favorite-commands button[data-command-color]:hover:not(:disabled){filter:brightness(1.12)}#favorite-commands button[data-command-color]:is(.active,[aria-pressed=true]){box-shadow:inset 0 0 0 2px var(--favorite-fg)}#favorite-commands-dialog .favorite-name[data-command-color]{padding:4px 6px;border-radius:4px}#favorite-commands-dialog .favorite-color{font-size:12px;flex:none}#favorite-commands-dialog input[type=color]{width:30px;height:28px;padding:2px;margin:0;cursor:pointer;border-radius:4px}#favorite-commands-dialog [data-color-reset]{font-size:11px;padding:4px}';
 document.head.append(colorStyle);
 const style=document.createElement('style');style.textContent='#favorite-commands-dialog{box-sizing:border-box;padding:20px;border:1px solid #456176;border-radius:10px;background:#142232;color:#e2edf5;overflow:hidden}#favorite-commands-dialog form{padding:0;display:flex;flex-direction:column;max-height:calc(85vh - 42px);min-height:0}#favorite-commands-dialog form>:not([data-list]){flex-shrink:0}#favorite-commands-dialog form>h2{margin:0 0 10px}#favorite-commands-dialog form>p{margin:8px 0;font-size:13px;line-height:1.5}#favorite-commands-dialog form>small{font-size:12px;line-height:1.4}#favorite-commands-dialog form>.editor-actions{position:static;padding:8px 0 0}#favorite-commands-dialog [data-list]{flex:1 1 auto;min-height:0}#favorite-commands-dialog .favorite-name[draggable=true],#favorite-commands-dialog .favorite-drag-handle{cursor:grab;user-select:none}#favorite-commands-dialog .favorite-drag-handle{font-size:21px;color:#74d4e1}#favorite-commands-dialog .favorite-dragging{opacity:.45}#favorite-commands-dialog .favorite-drop-before{box-shadow:inset 0 3px #46cbe0}#favorite-commands-dialog .favorite-drop-after{box-shadow:inset 0 -3px #46cbe0}#favorite-commands-dialog [data-order-preview]{padding:9px;border:1px solid #4b7788;border-radius:5px;font-size:13px;max-height:90px;overflow:auto}#favorite-commands-dialog [data-list]>h3{margin:10px 0 5px;font-size:13px;color:#75d6df}#favorite-commands-dialog .favorite-moved{background:#134b5c;outline:1px solid #46cbe0}.command-toolbar[hidden]{display:none!important}#favorite-commands-open{flex:none;font-size:12px;padding:6px 8px;margin-right:6px}#favorite-commands{display:flex;flex-direction:column;gap:3px;align-items:stretch;overflow-x:auto;flex:none;padding:5px 16px;background:#172a39;border-bottom:1px solid #354253}#favorite-commands[hidden]{display:none}#favorite-commands .command-row{display:flex;align-items:center;gap:5px;min-height:34px;min-width:100%;width:max-content;flex-shrink:0}#favorite-commands .command-row>button{flex-shrink:0}#favorite-commands button{display:flex;align-items:center;gap:5px;padding:5px 9px;font-size:13px}#favorite-commands svg{width:21px;height:21px}#favorite-commands-dialog{width:min(680px,94vw);max-height:85vh}#favorite-commands-dialog [data-list]{max-height:50vh;overflow:auto;margin:12px 0}#favorite-commands-dialog .favorite-row{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #8da5b433}#favorite-commands-dialog .favorite-name{flex:1;min-width:0}#favorite-commands-dialog label{display:flex;gap:5px;align-items:center;margin:0}#favorite-commands-dialog input[type=checkbox]{width:auto;margin:0}#favorite-commands-dialog .favorite-row button{padding:4px 8px}';document.head.append(style);
 let catalog=[],signature='',draft=null;const proxies=new Map(),list=dialog.querySelector('[data-list]'),collapse=dialog.querySelector('[data-collapse]'),status=dialog.querySelector('[data-status]');
 const orderPreview=document.createElement('p');orderPreview.dataset.orderPreview='';orderPreview.setAttribute('role','status');list.before(orderPreview);
 const autoLabel=document.createElement('label');autoLabel.style.margin='8px 0';
 const autoSort=document.createElement('input');autoSort.type='checkbox';autoSort.dataset.autoSort='';autoLabel.append(autoSort,' 使用頻度順に自動で並べる');orderPreview.before(autoLabel);
 const autoHelp=document.createElement('small');autoHelp.textContent='バーのボタンを使った回数で並べます。同数なら現在の順番を保ちます。ドラッグや↑↓で動かすと自動並べ替えはオフになります。';autoLabel.after(autoHelp);
 const registeredOrder=state=>{const ids=state.favorites.filter(id=>catalog.some(button=>button.id===id));return state.autoSort?orderFavoriteCommands(ids,usage):ids;};
 autoSort.onchange=()=>{const current=registeredOrder(draft);draft.autoSort=autoSort.checked;if(!draft.autoSort)draft.favorites=current;renderRows();};
 const bulk=document.createElement('div');bulk.className='editor-actions';bulk.style.cssText='display:flex;gap:8px;padding:6px 0;background:transparent;position:static';
 const registerAll=document.createElement('button'),clearAll=document.createElement('button');
 registerAll.type=clearAll.type='button';registerAll.textContent='すべて登録';clearAll.textContent='登録をすべて解除';
 registerAll.onclick=()=>{draft.favorites=[...draft.favorites.filter(id=>catalog.some(button=>button.id===id)),...catalog.map(button=>button.id).filter(id=>!draft.favorites.includes(id))];renderRows();list.scrollTop=0;};
 clearAll.onclick=()=>{draft.favorites=[];renderRows();list.scrollTop=0;};
 bulk.append(registerAll,clearAll);orderPreview.before(bulk);
 const label=button=>button.textContent.trim().replace(/^[↔⟳⊖↻↶↷]+\s*/u,'')||button.title||button.id;
 let drag=null,dragFrame=null;
 function clearDrop(){for(const row of list.querySelectorAll('.favorite-drop-before,.favorite-drop-after'))row.classList.remove('favorite-drop-before','favorite-drop-after');if(drag)drag.target=null;}
 function clearDrag(){
  clearDrop();drag=null;if(dragFrame!==null)cancelAnimationFrame(dragFrame);dragFrame=null;
  for(const row of list.querySelectorAll('.favorite-dragging'))row.classList.remove('favorite-dragging');
 }
 function updateDrop(x,y){
  clearDrop();if(!drag)return false;
  const row=document.elementFromPoint(x,y)?.closest('.favorite-row');
  if(!row||!list.contains(row)||!draft.favorites.includes(row.dataset.command)||row.dataset.command===drag.id)return false;
  const rect=row.getBoundingClientRect(),before=y<rect.top+rect.height/2;
  drag.target={id:row.dataset.command,before};row.classList.add(before?'favorite-drop-before':'favorite-drop-after');return true;
 }
 function scrollDrag(){
  dragFrame=null;if(!drag)return;
  const rect=list.getBoundingClientRect();
  if(drag.x>=rect.left&&drag.x<=rect.right&&drag.y>=rect.top&&drag.y<=rect.bottom){
   const amount=drag.y<rect.top+28?-Math.ceil((rect.top+28-drag.y)/2):drag.y>rect.bottom-28?Math.ceil((drag.y-rect.bottom+28)/2):0;
   const before=list.scrollTop;if(amount)list.scrollTop+=amount;if(before!==list.scrollTop)updateDrop(drag.x,drag.y);
  }
  dragFrame=requestAnimationFrame(scrollDrag);
 }
 list.addEventListener('dragstart',event=>{
  const handle=event.target.closest('[data-favorite-drag]'),row=handle?.closest('.favorite-row');
  if(!row||!draft.favorites.includes(row.dataset.command)||!event.dataTransfer){event.preventDefault();return;}
  clearDrag();drag={id:row.dataset.command,x:event.clientX,y:event.clientY,target:null};
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',drag.id);event.dataTransfer.setDragImage(row,20,row.offsetHeight/2);
  row.classList.add('favorite-dragging');dragFrame=requestAnimationFrame(scrollDrag);
 });
 list.addEventListener('dragover',event=>{
  if(!drag)return;drag.x=event.clientX;drag.y=event.clientY;
  if(updateDrop(drag.x,drag.y)){event.preventDefault();event.dataTransfer.dropEffect='move';}
 });
 list.addEventListener('drop',event=>{
  if(!drag||!updateDrop(event.clientX,event.clientY))return;
  event.preventDefault();event.stopPropagation();const {id,target}=drag;
  draft.favorites=moveFavoriteCommand(registeredOrder(draft),id,target.id,target.before);draft.autoSort=false;
  clearDrag();renderRows(id);
 });
 list.addEventListener('dragend',clearDrag);dialog.addEventListener('close',clearDrag);
 document.addEventListener('dragover',event=>{if(drag&&!list.contains(event.target)){drag.x=event.clientX;drag.y=event.clientY;clearDrop();}});
 function sync(){
  const available=[...bar.querySelectorAll('button[id]')],nextSignature=available.map(button=>button.id).sort().join('|');
  catalog=available;
  if(nextSignature!==signature){signature=nextSignature;if(dialog.open)renderRows();}
  for(const button of catalog){const hidden=settings.hidden.includes(button.id);button.toggleAttribute('data-user-hidden',hidden);if(hidden)button.hidden=true;}
  bar.hidden=settings.collapsed;
  const ordered=registeredOrder(settings).map(id=>catalog.find(button=>button.id===id));
  for(const [id,proxy] of proxies)if(!ordered.some(button=>button.id===id)){proxy.remove();proxies.delete(id);}
  for(const original of ordered){
   let proxy=proxies.get(original.id);if(!proxy){proxy=document.createElement('button');proxy.type='button';proxy.dataset.favoriteCommand=original.id;proxy.onclick=()=>{invokingFavorite=original.id;try{original.click();}finally{invokingFavorite=null;}};proxies.set(original.id,proxy);}
   if(proxy.innerHTML!==original.innerHTML){proxy.innerHTML=original.innerHTML;for(const el of proxy.querySelectorAll('[id]'))el.removeAttribute('id');}
   proxy.title=original.title;proxy.disabled=original.disabled;proxy.setAttribute('aria-disabled',original.getAttribute('aria-disabled')||'false');
   proxy.classList.toggle('active',original.classList.contains('active'));
   if(original.hasAttribute('aria-pressed'))proxy.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));else proxy.removeAttribute('aria-pressed');
   applyCommandColor(proxy,settings.colors[original.id]);
  }
  // Keep the two-row layout intact when only command state has changed.
  const desired=ordered.map(original=>proxies.get(original.id));
  const current=[...favorites.querySelectorAll('[data-favorite-command]')];
  if(current.length!==desired.length||desired.some((proxy,index)=>proxy!==current[index]))favorites.append(...desired);
  favorites.hidden=!ordered.length;
 }
 function renderRows(movedId=null){
  if(!draft)return;clearDrag();list.replaceChildren();autoSort.checked=draft.autoSort;
  const registered=registeredOrder(draft);
  orderPreview.textContent=registered.length?'登録する順番：'+registered.map((id,index)=>(index+1)+'. '+label(catalog.find(button=>button.id===id))).join(' → '):'まだ登録されていません。使いたいコマンドの「＋ 登録」を押してください。';
  const ordered=[...registered,...catalog.map(b=>b.id).filter(id=>!draft.favorites.includes(id))];
  let previousGroup=null;
  for(const id of ordered){const command=catalog.find(b=>b.id===id);if(!command)continue;
   const index=registered.indexOf(id),group=index<0?'未登録':'登録済み（ドラッグ・↑↓で並べ替え）';
   if(group!==previousGroup){const heading=document.createElement('h3');heading.textContent=group;list.append(heading);previousGroup=group;}
   const row=document.createElement('div');row.className='favorite-row';row.dataset.command=id;
   const star=document.createElement('button');star.type='button';star.textContent=index>=0?'★':'☆';star.setAttribute('aria-label',label(command)+(index>=0?'の登録を解除':'を登録'));star.setAttribute('aria-pressed',String(index>=0));
   star.onclick=()=>{draft.favorites=draft.favorites.includes(id)?draft.favorites.filter(value=>value!==id):[...draft.favorites,id];renderRows();};
   const name=document.createElement('span');name.className='favorite-name';name.textContent=(index>=0?(index+1)+'. ':'')+label(command);
   if(index>=0&&draft.autoSort){const count=document.createElement('small');count.textContent=' · '+(usage[id]||0)+'回';count.style.color='#8faebc';name.append(count);}
   if(index>=0){const grip=document.createElement('span');grip.className='favorite-drag-handle';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');for(const handle of [grip,name]){handle.draggable=true;handle.dataset.favoriteDrag='';handle.title='ドラッグして並べ替え';}row.append(grip);}
   const show=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!draft.hidden.includes(id);check.setAttribute('aria-label',label(command)+'を元のバーに表示');check.onchange=()=>{draft.hidden=draft.hidden.filter(value=>value!==id);if(!check.checked)draft.hidden.push(id);};show.append(check,'表示');row.append(star,name,show);
   const colorLabel=document.createElement('label');colorLabel.className='favorite-color';
   const color=document.createElement('input');color.type='color';color.value=draft.colors[id]||'#202c3a';color.setAttribute('aria-label',label(command)+'の背景色');color.title='コマンドの背景色（文字色は自動調整）';
   const resetColor=document.createElement('button');resetColor.type='button';resetColor.dataset.colorReset='';resetColor.textContent='標準';resetColor.setAttribute('aria-label',label(command)+'の色を標準に戻す');resetColor.disabled=!draft.colors[id];
   color.oninput=()=>{draft.colors[id]=color.value;applyCommandColor(name,color.value);resetColor.disabled=false;};
   resetColor.onclick=()=>{delete draft.colors[id];color.value='#202c3a';applyCommandColor(name,null);resetColor.disabled=true;};
   applyCommandColor(name,draft.colors[id]);colorLabel.append('色',color);row.append(colorLabel,resetColor);
   if(index<0){
    const register=document.createElement('button');register.type='button';register.textContent='＋ 登録';register.setAttribute('aria-label',label(command)+'を登録する');register.title='登録すると↑↓で順番を変更できます';
    register.onclick=()=>{draft.favorites.push(id);renderRows(id);};row.append(register);
   }else for(const [text,step]of [['↑',-1],['↓',1]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label(command)+(step<0?'を前へ':'を後へ'));button.disabled=index+step<0||index+step>=registered.length;button.title=button.disabled?(step<0?'先頭です':'最後です'):(step<0?'1つ前へ移動':'1つ後へ移動');button.onclick=()=>{draft.favorites=[...registered];draft.autoSort=false;[draft.favorites[index],draft.favorites[index+step]]=[draft.favorites[index+step],draft.favorites[index]];renderRows(id);const next=list.querySelector('[data-command="'+id+'"] button[aria-label="'+button.getAttribute('aria-label')+'"]');if(next&&!next.disabled)next.focus({preventScroll:true});};row.append(button);}
   if(id===movedId)row.classList.add('favorite-moved');
   list.append(row);
  }
  if(movedId)list.querySelector('[data-command="'+movedId+'"]')?.scrollIntoView({block:'nearest'});
 }
 open.onclick=()=>{sync();draft=readFavoriteCommands(settings);collapse.checked=draft.collapsed;status.textContent='';renderRows();dialog.showModal();};
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-reset]').onclick=()=>{draft=readFavoriteCommands();collapse.checked=false;renderRows();};
 dialog.querySelector('form').onsubmit=event=>{
  event.preventDefault();draft.collapsed=collapse.checked;draft.autoSort=autoSort.checked;draft.favorites=registeredOrder(draft);
  if(draft.collapsed&&!draft.favorites.some(id=>catalog.some(b=>b.id===id))){status.textContent='バーを畳む前にコマンドを1つ以上登録してください';return;}
  try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{status.textContent='設定を保存できませんでした。ブラウザーの保存設定を確認してください';return;}
  for(const original of catalog)if(settings.hidden.includes(original.id)&&!draft.hidden.includes(original.id))original.hidden=false;
  settings=readFavoriteCommands(draft);sync();window.dispatchEvent(new Event('resize'));dialog.close();notify('ツールバーの設定を保存しました');
 };
 bar.addEventListener('click',event=>{
  const button=event.target.closest('button[id]');
  if(!button||!bar.contains(button)||button.disabled||button.getAttribute('aria-disabled')==='true'||!event.isTrusted&&invokingFavorite!==button.id)return;
  usage[button.id]=Math.min(Number.MAX_SAFE_INTEGER,(usage[button.id]||0)+1);
  try{localStorage.setItem(usageKey,JSON.stringify(usage));}catch{}
  if(settings.autoSort){settings.favorites=registeredOrder(settings);try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}sync();}
 },{capture:true});
 let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});}).observe(bar,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-disabled','aria-pressed','title','class']});
 fitCommandToolbar(favorites);sync();return {sync};
}
