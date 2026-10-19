import {extrusionJoinBodies} from './extrusion-join-view.js';
let pending=null;
export function cancelExtrusionJoinConfirmation(){if(!pending)return false;pending(null);return true;}
export async function confirmExtrusionJoin(plan,{bodyName=id=>id,isCurrent=()=>true,host=null,inspect=()=>null}={}){
 if(!document.getElementById('extrusion-join-style')){const style=document.createElement('style');style.id='extrusion-join-style';style.textContent=`
 .viewport[data-extrusion-join-docked=true]{--join-width:min(350px,43%)}
 .viewport[data-extrusion-join-docked=true] #canvas-host{right:var(--join-width)}
 .viewport[data-extrusion-join-docked=true] .view-cube{right:calc(var(--join-width) + 12px)}
 .viewport[data-extrusion-join-docked=true] #reference-plane-control{right:calc(var(--join-width) + 16px)}
 .viewport[data-extrusion-join-docked=true] .navigation{left:calc((100% - var(--join-width))/2);max-width:calc(100% - var(--join-width) - 20px)}
 .viewport[data-extrusion-join-docked=true] #snap-controls{max-width:calc(100% - var(--join-width) - 30px)}
 .viewport[data-extrusion-join-docked=true] :is(#extrude-distance,#extrude-handle,#extrude-guide,#extrude-operation-wheel,#taper-control,#measurement){display:none!important}
 .viewport[data-extrusion-join-docked=true] :is(#snap-controls,#reference-plane-control,.navigation,#toast,.view-help){display:none!important}
 #extrusion-join-confirm{position:absolute;inset:8px 8px 8px auto;margin:0;padding:16px;width:calc(var(--join-width,350px) - 16px);height:auto;max-height:none;box-sizing:border-box;overflow:auto;border:1px solid #6b99b5;border-radius:10px;background:#142232;color:#e2edf5;z-index:150;box-shadow:0 4px 14px #0003;font-size:13px;line-height:1.55}
 #extrusion-join-confirm h2{font-size:18px;margin:0 0 10px}#extrusion-join-confirm p{margin:10px 0}#extrusion-join-confirm ul{list-style:none;padding:0;display:grid;gap:6px}
 #extrusion-join-confirm [data-body-id]{display:grid;grid-template-columns:24px 1fr;gap:7px;padding:7px;border:1px solid #617f94;border-radius:6px;cursor:pointer;outline-offset:2px}
 #extrusion-join-confirm [data-body-id]:is(:hover,:focus),#extrusion-join-confirm [data-body-id][data-focused=true]{background:#31485c;border-color:var(--join-color)}
 #extrusion-join-confirm .join-number{background:var(--join-color);color:#102432;text-align:center;border-radius:4px;font-weight:bold;height:24px}#extrusion-join-confirm small{display:block;color:#b8cedd}
 #extrusion-join-confirm select{width:100%;font-size:13px}#extrusion-join-confirm button{font-size:13px;padding:8px 10px}
 #extrusion-join-confirm [data-actions]{position:sticky;bottom:-16px;background:#142232;border-top:1px solid #617f94;padding:10px 0 16px}
 #extrusion-join-labels{position:absolute;inset:0;z-index:12;overflow:hidden;pointer-events:none}#extrusion-join-labels svg{position:absolute;inset:0;width:100%;height:100%}
 .extrusion-join-label{position:absolute;max-width:min(230px,calc(100% - 16px));text-overflow:ellipsis;white-space:nowrap;overflow:hidden;background:#fffffff2;color:#173a50;border:1px solid var(--join-color);border-left:6px solid var(--join-color);border-radius:5px;padding:4px 7px;font-size:12px;box-shadow:0 2px 5px #0002}.extrusion-join-label[data-focused=true]{outline:2px solid var(--join-color);font-weight:bold}
 @media(max-width:1000px){.viewport[data-extrusion-join-docked=true]{--join-width:min(300px,45%)}}
 @media(max-width:680px){.viewport[data-extrusion-join-docked=true]{--join-width:0px;--join-height:43%}.viewport[data-extrusion-join-docked=true] #canvas-host{right:0;bottom:var(--join-height)}#extrusion-join-confirm{inset:auto 6px 6px;width:calc(100% - 12px);height:calc(43% - 12px)}.viewport[data-extrusion-join-docked=true] .navigation{display:none}}
 `;document.head.append(style);}
 const dialog=document.createElement('dialog');dialog.id='extrusion-join-confirm';dialog.setAttribute('aria-labelledby','extrusion-join-confirm-title');
 dialog.innerHTML='<h2 id="extrusion-join-confirm-title">複数ボディの結合を確認</h2><small>画面の左ドラッグで回転・ホイールでズーム</small><p data-summary></p><ul data-bodies></ul><p>接触しているボディをすべて結合しますか？</p><p>「いいえ」は押し出し元と押し出し先だけを結合します。他のボディは残します。</p><div data-endpoints></div><div data-actions style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px"><button type="button" data-cancel>キャンセル</button><button type="button" data-no>いいえ：元と先だけ</button><button type="button" data-yes>はい：すべて結合</button></div>';
 dialog.querySelector('[data-summary]').textContent='既存の'+plan.bodyIds.length+'個のボディと、今回押し出す部分を結合します。押し出す部分も含めて3個以上になる箇所があります。'+(plan.entries.some(entry=>entry.incidental)?'途中や側面で接触するボディも含まれます。':'');
 if(plan.entries.some(entry=>entry.sourceId&&!entry.destinationId))dialog.querySelector('[data-endpoints]').before(Object.assign(document.createElement('p'),{textContent:'先端に接触する押し出し先がない場合、「いいえ」は押し出し元だけを伸ばします。'}));
 if(plan.entries.every(entry=>entry.sourceId&&!entry.destinationId))dialog.querySelector('[data-no]').textContent='いいえ：元だけ';
 let inspection=null;const entries=extrusionJoinBodies(plan,bodyName);
 for(const entry of entries){const li=document.createElement('li'),number=document.createElement('span'),name=document.createElement('span'),role=document.createElement('small');li.dataset.bodyId=entry.id;li.tabIndex=0;li.style.setProperty('--join-color',entry.color);number.className='join-number';number.textContent=entry.number;name.textContent=entry.name;role.dataset.role=entry.id;role.textContent=entry.role;name.append(role);li.append(number,name);dialog.querySelector('[data-bodies]').append(li);const focus=()=>inspection?.focus(entry.id);li.onmouseenter=li.onfocus=focus;li.onmouseleave=li.onblur=()=>inspection?.focus(null);}
 const sweep=document.createElement('p');sweep.textContent='＋ 水色：今回の押し出し';sweep.style.color='#53dbe0';dialog.querySelector('[data-bodies]').after(sweep);
 const selectors=new Map();for(const entry of plan.entries){
  if(!entry.options.length)continue;
  const label=document.createElement('label');label.style.cssText='display:grid;gap:6px;margin-top:12px';label.textContent='押し出し元：'+(entry.sourceId?bodyName(entry.sourceId):'スケッチ')+' ／ 押し出し先';
  const select=document.createElement('select');select.dataset.joinDestination=String(entry.index);for(const id of entry.options)select.add(new Option(bodyName(id),id));select.value=entry.destinationId;label.append(select);dialog.querySelector('[data-endpoints]').append(label);selectors.set(entry.index,select);
 }
 const viewport=host?.parentElement||document.body,previousFocus=document.activeElement;viewport.append(dialog);viewport.dataset.extrusionJoinDocked='true';dialog.show();
 const blockCommands=event=>{if(dialog.contains(event.target)||host?.contains(event.target)||event.target.closest('.view-cube,.navigation'))return;event.preventDefault();event.stopImmediatePropagation();};document.addEventListener('pointerdown',blockCommands,true);document.addEventListener('click',blockCommands,true);
 const blockKeys=event=>{if(dialog.contains(event.target)||event.key==='Escape'||event.key==='Shift')return;if(event.ctrlKey||event.metaKey||['Delete','Backspace','Enter'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();}};document.addEventListener('keydown',blockKeys,true);
 try{return await new Promise(resolve=>{
  const finish=value=>{if(pending===finish)pending=null;resolve(isCurrent()?value:null);};pending=finish;
  dialog.querySelector('[data-yes]').onclick=()=>finish({all:true});dialog.querySelector('[data-no]').onclick=()=>finish({all:false,destinations:Object.fromEntries([...selectors].map(([index,select])=>[index,select.value]))});
  dialog.querySelector('[data-cancel]').onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));dialog.querySelector('[data-no]').focus();
  requestAnimationFrame(()=>{if(!dialog.open)return;inspection=inspect(dialog,entries);const update=()=>{const next=extrusionJoinBodies(plan,bodyName,Object.fromEntries([...selectors].map(([index,select])=>[index,select.value])));for(const entry of next)dialog.querySelector('[data-role="'+CSS.escape(entry.id)+'"]').textContent=entry.role;inspection?.setEntries(next);};for(const select of selectors.values())select.onchange=update;});
 });}finally{inspection?.close();document.removeEventListener('pointerdown',blockCommands,true);document.removeEventListener('click',blockCommands,true);document.removeEventListener('keydown',blockKeys,true);delete viewport.dataset.extrusionJoinDocked;dialog.close();dialog.remove();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
}
