import {moveFavoriteCommand} from './favorite-command-order.js';

export const favoriteBarEditHint='ドラッグで並べ替え／右クリックで色変更・登録解除';
export function installFavoriteBarEdit({bar,getSettings,getOrder,getLabel,commit}){
 const document=bar.ownerDocument,win=document.defaultView;
 const style=document.createElement('style');style.textContent=`
 #favorite-commands [data-favorite-command]{position:relative;user-select:none}
 #favorite-commands .favorite-bar-dragging{opacity:.4;cursor:grabbing}
 #favorite-commands .favorite-bar-before::before,#favorite-commands .favorite-bar-after::after{content:'';position:absolute;top:0;bottom:0;width:3px;background:#67ebcf;box-shadow:0 0 3px #10232e;border-radius:2px;pointer-events:none}
 #favorite-commands .favorite-bar-before::before{left:-4px}#favorite-commands .favorite-bar-after::after{right:-4px}
 #favorite-command-menu{position:fixed;z-index:1800;width:244px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;padding:10px;background:#152a39;color:#e3f1f8;border:1px solid #6ba5bb;border-radius:8px;box-shadow:0 5px 22px #0008;font-size:12px}
 #favorite-command-menu[hidden]{display:none}
 #favorite-command-menu strong{display:block;font-size:14px;overflow-wrap:anywhere;padding-right:20px;margin-bottom:8px}
 #favorite-command-menu [data-menu-close]{position:absolute;right:5px;top:4px;padding:2px 6px;background:transparent;border:0;font-size:17px}
 #favorite-command-menu [data-palette]{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 10px}
 #favorite-command-menu [data-palette] button{width:25px;height:25px;padding:0;background:var(--swatch);border:1px solid #afc7d5;box-shadow:inset 0 0 0 1px #0002}
 #favorite-command-menu [data-palette] button:hover{outline:2px solid #8bead7;outline-offset:1px}
 #favorite-command-menu [data-custom-color]{display:flex;align-items:center;gap:6px}
 #favorite-command-menu label{display:flex;align-items:center;gap:5px;margin:0;font-size:12px}
 #favorite-command-menu input[type=color]{width:34px;height:29px;padding:2px;margin:0;cursor:pointer}
 #favorite-command-menu button{font-size:12px;padding:6px 8px}
 #favorite-command-menu [data-menu-actions]{display:flex;gap:6px;margin-top:8px}
 #favorite-command-menu [data-menu-actions] button{flex:1}
 #favorite-command-menu [data-unregister]{color:#ffc7be}
 #favorite-command-menu small{display:block;color:#9bbaca;line-height:1.5;margin-top:8px}`;
 document.head.append(style);
 const menu=document.createElement('div');menu.id='favorite-command-menu';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','コマンドを編集');
 menu.innerHTML='<strong></strong><button type="button" data-menu-close aria-label="コマンド編集を閉じる">×</button><span>背景色</span><div data-palette></div><div data-custom-color><label>任意の色<input type="color" aria-label="コマンドの背景色"></label><button type="button" data-apply-color>色を適用</button></div><div data-menu-actions><button type="button" data-standard>標準色に戻す</button><button type="button" data-unregister>登録解除</button></div><small>変更は自動で保存します。並び順はドラッグで変更できます。</small>';
 document.body.append(menu);
 let activeId=null,trigger=null,drag=null,frame=null,blockClick=false;
 const buttons=()=>[...bar.querySelectorAll('[data-favorite-command]')];
 const commandAt=target=>target?.closest?.('[data-favorite-command]');
 const color=menu.querySelector('input[type=color]'),standard=menu.querySelector('[data-standard]');
 function close({restoreFocus=false}={}){
  menu.hidden=true;activeId=null;
  if(restoreFocus&&trigger?.isConnected&&!trigger.disabled)trigger.focus({preventScroll:true});
  trigger=null;
 }
 function refresh(){
  for(const button of buttons())button.draggable=true;
  if(activeId){if(!getSettings().favorites.includes(activeId)){close();return;}standard.disabled=!getSettings().colors[activeId];}
 }
 function open(button,x,y){
  if(!button||!bar.contains(button))return;
  close();activeId=button.dataset.favoriteCommand;trigger=button;
  menu.querySelector('strong').textContent=getLabel(activeId);color.value=getSettings().colors[activeId]||'#202c3a';standard.disabled=!getSettings().colors[activeId];
  menu.hidden=false;const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(x,win.innerWidth-rect.width-8))+'px';menu.style.top=Math.max(8,Math.min(y,win.innerHeight-rect.height-8))+'px';
  menu.querySelector('[data-palette] button').focus({preventScroll:true});
 }
 function changeColor(value){
  if(!activeId)return;
  const next=structuredClone(getSettings());if(value)next.colors[activeId]=value;else delete next.colors[activeId];
  if(commit(next,getLabel(activeId)+'の色を保存しました'))close({restoreFocus:true});
 }
 for(const [name,value]of [['エメラルド','#00aa88'],['青','#2867ad'],['紫','#7852ad'],['オレンジ','#d48b20'],['赤','#bb4444'],['灰色','#536575'],['白','#edf3f7']]){
  const swatch=document.createElement('button');swatch.type='button';swatch.style.setProperty('--swatch',value);swatch.setAttribute('aria-label',name+'に変更');swatch.title=name;swatch.onclick=()=>changeColor(value);menu.querySelector('[data-palette]').append(swatch);
 }
 menu.querySelector('[data-apply-color]').onclick=()=>changeColor(color.value);standard.onclick=()=>changeColor(null);
 menu.querySelector('[data-menu-close]').onclick=()=>close({restoreFocus:true});
 menu.querySelector('[data-unregister]').onclick=()=>{
  if(!activeId)return;
  const next=structuredClone(getSettings()),name=getLabel(activeId);next.favorites=next.favorites.filter(id=>id!==activeId);
  if(!next.favorites.length)next.collapsed=false;
  if(commit(next,name+'の登録を解除しました'))close();
 };
 menu.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close({restoreFocus:true});}});
 bar.addEventListener('contextmenu',event=>{const button=commandAt(event.target);if(!button)return;event.preventDefault();event.stopPropagation();open(button,event.clientX,event.clientY);});
 bar.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')blockClick=false;if((event.key==='F10'&&event.shiftKey)||event.key==='ContextMenu'){const button=commandAt(event.target);if(!button)return;event.preventDefault();event.stopPropagation();const rect=button.getBoundingClientRect();open(button,rect.left,rect.bottom+4);}});
 document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target))close();},true);
 document.addEventListener('focusin',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!trigger?.contains(event.target))close();});
 win.addEventListener('resize',()=>close());win.addEventListener('scroll',event=>{if(!menu.hidden&&!menu.contains(event.target))close();},true);
 function clearDrop(){for(const button of buttons())button.classList.remove('favorite-bar-before','favorite-bar-after');if(drag)drag.target=null;}
 function finishDrag(){clearDrop();drag=null;if(frame!==null)win.cancelAnimationFrame(frame);frame=null;for(const button of buttons())button.classList.remove('favorite-bar-dragging');}
 function updateDrop(x,y){
  clearDrop();if(!drag)return false;
  const bounds=bar.getBoundingClientRect();if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return false;
  let target=commandAt(document.elementFromPoint(x,y));
  if(!target||!bar.contains(target)){
   const candidates=buttons().map(button=>({button,rect:button.getBoundingClientRect()})).filter(({rect})=>rect.height&&y>=rect.top&&y<=rect.bottom);
   candidates.sort((a,b)=>Math.abs(x-(a.rect.left+a.rect.width/2))-Math.abs(x-(b.rect.left+b.rect.width/2)));target=candidates[0]?.button;
  }
  if(!target||target.dataset.favoriteCommand===drag.id)return false;
  const rect=target.getBoundingClientRect(),before=x<rect.left+rect.width/2;
  drag.target={id:target.dataset.favoriteCommand,before};target.classList.add(before?'favorite-bar-before':'favorite-bar-after');return true;
 }
 function scrollDrag(){
  frame=null;if(!drag)return;
  const rect=bar.getBoundingClientRect();if(drag.y>=rect.top&&drag.y<=rect.bottom&&drag.x>=rect.left&&drag.x<=rect.right){
   const amount=drag.x<rect.left+28?-12:drag.x>rect.right-28?12:0,before=bar.scrollLeft;
   if(amount)bar.scrollLeft+=amount;if(before!==bar.scrollLeft)updateDrop(drag.x,drag.y);
  }
  frame=win.requestAnimationFrame(scrollDrag);
 }
 bar.addEventListener('pointerdown',()=>{if(!drag)blockClick=false;},true);
 bar.addEventListener('click',event=>{if(blockClick){blockClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
 bar.addEventListener('dragstart',event=>{
  const button=commandAt(event.target);if(!button||!event.dataTransfer)return;
  event.stopPropagation();close();finishDrag();blockClick=true;drag={id:button.dataset.favoriteCommand,x:event.clientX,y:event.clientY,target:null};
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-forma-command',drag.id);event.dataTransfer.setData('text/plain',drag.id);button.classList.add('favorite-bar-dragging');frame=win.requestAnimationFrame(scrollDrag);
 });
 bar.addEventListener('dragover',event=>{if(!drag)return;event.preventDefault();event.stopPropagation();drag.x=event.clientX;drag.y=event.clientY;updateDrop(drag.x,drag.y);event.dataTransfer.dropEffect='move';});
 bar.addEventListener('drop',event=>{
  if(!drag)return;event.preventDefault();event.stopPropagation();const valid=updateDrop(event.clientX,event.clientY),snapshot={...drag};finishDrag();if(!valid)return;
  const current=getOrder(),ordered=moveFavoriteCommand(current,snapshot.id,snapshot.target.id,snapshot.target.before);
  if(ordered.every((id,index)=>id===current[index]))return;
  const next=structuredClone(getSettings());next.favorites=ordered;next.autoSort=false;commit(next,'並び順を保存しました。使用頻度順はオフになりました');
 });
 bar.addEventListener('dragend',finishDrag);
 document.addEventListener('dragover',event=>{if(drag&&!bar.contains(event.target)){drag.x=event.clientX;drag.y=event.clientY;clearDrop();}});
 document.addEventListener('keydown',event=>{if(drag&&event.key==='Escape'){event.stopPropagation();finishDrag();}},true);
 // Native color pickers can temporarily take window focus.
 win.addEventListener('blur',finishDrag);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){finishDrag();close();}});
 refresh();return {refresh,close,escape(){if(!menu.hidden){close({restoreFocus:true});return true;}if(drag){finishDrag();return true;}return false;}};
}
