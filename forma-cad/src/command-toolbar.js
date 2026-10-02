export function fitCommandToolbar(bar){
 const optional=[...bar.querySelectorAll('[data-overflow-priority]')].sort((a,b)=>Number(a.dataset.overflowPriority)-Number(b.dataset.overflowPriority));let pending=false;
 function fit(){pending=false;for(const button of optional)button.hidden=false;const style=getComputedStyle(bar),gap=parseFloat(style.columnGap)||0;let required=[...bar.children].reduce((sum,el)=>sum+el.getBoundingClientRect().width,0)+gap*(bar.children.length-1);
  for(const button of [...optional].reverse()){if(required<=bar.clientWidth)break;required-=button.getBoundingClientRect().width+gap;button.hidden=true;}
  const count=optional.filter(b=>b.hidden).length;document.getElementById('advanced-tools').title=count?'入りきらない '+count+' コマンドを含むすべての作成・修正':'すべての作成・修正';bar.dataset.overflowCount=String(count);
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(fit);}}new ResizeObserver(schedule).observe(bar);window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);schedule();
}
