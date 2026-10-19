let pending=null;
export function cancelExtrusionJoinConfirmation(){if(!pending)return false;pending(null);return true;}
export async function confirmExtrusionJoin(plan,{bodyName=id=>id,isCurrent=()=>true}={}){
 const dialog=document.createElement('dialog');dialog.id='extrusion-join-confirm';dialog.setAttribute('aria-labelledby','extrusion-join-confirm-title');
 dialog.style.cssText='padding:22px;width:min(460px,calc(100vw - 32px));max-height:85vh;overflow:auto;border:1px solid #6b99b5;border-radius:12px;background:#142232;color:#e2edf5';
 dialog.innerHTML='<h2 id="extrusion-join-confirm-title">複数ボディの結合を確認</h2><p data-summary></p><ul data-bodies></ul><p>接触しているボディをすべて結合しますか？</p><p>「いいえ」は押し出し元と押し出し先だけを結合します。他のボディは残します。</p><div data-endpoints></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px"><button type="button" data-cancel>キャンセル</button><button type="button" data-no>いいえ：元と先だけ</button><button type="button" data-yes>はい：すべて結合</button></div>';
 dialog.querySelector('[data-summary]').textContent=plan.bodyIds.length+'個のボディが結合され、3個以上が1つになる箇所があります。';
 for(const id of plan.bodyIds){const li=document.createElement('li');li.textContent=bodyName(id);dialog.querySelector('[data-bodies]').append(li);}
 const selectors=new Map();for(const entry of plan.entries){
  if(!entry.options.length)continue;
  const label=document.createElement('label');label.style.cssText='display:grid;gap:6px;margin-top:12px';label.textContent='押し出し元：'+(entry.sourceId?bodyName(entry.sourceId):'スケッチ')+' ／ 押し出し先';
  const select=document.createElement('select');select.dataset.joinDestination=String(entry.index);for(const id of entry.options)select.add(new Option(bodyName(id),id));select.value=entry.destinationId;label.append(select);dialog.querySelector('[data-endpoints]').append(label);selectors.set(entry.index,select);
 }
 document.body.append(dialog);
 try{return await new Promise(resolve=>{
  const finish=value=>{if(pending===finish)pending=null;resolve(isCurrent()?value:null);};pending=finish;
  dialog.querySelector('[data-yes]').onclick=()=>finish({all:true});dialog.querySelector('[data-no]').onclick=()=>finish({all:false,destinations:Object.fromEntries([...selectors].map(([index,select])=>[index,select.value]))});
  dialog.querySelector('[data-cancel]').onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));dialog.showModal();dialog.querySelector('[data-no]').focus();
 });}finally{dialog.close();dialog.remove();}
}
