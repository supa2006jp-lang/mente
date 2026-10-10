export function fitCommandToolbar(bar){
 if(!bar)return;
 const rows=Array.from({length:2},()=>{const row=document.createElement('div');row.className='command-row';return row;});
 let pending=false;
 const mutations=new MutationObserver(schedule);
 function observe(){mutations.observe(bar,{childList:true,subtree:true,characterData:true});}
 function fit(){
  pending=false;mutations.disconnect();
  // Re-read commands so tools installed after startup also participate.
  const items=[...bar.children].flatMap(el=>rows.includes(el)?[...el.children]:[el]);
  for(const item of items)if(item.hasAttribute('data-overflow-priority'))item.hidden=false;
  rows[0].replaceChildren(...items);rows[1].replaceChildren();bar.replaceChildren(...rows);
  const gap=parseFloat(getComputedStyle(rows[0]).columnGap)||0;
  const widths=new Map(items.map(el=>{const style=getComputedStyle(el);return [el,el.getBoundingClientRect().width+(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0)];}));
  function layout(){
   const visible=items.filter(el=>!el.hidden),total=visible.reduce((sum,el)=>sum+widths.get(el),0);
   let left=0,best={index:1,width:Infinity};
   for(let i=1;i<visible.length;i++){
    left+=widths.get(visible[i-1]);
    const width=Math.max(left+gap*(i-1),total-left+gap*(visible.length-i-1));
    if(width<best.width)best={index:i,width};
   }
   return {...best,visible};
  }
  const optional=items.filter(el=>el.hasAttribute('data-overflow-priority')).sort((a,b)=>Number(b.dataset.overflowPriority)-Number(a.dataset.overflowPriority));
  let plan=layout();
  for(const button of optional){
   if(plan.width<=bar.clientWidth)break;
   button.hidden=true;plan=layout();
  }
  const second=new Set(plan.visible.slice(plan.index));
  // Keep hidden commands in their original order for the next resize.
  let row=0;
  for(const item of items){if(second.has(item))row=1;rows[row].append(item);}
  const count=optional.filter(button=>button.hidden).length;
  const advanced=bar.querySelector('#advanced-tools');
  if(advanced)advanced.title=count?'入りきらない '+count+' コマンドを含むすべての作成・修正':'すべての作成・修正';
  bar.dataset.overflowCount=String(count);observe();
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(fit);}}
 new ResizeObserver(schedule).observe(bar);observe();
 window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);schedule();
}
