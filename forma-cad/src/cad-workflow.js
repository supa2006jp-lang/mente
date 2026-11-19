const labels=['対象','設定','プレビュー','確定'];

export function createCadWorkflow(id,anchor){
 const panel=document.createElement('section'),steps=document.createElement('ol'),detail=document.createElement('p');
 panel.id=id;panel.className='cad-workflow';panel.hidden=true;
 steps.setAttribute('aria-label','加工手順');
 const items=labels.map(label=>{
  const item=document.createElement('li');item.textContent=label;steps.append(item);return item;
 });
 detail.setAttribute('role','status');
 panel.append(steps,detail);anchor.before(panel);
 let active=-1;
 return state=>{
  if(!state){if(!panel.hidden)panel.hidden=true;return;}
  if(panel.hidden)panel.hidden=false;
  if(active!==state.step){
   active=state.step;
   panel.dataset.step=String(active);
   items.forEach((item,i)=>{
    if(i===active)item.setAttribute('aria-current','step');
    else item.removeAttribute('aria-current');
   });
  }
  if(detail.textContent!==state.detail)detail.textContent=state.detail;
 };
}
