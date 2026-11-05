import {readCommandUsage,orderFavoriteCommands,moveFavoriteCommand} from './favorite-command-order.js';
import {fitCommandToolbar} from './command-toolbar.js';
import {applyCommandColor} from './favorite-command-colors.js';
import {readFavoriteCommands,exportCommandSettings,importCommandSettings,saveCommandSettings} from './favorite-command-settings.js';
import {installFavoriteBarEdit,favoriteBarEditHint} from './favorite-command-bar-edit.js';
export {readFavoriteCommands} from './favorite-command-settings.js';
const storageKey='forma-command-toolbar-v1';
const usageKey='forma-command-usage-v1';
export function installFavoriteCommands({bar,notify=()=>{}}){
 const document=bar.ownerDocument;
 let settings;try{settings=readFavoriteCommands(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{settings=readFavoriteCommands();}
 let usage;try{usage=readCommandUsage(JSON.parse(localStorage.getItem(usageKey)||'null'));}catch{usage={};}
 let invokingFavorite=null,barEditor;
 const open=document.createElement('button');open.id='favorite-commands-open';open.type='button';open.textContent='☆ ツール設定';
 const tabs=bar.parentElement;tabs.insertBefore(open,bar);
 const favorites=document.createElement('nav');favorites.id='favorite-commands';favorites.setAttribute('aria-label','よく使うコマンド');favorites.hidden=true;tabs.after(favorites);
 const dialog=document.createElement('dialog');dialog.id='favorite-commands-dialog';
 dialog.innerHTML='<form><h2>よく使うコマンド</h2><details data-help><summary>操作ガイド</summary><p>「すべて登録」で一括追加、「＋ 登録」で個別追加。登録後にドラッグまたは↑↓で並べ替えます。「表示」を外すと元のバーで非表示になります。各行の「色」で背景色、「標準」で元の色に戻せます。変更・読み込みは「保存」で反映します。</p></details><div data-options><label><input type="checkbox" data-collapse> 元のコマンドバーを畳む</label></div><div data-list></div><p data-status role="status"></p><div class="editor-actions"><button type="button" data-reset>初期設定</button><button type="button" data-cancel>キャンセル</button><button type="submit" class="accent">保存</button></div></form>';
 document.body.append(dialog);
 dialog.querySelector('[data-help] p').append(' コマンドバー上でもドラッグで並べ替え、右クリックで色変更・登録解除できます。バー上の変更は自動保存されます。');
 const colorStyle=document.createElement('style');
 colorStyle.textContent='#favorite-commands button[data-command-color],#favorite-commands-dialog .favorite-name[data-command-color]{background:var(--favorite-bg);color:var(--favorite-fg);border-color:var(--favorite-fg)}#favorite-commands button[data-command-color] :is(span,svg){color:inherit}#favorite-commands button[data-command-color]:hover:not(:disabled){filter:brightness(1.12)}#favorite-commands button[data-command-color]:is(.active,[aria-pressed=true]){box-shadow:inset 0 0 0 2px var(--favorite-fg)}#favorite-commands-dialog .favorite-name[data-command-color]{padding:4px 6px;border-radius:4px}#favorite-commands-dialog .favorite-color{font-size:12px;flex:none}#favorite-commands-dialog input[type=color]{width:30px;height:28px;padding:2px;margin:0;cursor:pointer;border-radius:4px}#favorite-commands-dialog [data-color-reset]{font-size:11px;padding:4px}';
 document.head.append(colorStyle);
 const style=document.createElement('style');style.textContent='#favorite-commands-dialog{box-sizing:border-box;padding:20px;border:1px solid #456176;border-radius:10px;background:#142232;color:#e2edf5;overflow:hidden}#favorite-commands-dialog form{padding:0;display:flex;flex-direction:column;max-height:calc(85vh - 42px);min-height:0}#favorite-commands-dialog form>:not([data-list]){flex-shrink:0}#favorite-commands-dialog form>h2{margin:0 0 10px}#favorite-commands-dialog form>p{margin:8px 0;font-size:13px;line-height:1.5}#favorite-commands-dialog form>small{font-size:12px;line-height:1.4}#favorite-commands-dialog form>.editor-actions{position:static;padding:8px 0 0}#favorite-commands-dialog [data-list]{flex:1 1 auto;min-height:0}#favorite-commands-dialog .favorite-name[draggable=true],#favorite-commands-dialog .favorite-drag-handle{cursor:grab;user-select:none}#favorite-commands-dialog .favorite-drag-handle{font-size:21px;color:#74d4e1}#favorite-commands-dialog .favorite-dragging{opacity:.45}#favorite-commands-dialog .favorite-drop-before{box-shadow:inset 0 3px #46cbe0}#favorite-commands-dialog .favorite-drop-after{box-shadow:inset 0 -3px #46cbe0}#favorite-commands-dialog [data-order-preview]{padding:9px;border:1px solid #4b7788;border-radius:5px;font-size:13px;max-height:90px;overflow:auto}#favorite-commands-dialog [data-list]>h3{margin:10px 0 5px;font-size:13px;color:#75d6df}#favorite-commands-dialog .favorite-moved{background:#134b5c;outline:1px solid #46cbe0}.command-toolbar[hidden]{display:none!important}#favorite-commands-open{flex:none;font-size:12px;padding:6px 8px;margin-right:6px}#favorite-commands{display:flex;flex-direction:column;gap:3px;align-items:stretch;overflow-x:auto;flex:none;padding:5px 16px;background:#172a39;border-bottom:1px solid #354253}#favorite-commands[hidden]{display:none}#favorite-commands .command-row{display:flex;align-items:center;gap:5px;min-height:34px;min-width:100%;width:max-content;flex-shrink:0}#favorite-commands .command-row>button{flex-shrink:0}#favorite-commands button{display:flex;align-items:center;gap:5px;padding:5px 9px;font-size:13px}#favorite-commands svg{width:21px;height:21px}#favorite-commands-dialog{width:min(680px,94vw);max-height:85vh}#favorite-commands-dialog [data-list]{max-height:50vh;overflow:auto;margin:12px 0}#favorite-commands-dialog .favorite-row{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #8da5b433}#favorite-commands-dialog .favorite-name{flex:1;min-width:0}#favorite-commands-dialog label{display:flex;gap:5px;align-items:center;margin:0}#favorite-commands-dialog input[type=checkbox]{width:auto;margin:0}#favorite-commands-dialog .favorite-row button{padding:4px 8px}';document.head.append(style);
 style.textContent+=`
 #favorite-commands-dialog{width:min(920px,96vw);max-height:90dvh;padding:14px}
 #favorite-commands-dialog form{max-height:calc(90dvh - 30px);height:min(780px,calc(90dvh - 30px))}
 #favorite-commands-dialog form>h2{font-size:19px;margin:0 0 6px}
 #favorite-commands-dialog details{font-size:12px;margin:3px 0}
 #favorite-commands-dialog summary{cursor:pointer;color:#91c5da}
 #favorite-commands-dialog [data-help] p{line-height:1.5;margin:6px 0}
 #favorite-commands-dialog [data-options],#favorite-commands-dialog [data-bulk-colors]{display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;margin:5px 0;font-size:12px}
 #favorite-commands-dialog [data-bulk-colors]{gap:6px;padding:7px;background:#1c3040;border-radius:5px}
 #favorite-commands-dialog [data-bulk-colors] button{font-size:12px;padding:5px 8px}
 #favorite-commands-dialog [data-list]{max-height:none;margin:5px 0}
 #favorite-commands-dialog [data-list]>h3{margin:7px 0 4px}
 #favorite-commands-dialog .favorite-row{gap:7px;padding:4px 2px;min-height:36px}
 #favorite-commands-dialog .favorite-color-selected{background:#244455}
 #favorite-commands-dialog [data-bulk-select]{flex:none;accent-color:#46cbe0}
 #favorite-commands-dialog .favorite-name[data-command-color] small{color:inherit!important}
 #favorite-commands-dialog [data-status]:empty{display:none}
 #favorite-commands-dialog [data-order-preview]{margin:5px 0;padding:6px;max-height:75px}
 #favorite-commands .command-row{min-height:32px}
 #favorite-commands{padding:4px 12px;gap:2px}
 #favorite-commands .command-row[hidden]{display:none!important}
 @media(max-width:650px){#favorite-commands-dialog .favorite-row{flex-wrap:wrap;gap:5px}#favorite-commands-dialog .favorite-name{min-width:calc(100% - 110px)}#favorite-commands-dialog [data-bulk-colors]{gap:5px}#favorite-commands-dialog form{height:calc(90dvh - 30px)}}`;
 let catalog=[],signature='',draft=null,draftUsage={};const selected=new Set(),proxies=new Map(),list=dialog.querySelector('[data-list]'),collapse=dialog.querySelector('[data-collapse]'),status=dialog.querySelector('[data-status]');
 const orderDetails=document.createElement('details');orderDetails.dataset.orderDetails='';orderDetails.innerHTML='<summary>並び順を確認</summary>';list.before(orderDetails);
 const orderPreview=document.createElement('p');orderPreview.dataset.orderPreview='';orderPreview.setAttribute('role','status');orderDetails.append(orderPreview);
 const autoLabel=document.createElement('label');autoLabel.style.margin='0';
 const autoSort=document.createElement('input');autoSort.type='checkbox';autoSort.dataset.autoSort='';autoLabel.append(autoSort,' 使用頻度順に自動で並べる');dialog.querySelector('[data-options]').append(autoLabel);
 const autoHelp=document.createElement('small');autoHelp.textContent='使用回数が同じなら現在の順番を保ちます。ドラッグや↑↓で動かすと自動並べ替えはオフになります。設定ファイルには並び順・色・表示設定・使用回数を保存します。';dialog.querySelector('[data-help]').append(autoHelp);
 const registeredOrder=state=>{const ids=state.favorites.filter(id=>catalog.some(button=>button.id===id));return state.autoSort?orderFavoriteCommands(ids,state===draft?draftUsage:usage):ids;};
 autoSort.onchange=()=>{const current=registeredOrder(draft);draft.autoSort=autoSort.checked;if(!draft.autoSort)draft.favorites=current;renderRows();};
 const bulk=document.createElement('div');bulk.className='editor-actions';bulk.style.cssText='display:flex;gap:8px;padding:6px 0;background:transparent;position:static';
 const registerAll=document.createElement('button'),clearAll=document.createElement('button');
 registerAll.type=clearAll.type='button';registerAll.textContent='すべて登録';clearAll.textContent='登録をすべて解除';
 registerAll.onclick=()=>{draft.favorites=[...draft.favorites.filter(id=>catalog.some(button=>button.id===id)),...catalog.map(button=>button.id).filter(id=>!draft.favorites.includes(id))];renderRows();list.scrollTop=0;};
 clearAll.onclick=()=>{draft.favorites=[];renderRows();list.scrollTop=0;};
 bulk.append(registerAll,clearAll);orderDetails.before(bulk);
 const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;fileInput.dataset.settingsFile='';
 const exportButton=document.createElement('button'),importButton=document.createElement('button');exportButton.type=importButton.type='button';exportButton.textContent='設定を書き出す';importButton.textContent='設定を読み込む';
 bulk.append(exportButton,importButton,fileInput);
 exportButton.onclick=()=>{
  const value=exportCommandSettings({...draft,favorites:registeredOrder(draft),collapsed:collapse.checked},draftUsage),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='forma-command-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status.textContent='現在の設定を書き出しました。';
 };
 importButton.onclick=()=>fileInput.click();
 fileInput.onchange=async()=>{
  const file=fileInput.files[0],targetDraft=draft;fileInput.value='';if(!file)return;
  try{
   if(file.size>65536)throw Error('設定ファイルは64 KB以内にしてください');
   const value=importCommandSettings(await file.text());if(!dialog.open||draft!==targetDraft)return;
   const ids=new Set(catalog.map(button=>button.id)),unknown=value.settings.favorites.filter(id=>!ids.has(id));
   if(value.settings.favorites.length&&!value.settings.favorites.some(id=>ids.has(id)))throw Error('この画面で使えるコマンドが設定に含まれていません');
   draft=readFavoriteCommands({...value.settings,favorites:value.settings.favorites.filter(id=>ids.has(id)),hidden:value.settings.hidden.filter(id=>ids.has(id)),colors:Object.fromEntries(Object.entries(value.settings.colors).filter(([id])=>ids.has(id)))});
   draftUsage=readCommandUsage(value.usage);collapse.checked=draft.collapsed;selected.clear();renderRows();list.scrollTop=0;
   status.textContent='設定を読み込みました。「保存」で反映します。'+(unknown.length?' 未対応の'+unknown.length+'コマンドは除外しました。':'');
  }catch(error){if(dialog.open&&draft===targetDraft)status.textContent='読み込めませんでした：'+error.message;}
 };
 const bulkColor=document.createElement('div');bulkColor.dataset.bulkColors='';bulkColor.innerHTML='<button type="button" data-select-registered>登録済みを選択</button><button type="button" data-select-clear>選択解除</button><span data-selection-count>0件選択</span><label>一括の色<input type="color" value="#00aa88" aria-label="一括設定の背景色"></label><button type="button" data-apply-color>色を適用</button><button type="button" data-reset-colors>標準色に戻す</button>';
 orderDetails.after(bulkColor);
 const selectedCount=bulkColor.querySelector('[data-selection-count]'),applyColor=bulkColor.querySelector('[data-apply-color]'),resetColors=bulkColor.querySelector('[data-reset-colors]');
 function updateSelection(){selectedCount.textContent=selected.size+'件選択';applyColor.disabled=resetColors.disabled=!selected.size;}
 bulkColor.querySelector('[data-select-registered]').onclick=()=>{for(const id of registeredOrder(draft))selected.add(id);renderRows();};
 bulkColor.querySelector('[data-select-clear]').onclick=()=>{selected.clear();renderRows();};
 applyColor.onclick=()=>{const color=bulkColor.querySelector('input[type=color]').value;for(const id of selected)draft.colors[id]=color;renderRows();status.textContent=selected.size+'コマンドの色を変更しました。「保存」で反映します。';};
 resetColors.onclick=()=>{for(const id of selected)delete draft.colors[id];renderRows();status.textContent=selected.size+'コマンドを標準色に戻しました。「保存」で反映します。';};
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
   proxy.title=(original.title||label(original))+'\n'+favoriteBarEditHint;proxy.disabled=original.disabled;proxy.setAttribute('aria-disabled',original.getAttribute('aria-disabled')||'false');
   proxy.classList.toggle('active',original.classList.contains('active'));
   if(original.hasAttribute('aria-pressed'))proxy.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));else proxy.removeAttribute('aria-pressed');
   applyCommandColor(proxy,settings.colors[original.id]);
  }
  // Keep the two-row layout intact when only command state has changed.
  const desired=ordered.map(original=>proxies.get(original.id));
  const current=[...favorites.querySelectorAll('[data-favorite-command]')];
  if(current.length!==desired.length||desired.some((proxy,index)=>proxy!==current[index]))favorites.append(...desired);
  favorites.hidden=!ordered.length;
  barEditor?.refresh();
 }
 function renderRows(movedId=null){
  if(!draft)return;clearDrag();const scrollTop=list.scrollTop;list.replaceChildren();autoSort.checked=draft.autoSort;updateSelection();
  const registered=registeredOrder(draft);
  orderPreview.textContent=registered.length?'登録する順番：'+registered.map((id,index)=>(index+1)+'. '+label(catalog.find(button=>button.id===id))).join(' → '):'まだ登録されていません。使いたいコマンドの「＋ 登録」を押してください。';
  const ordered=[...registered,...catalog.map(b=>b.id).filter(id=>!draft.favorites.includes(id))];
  let previousGroup=null;
  for(const id of ordered){const command=catalog.find(b=>b.id===id);if(!command)continue;
   const index=registered.indexOf(id),group=index<0?'未登録':'登録済み（ドラッグ・↑↓で並べ替え）';
   if(group!==previousGroup){const heading=document.createElement('h3');heading.textContent=group;list.append(heading);previousGroup=group;}
   const row=document.createElement('div');row.className='favorite-row';row.dataset.command=id;
   const pick=document.createElement('input');pick.type='checkbox';pick.dataset.bulkSelect='';pick.checked=selected.has(id);pick.setAttribute('aria-label',label(command)+'を一括色設定の対象にする');pick.onchange=()=>{pick.checked?selected.add(id):selected.delete(id);row.classList.toggle('favorite-color-selected',pick.checked);updateSelection();};row.append(pick);row.classList.toggle('favorite-color-selected',pick.checked);
   const star=document.createElement('button');star.type='button';star.textContent=index>=0?'★':'☆';star.setAttribute('aria-label',label(command)+(index>=0?'の登録を解除':'を登録'));star.setAttribute('aria-pressed',String(index>=0));
   star.onclick=()=>{draft.favorites=draft.favorites.includes(id)?draft.favorites.filter(value=>value!==id):[...draft.favorites,id];renderRows();};
   const name=document.createElement('span');name.className='favorite-name';name.textContent=(index>=0?(index+1)+'. ':'')+label(command);
   if(index>=0&&draft.autoSort){const count=document.createElement('small');count.textContent=' · '+(draftUsage[id]||0)+'回';count.style.color='#8faebc';name.append(count);}
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
  else list.scrollTop=scrollTop;
 }
 open.onclick=()=>{barEditor?.close();sync();draft=readFavoriteCommands(settings);draftUsage={...usage};selected.clear();collapse.checked=draft.collapsed;status.textContent='';renderRows();dialog.showModal();};
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-reset]').onclick=()=>{draft=readFavoriteCommands();selected.clear();collapse.checked=false;renderRows();};
 dialog.querySelector('form').onsubmit=event=>{
  event.preventDefault();draft.collapsed=collapse.checked;draft.autoSort=autoSort.checked;draft.favorites=registeredOrder(draft);
  if(draft.collapsed&&!draft.favorites.some(id=>catalog.some(b=>b.id===id))){status.textContent='バーを畳む前にコマンドを1つ以上登録してください';return;}
  try{saveCommandSettings(localStorage,storageKey,usageKey,draft,draftUsage);}catch{status.textContent='設定を保存できませんでした。ブラウザーの保存設定を確認してください';return;}
  for(const original of catalog)if(settings.hidden.includes(original.id)&&!draft.hidden.includes(original.id))original.hidden=false;
  settings=readFavoriteCommands(draft);usage={...draftUsage};sync();window.dispatchEvent(new Event('resize'));dialog.close();notify('ツールバーの設定を保存しました');
 };
 bar.addEventListener('click',event=>{
  const button=event.target.closest('button[id]');
  if(!button||!bar.contains(button)||button.disabled||button.getAttribute('aria-disabled')==='true'||!event.isTrusted&&invokingFavorite!==button.id)return;
  usage[button.id]=Math.min(Number.MAX_SAFE_INTEGER,(usage[button.id]||0)+1);
  try{localStorage.setItem(usageKey,JSON.stringify(usage));}catch{}
  if(settings.autoSort){settings.favorites=registeredOrder(settings);try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}sync();}
 },{capture:true});
 let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});}).observe(bar,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-disabled','aria-pressed','title','class']});
 barEditor=installFavoriteBarEdit({bar:favorites,getSettings:()=>settings,getOrder:()=>registeredOrder(settings),getLabel:id=>{const command=catalog.find(button=>button.id===id);return command?label(command):id;},commit(next,message){
  const clean=readFavoriteCommands(next);try{saveCommandSettings(localStorage,storageKey,usageKey,clean,usage);}catch{notify('設定を保存できませんでした。元の設定を保っています');return false;}
  settings=clean;sync();window.dispatchEvent(new Event('resize'));notify(message);return true;
 }});
 fitCommandToolbar(favorites,{singleRowWhenFits:true});sync();return {sync,escape:()=>barEditor.escape()};
}
