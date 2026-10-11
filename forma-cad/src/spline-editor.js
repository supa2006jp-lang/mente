import {splinePointInsertion} from './spline-point-edit.js';
import {splineSamples,splineEndpoint} from './spline-curve.js';
// Screen-space handles edit points on the spline's own sketch plane.
export function installSplineEditor({host,banner,sidebar,getState,project,getControls,onMove,onRestore,onCommit,onUndo,onClose,onInsert,onDelete,onTangent,onTangentMove}){
 const style=document.createElement('style');style.textContent=`
 #spline-effects,#spline-tangent-handles{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:7}
 .spline-tangent-handle{position:absolute;width:16px;height:16px;min-width:0;padding:0;transform:translate(-50%,-50%);border:2px solid white;border-radius:2px;background:#a36608;box-shadow:0 0 0 1px #714407;pointer-events:auto;cursor:grab;touch-action:none}
 #spline-tangents{grid-column:1/-1;margin:8px 0;padding:8px;border:1px solid #9ec9d8;border-radius:5px;background:#edf8fc;color:#214a5d;font-size:12px}
 #spline-tangents[hidden]{display:none}
 #spline-tangents small{display:block;margin-top:5px;line-height:1.5}
 #spline-tangents button{font-size:12px;padding:4px;margin:0;background:#d9f1fa;color:#174c63;border:1px solid #6caac1}
 #spline-tangent-snap-status{display:block;color:#987000;min-height:16px;margin-top:4px}
 .spline-endpoint-settings{border-top:1px solid #bed6df;margin-top:6px;padding-top:2px}
 #spline-tangents summary{cursor:pointer}
 #spline-tangents label{display:flex;align-items:center;gap:5px;margin:7px 0;color:#214a5d}
 #spline-tangents input[type=checkbox]{width:16px;height:16px;margin:0}
 #spline-tangents input[type=number]{width:80px;padding:4px;font-size:12px;color:#174c63;background:white;border:1px solid #8cb8c9}
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
 const ns='http://www.w3.org/2000/svg',effects=document.createElementNS(ns,'svg');effects.id='spline-effects';effects.setAttribute('aria-hidden','true');host.append(effects);
 const svg=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);Object.defineProperty(el,'hidden',{get(){return el.style.display==='none';},set(value){el.style.display=value?'none':'';}});el.hidden=true;effects.append(el);return el;};
 const ghostBorder=svg('polyline',{fill:'none',stroke:'white','stroke-width':6}),ghost=svg('polyline',{fill:'none',stroke:'#e18a08','stroke-width':3,'stroke-dasharray':'7 4'}),changeMark=svg('circle',{r:7,fill:'#e18a08',stroke:'white','stroke-width':2});
 const tangentLayer=document.createElement('div');tangentLayer.id='spline-tangent-handles';host.append(tangentLayer);
 const tangentHandles={},tangentLines={},snapGuide=svg('line',{stroke:'#d59b16','stroke-width':3,'stroke-dasharray':'6 3'});let snapResult=null;
 for(const end of ['start','end']){tangentLines[end]=svg('line',{stroke:'#a36608','stroke-width':2,'stroke-dasharray':'4 3'});const b=document.createElement('button');b.type='button';b.className='spline-tangent-handle';b.dataset.end=end;b.setAttribute('aria-label',(end==='start'?'始点':'終点')+'の接線ハンドル');b.title=(end==='start'?'始点':'終点')+'の接線方向と長さをドラッグで調整（Altで方向吸着を解除）';b.onpointerdown=e=>start(e,end,'tangent');tangentLayer.append(b);tangentHandles[end]=b;}
 const panel=document.createElement('div');panel.id='spline-controls';panel.hidden=true;
 panel.innerHTML='<strong>フィット点スプライン</strong><div class="spline-actions"><output id="spline-point-count"></output><button id="spline-undo-point" type="button">1点戻す ⌫</button><button id="spline-close" type="button">曲線を閉じる</button></div><small id="spline-point-hint"></small>';
 const tangentPanel=document.createElement('details');tangentPanel.id='spline-tangents';tangentPanel.hidden=true;tangentPanel.innerHTML='<summary>端点の接線・曲がり具合</summary><label><input type="checkbox" id="spline-tangent-snap" checked>方向吸着（Altで一時解除）</label>'+['start','end'].map(end=>'<div class="spline-endpoint-settings"><label><input type="checkbox" id="spline-tangent-'+end+'-enabled">'+(end==='start'?'始点':'終点')+' 角度 <input type="number" id="spline-tangent-'+end+'-angle" min="-360" max="360" step="any" aria-label="'+(end==='start'?'始点':'終点')+'の接線角度">°</label><label>ハンドル長 <input type="number" id="spline-tangent-'+end+'-length" min="0.01" max="10000" step="any" aria-label="'+(end==='start'?'始点':'終点')+'の接線ハンドル長">mm <button type="button" id="spline-tangent-'+end+'-reset-length">自動長</button></label></div>').join('')+'<output id="spline-tangent-snap-status" aria-live="polite"></output><small>横方向0°・縦方向90°。茶色の四角をドラッグして向きと長さを調整。数値なら片方ずつ変更できます。チェックを外すと全て自動に戻ります。</small>';sidebar.append(tangentPanel);
 const snapEnabled=tangentPanel.querySelector('#spline-tangent-snap'),snapStatus=tangentPanel.querySelector('output');
 const tangentInputs={};for(const end of ['start','end']){const get=part=>tangentPanel.querySelector('#spline-tangent-'+end+'-'+part),enabled=get('enabled'),angle=get('angle'),length=get('length'),reset=get('reset-length');tangentInputs[end]={enabled,angle,length,reset};enabled.onchange=()=>{const state=getState();if(state?.points.length>=2)onTangent(end,enabled.checked?splineEndpoint(state.feature,end).angle:null);};angle.onchange=()=>{if(angle.value.trim()&&angle.checkValidity())onTangent(end,Number(angle.value));else angle.reportValidity();};length.onchange=()=>{const state=getState();if(length.value.trim()&&length.checkValidity()&&state)onTangent(end,splineEndpoint(state.feature,end).angle,Number(length.value));else length.reportValidity();};reset.onclick=()=>{const state=getState();if(state)onTangent(end,splineEndpoint(state.feature,end).angle,null);};for(const input of [angle,length])input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();input.blur();}};}
 sidebar.prepend(panel);
 const undo=panel.querySelector('#spline-undo-point'),close=panel.querySelector('#spline-close'),count=panel.querySelector('output'),hint=panel.querySelector('small');
 let drag=null,key=null,buttons=[],menu=null,menuVersion=null,candidate=null;
 const version=state=>state&&JSON.stringify([state.key,state.points,state.closed,state.feature.tangents,state.feature.tangentLengths]);
 function clearCandidate(){candidate=null;delete host.dataset.splineEditPreview;ghostBorder.hidden=ghost.hidden=changeMark.hidden=true;}
 function closeMenu(){clearCandidate();if(!menu)return false;menu.remove();menu=null;menuVersion=null;return true;}
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
  if(!blocked){const points=state.points.map(p=>[...p]);if(insertion)points.splice(insertion.index,0,insertion.point);else points.splice(index,1);const next={...state.feature,points,closed:state.closed&&points.length>=3};const mark=insertion?.point||state.points[index];
   const preview=()=>{if(version(getState())!==token)return;candidate={samples:splineSamples(next),mark,deleting:!insertion};host.dataset.splineEditPreview=JSON.stringify({points,tangents:next.tangents||{},tangentLengths:next.tangentLengths||{},deleting:!insertion});updateEffects(getState());};
   button.onpointerenter=button.onfocus=preview;button.onpointerleave=button.onblur=clearCandidate;
   const help=document.createElement('small');help.textContent='橙の破線：変更後 · クリックで確定';menu.append(help);
  }
  menu.prepend(button);
  if(blocked){const help=document.createElement('small');help.textContent=index>=0?(state.closed?'閉じた曲線は3点以上必要です':'確定した曲線は2点以上必要です'):'フィット点は200点までです';menu.append(help);}
  document.body.append(menu);const box=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-box.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-box.height-8))+'px';if(!blocked)button.focus({preventScroll:true});
  return true;
 }
 document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target))closeMenu();},{capture:true});
 layer.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openPointMenu(event);});
 undo.onclick=()=>onUndo();close.onclick=()=>onClose();
 function clearSnap(){snapResult=null;snapStatus.textContent='';delete host.dataset.splineTangentSnap;snapGuide.hidden=true;}
 function release(d){clearSnap();if(d.button.hasPointerCapture(d.id))d.button.releasePointerCapture(d.id);getControls().enabled=d.enabled;}
 function cancelDrag(){if(!drag)return false;const d=drag;drag=null;release(d);if(getState()?.key===d.key)onRestore(d.before);return true;}
 function finish(event,cancel=false){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopPropagation();if(cancel){cancelDrag();return;}
  const d=drag;drag=null;release(d);
  if(getState()?.key!==d.key)return;
  if(d.moved)onCommit(d.before);else if(d.kind!=='tangent'&&d.drawing&&d.index===0&&getState().points.length>=3)onClose();
 }
 function start(event,index,kind='point'){const state=getState();if(event.button!==0||!state||state.busy)return;event.preventDefault();event.stopPropagation();
  const button=event.currentTarget;button.focus({preventScroll:true});drag={id:event.pointerId,index,kind,button,key:state.key,drawing:state.drawing,before:{points:state.points.map(p=>[...p]),closed:state.closed,tangents:structuredClone(state.feature.tangents||{}),tangentLengths:structuredClone(state.feature.tangentLengths||{}),touched:state.touched},x:event.clientX,y:event.clientY,moved:false,enabled:getControls().enabled};
  getControls().enabled=false;button.setPointerCapture(event.pointerId);
 }
 const move=event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopPropagation();
  if(getState()?.key!==drag.key){const d=drag;drag=null;release(d);return;}
  if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3)return;
  drag.moved=true;if(drag.kind==='tangent'){snapResult=onTangentMove(drag.index,event,snapEnabled.checked);snapStatus.textContent=snapResult?.label||'';if(snapResult?.label)host.dataset.splineTangentSnap=snapResult.label;else delete host.dataset.splineTangentSnap;}else onMove(drag.index,event);
 };
 for(const target of [layer,tangentLayer]){target.addEventListener('pointermove',move);target.addEventListener('pointerup',event=>finish(event));target.addEventListener('pointercancel',event=>finish(event,true));target.addEventListener('lostpointercapture',event=>finish(event,true));}

 window.addEventListener('keydown',event=>{const state=getState();if(event.key!=='Backspace'||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||!state?.drawing||state.busy||drag||document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,[contenteditable]'))return;
  event.preventDefault();event.stopImmediatePropagation();onUndo();
 },{capture:true});
 function nearStart(event){const state=getState();if(!state?.drawing||state.points.length<3)return false;const p=project(state.points[0],state),r=host.getBoundingClientRect();return Math.hypot(event.clientX-r.left-p.x,event.clientY-r.top-p.y)<=11;}
 function updateEffects(state){
  effects.setAttribute('width',host.clientWidth);effects.setAttribute('height',host.clientHeight);
  if(candidate&&state){const ps=candidate.samples.map(p=>project(p,state)),visible=ps.every(p=>p.z>=-1&&p.z<=1);const data=ps.map(p=>p.x+','+p.y).join(' ');ghost.setAttribute('points',data);ghostBorder.setAttribute('points',data);ghost.hidden=ghostBorder.hidden=!visible||ps.length<2;const p=project(candidate.mark,state);changeMark.setAttribute('cx',p.x);changeMark.setAttribute('cy',p.y);changeMark.setAttribute('fill',candidate.deleting?'#cc4d35':'#e18a08');changeMark.hidden=p.z<-1||p.z>1;}
  snapGuide.hidden=!state||!snapResult?.guide;if(!snapGuide.hidden){const [a,b]=snapResult.guide.map(p=>project(p,state));snapGuide.setAttribute('x1',a.x);snapGuide.setAttribute('y1',a.y);snapGuide.setAttribute('x2',b.x);snapGuide.setAttribute('y2',b.y);}
  for(const end of ['start','end']){const button=tangentHandles[end],line=tangentLines[end],show=state&&!state.closed&&state.points.length>=2&&Number.isFinite(state.feature.tangents?.[end]);button.hidden=line.hidden=!show;if(!show)continue;
   const {point,angle,handleLength}=splineEndpoint(state.feature,end),a=angle*Math.PI/180,sign=end==='start'?1:-1,origin=project(point,state),local=[point[0]+Math.cos(a)*handleLength*sign,point[1]+Math.sin(a)*handleLength*sign],p=project(local,state),pixels=Math.hypot(p.x-origin.x,p.y-origin.y),x=p.x,y=p.y;
   button.hidden=line.hidden=origin.z<-1||origin.z>1||pixels<1e-5;button.disabled=state.busy;button.style.left=x+'px';button.style.top=y+'px';line.setAttribute('x1',origin.x);line.setAttribute('y1',origin.y);line.setAttribute('x2',x);line.setAttribute('y2',y);
  }
 }
 function update(){const state=getState();if(menu&&(state?.busy||version(state)!==menuVersion))closeMenu();panel.hidden=layer.hidden=!state;if(!state){tangentPanel.hidden=true;clearSnap();}updateEffects(state);if(!state){if(drag){const d=drag;drag=null;release(d);}key=null;layer.replaceChildren();buttons=[];return;}
  const parent=state.drawing?banner:sidebar;if(panel.parentElement!==parent)parent.append(panel);
  if(key!==state.key||buttons.length!==state.points.length){key=state.key;layer.replaceChildren();buttons=state.points.map((_,index)=>{const button=document.createElement('button');button.type='button';button.className='spline-fit-point';button.dataset.index=String(index);button.dataset.start=String(index===0);button.setAttribute('aria-label','フィット点 '+(index+1));button.title='フィット点 '+(index+1)+'：ドラッグで移動 / 右クリックで削除'+(index===0?' / 作図中はクリックで閉じる':'');button.onpointerdown=event=>start(event,index);layer.append(button);return button;});}
  buttons.forEach((button,index)=>{const p=project(state.points[index],state);button.hidden=p.z<-1||p.z>1||p.x<0||p.x>host.clientWidth||p.y<0||p.y>host.clientHeight;button.style.left=p.x+'px';button.style.top=p.y+'px';button.disabled=state.busy;button.dataset.closing=String(index===0&&state.closing);});
  tangentPanel.hidden=state.closed||state.points.length<2;
  for(const end of ['start','end']){const {enabled,angle,length,reset}=tangentInputs[end],manual=Number.isFinite(state.feature.tangents?.[end]);enabled.checked=manual;enabled.disabled=state.busy||!!drag;angle.disabled=length.disabled=!manual||state.busy||!!drag;reset.disabled=!manual||state.busy||!!drag||!Number.isFinite(state.feature.tangentLengths?.[end]);if(state.points.length>=2){const data=splineEndpoint(state.feature,end);if(document.activeElement!==angle)angle.value=Number(data.angle.toFixed(2));if(document.activeElement!==length)length.value=Number(data.handleLength.toFixed(3));}}
  count.textContent=state.points.length+' 点'+(state.closed?' · 閉じた曲線':'');undo.hidden=!state.drawing;undo.disabled=!state.points.length||state.busy||!!drag;
  close.textContent=state.closed?'曲線を開く':'曲線を閉じる';close.disabled=state.points.length<3||state.busy||!!drag;
  hint.textContent=state.busy?'後続の工程を更新しています…':state.drawing?'丸印をドラッグで移動 · 右クリックで点を追加・削除 · Backspaceで1点戻す · 始点で閉じる':'丸印をドラッグで移動 · 曲線を右クリックで点を追加 / 丸印を右クリックで削除';
 }
 return {update,cancelDrag,nearStart,openPointMenu,closeMenu,get menuOpen(){return !!menu;},get dragging(){return !!drag;}};
}
