import {splinePointInsertion} from './spline-point-edit.js';
// Screen-space handles edit points on the spline's own sketch plane.
export function installSplineEditor({host,banner,sidebar,getState,project,getControls,onMove,onRestore,onCommit,onUndo,onClose,onInsert,onDelete}){
 const style=document.createElement('style');style.textContent=`
 #spline-handles{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}
 .spline-fit-point{position:absolute;width:14px;height:14px;min-width:0;padding:0;transform:translate(-50%,-50%);border:2px solid white;border-radius:50%;background:#087ca5;box-shadow:0 0 0 1px #075e80;pointer-events:auto;cursor:grab;touch-action:none}
 .spline-fit-point:hover,.spline-fit-point:focus-visible{outline:3px solid #f4bc57;outline-offset:2px}
 .spline-fit-point[data-start=true]{background:#258a68}
 .spline-fit-point[data-closing=true]{outline:3px solid #f4bc57;outline-offset:2px}
 .spline-fit-point:active{cursor:grabbing}
 #spline-controls{grid-column:1/-1;margin:6px 0;padding:8px;border:1px solid #9ec9d8;border-radius:5px;background:#edf8fc;color:#214a5d;font-size:12px;white-space:normal}
 #spline-controls[hidden],#spline-handles[hidden]{display:none}
 #spline-controls .spline-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px}
 #spline-controls button{font-size:12px;padding:5px 8px;margin:0;color:#174c63;background:#d9f1fa;border:1px solid #6caac1}
 #spline-controls button:disabled{color:#687e88;background:#e8eff2;opacity:.65}
 #spline-controls small{font-size:12px;display:block;margin-top:5px;line-height:1.5}
 #spline-point-menu{position:fixed;z-index:1000;min-width:190px;max-width:270px;padding:6px;background:#f7fcff;border:1px solid #83b8cd;border-radius:7px;box-shadow:0 4px 18px #173a4f33;color:#173a4f}
 #spline-point-menu button{display:block;width:100%;padding:10px;text-align:left;background:#e4f5fc;color:#174c63;border:0;border-radius:4px;font-size:14px}
 #spline-point-menu button:disabled{color:#78838a;background:#edf0f2}
 #spline-point-menu small{display:block;padding:6px;font-size:12px;line-height:1.5}
 `;document.head.append(style);
 const layer=document.createElement('div');layer.id='spline-handles';layer.setAttribute('aria-label','スプラインのフィット点');host.append(layer);
 const panel=document.createElement('div');panel.id='spline-controls';panel.hidden=true;
 panel.innerHTML='<strong>フィット点スプライン</strong><div class="spline-actions"><output id="spline-point-count"></output><button id="spline-undo-point" type="button">1点戻す ⌫</button><button id="spline-close" type="button">曲線を閉じる</button></div><small id="spline-point-hint"></small>';
 sidebar.prepend(panel);
 const undo=panel.querySelector('#spline-undo-point'),close=panel.querySelector('#spline-close'),count=panel.querySelector('output'),hint=panel.querySelector('small');
 let drag=null,key=null,buttons=[],menu=null,menuVersion=null;
 const version=state=>state&&JSON.stringify([state.key,state.points,state.closed]);
 function closeMenu(){if(!menu)return false;menu.remove();menu=null;menuVersion=null;return true;}
 function openPointMenu(event){
  const state=getState();if(!state||state.busy||drag)return false;
  const rect=host.getBoundingClientRect(),pointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
  let index=-1,distance=11;
  const handle=event.target.closest?.('.spline-fit-point');
  if(handle&&layer.contains(handle))index=Number(handle.dataset.index);
  else state.points.forEach((point,i)=>{const p=project(point,state),d=Math.hypot(pointer.x-p.x,pointer.y-p.y);if(p.z>=-1&&p.z<=1&&d<distance){index=i;distance=d;}});
  const insertion=index<0?splinePointInsertion(state.feature,pointer,p=>project(p,state)):null;
  if(index<0&&!insertion)return false;
  closeMenu();menuVersion=version(state);menu=document.createElement('div');menu.id='spline-point-menu';menu.setAttribute('role','menu');
  const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');
  const minimum=state.closed?3:2,blocked=index>=0?!state.drawing&&state.points.length<=minimum:state.points.length>=200;
  button.textContent=index>=0?'フィット点 '+(index+1)+' を削除':'ここにフィット点を追加';button.disabled=blocked;
  const token=menuVersion;
  button.onclick=()=>{if(version(getState())!==token){closeMenu();return;}closeMenu();index>=0?onDelete(index):onInsert(insertion);};
  menu.append(button);
  if(blocked){const help=document.createElement('small');help.textContent=index>=0?(state.closed?'閉じた曲線は3点以上必要です':'確定した曲線は2点以上必要です'):'フィット点は200点までです';menu.append(help);}
  document.body.append(menu);const box=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-box.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-box.height-8))+'px';if(!blocked)button.focus({preventScroll:true});
  return true;
 }
 document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target))closeMenu();},{capture:true});
 layer.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openPointMenu(event);});
 undo.onclick=()=>onUndo();close.onclick=()=>onClose();
 function release(d){if(d.button.hasPointerCapture(d.id))d.button.releasePointerCapture(d.id);getControls().enabled=d.enabled;}
 function cancelDrag(){if(!drag)return false;const d=drag;drag=null;release(d);if(getState()?.key===d.key)onRestore(d.before);return true;}
 function finish(event,cancel=false){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopPropagation();if(cancel){cancelDrag();return;}
  const d=drag;drag=null;release(d);
  if(getState()?.key!==d.key)return;
  if(d.moved)onCommit(d.before);else if(d.drawing&&d.index===0&&getState().points.length>=3)onClose();
 }
 function start(event,index){const state=getState();if(event.button!==0||!state||state.busy)return;event.preventDefault();event.stopPropagation();
  const button=event.currentTarget;button.focus({preventScroll:true});drag={id:event.pointerId,index,button,key:state.key,drawing:state.drawing,before:{points:state.points.map(p=>[...p]),closed:state.closed,touched:state.touched},x:event.clientX,y:event.clientY,moved:false,enabled:getControls().enabled};
  getControls().enabled=false;button.setPointerCapture(event.pointerId);
 }
 layer.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopPropagation();
  if(getState()?.key!==drag.key){const d=drag;drag=null;release(d);return;}
  if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3)return;
  drag.moved=true;onMove(drag.index,event);
 });
 layer.addEventListener('pointerup',event=>finish(event));layer.addEventListener('pointercancel',event=>finish(event,true));layer.addEventListener('lostpointercapture',event=>finish(event,true));
 window.addEventListener('keydown',event=>{const state=getState();if(event.key!=='Backspace'||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||!state?.drawing||state.busy||drag||document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,[contenteditable]'))return;
  event.preventDefault();event.stopImmediatePropagation();onUndo();
 },{capture:true});
 function nearStart(event){const state=getState();if(!state?.drawing||state.points.length<3)return false;const p=project(state.points[0],state),r=host.getBoundingClientRect();return Math.hypot(event.clientX-r.left-p.x,event.clientY-r.top-p.y)<=11;}
 function update(){const state=getState();if(menu&&(state?.busy||version(state)!==menuVersion))closeMenu();panel.hidden=layer.hidden=!state;if(!state){if(drag){const d=drag;drag=null;release(d);}key=null;layer.replaceChildren();buttons=[];return;}
  const parent=state.drawing?banner:sidebar;if(panel.parentElement!==parent)parent.append(panel);
  if(key!==state.key||buttons.length!==state.points.length){key=state.key;layer.replaceChildren();buttons=state.points.map((_,index)=>{const button=document.createElement('button');button.type='button';button.className='spline-fit-point';button.dataset.index=String(index);button.dataset.start=String(index===0);button.setAttribute('aria-label','フィット点 '+(index+1));button.title='フィット点 '+(index+1)+'：ドラッグで移動 / 右クリックで削除'+(index===0?' / 作図中はクリックで閉じる':'');button.onpointerdown=event=>start(event,index);layer.append(button);return button;});}
  buttons.forEach((button,index)=>{const p=project(state.points[index],state);button.hidden=p.z<-1||p.z>1||p.x<0||p.x>host.clientWidth||p.y<0||p.y>host.clientHeight;button.style.left=p.x+'px';button.style.top=p.y+'px';button.disabled=state.busy;button.dataset.closing=String(index===0&&state.closing);});
  count.textContent=state.points.length+' 点'+(state.closed?' · 閉じた曲線':'');undo.hidden=!state.drawing;undo.disabled=!state.points.length||state.busy||!!drag;
  close.textContent=state.closed?'曲線を開く':'曲線を閉じる';close.disabled=state.points.length<3||state.busy||!!drag;
  hint.textContent=state.busy?'後続の工程を更新しています…':state.drawing?'丸印をドラッグで移動 · 右クリックで点を追加・削除 · Backspaceで1点戻す · 始点で閉じる':'丸印をドラッグで移動 · 曲線を右クリックで点を追加 / 丸印を右クリックで削除';
 }
 return {update,cancelDrag,nearStart,openPointMenu,closeMenu,get menuOpen(){return !!menu;},get dragging(){return !!drag;}};
}
