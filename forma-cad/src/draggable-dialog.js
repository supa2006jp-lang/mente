const dragCancels=new Set();
export function cancelDialogDrags(){for(const cancel of dragCancels)cancel();}
export function draggableDialog(dialog){
 const heading=dialog.querySelector('.dialog-heading');
 heading.title='ドラッグしてウィンドウを移動（見出しにフォーカスして矢印キーでも移動）';
 heading.tabIndex=0;heading.setAttribute('aria-label','ウィンドウを移動：ドラッグまたは矢印キー');heading.style.touchAction='none';heading.style.userSelect='none';heading.style.cursor='grab';
 let position=null,drag=null;
 function place(){
  if(!dialog.open)return;
  const r=dialog.getBoundingClientRect(),maxX=Math.max(8,innerWidth-r.width-8),maxY=Math.max(8,innerHeight-r.height-8);
  const x=Math.max(8,Math.min(maxX,position?.x??maxX-8)),y=Math.max(8,Math.min(maxY,position?.y??maxY-8));
  Object.assign(dialog.style,{left:x+'px',top:y+'px',right:'auto',bottom:'auto'});
  if(position)dialog.dataset.dialogPosition='manual';
  if(position)position={x,y};
 }
 heading.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button,input,select,a'))return;
  const r=dialog.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
  e.preventDefault();e.stopPropagation();heading.setPointerCapture(e.pointerId);heading.classList.add('dragging');
 });
 heading.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();position={x:drag.left+e.clientX-drag.x,y:drag.top+e.clientY-drag.y};place();});
 heading.addEventListener('keydown',e=>{if(e.target!==heading||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const r=dialog.getBoundingClientRect(),step=e.shiftKey?1:20;position={x:r.left+({'ArrowLeft':-step,'ArrowRight':step}[e.key]||0),y:r.top+({'ArrowUp':-step,'ArrowDown':step}[e.key]||0)};place();});
 function finish(e){if(!drag||e.pointerId!==drag.id)return;drag=null;heading.classList.remove('dragging');if(heading.hasPointerCapture(e.pointerId))heading.releasePointerCapture(e.pointerId);}
 dragCancels.add(()=>{if(drag)finish({pointerId:drag.id});});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])heading.addEventListener(type,finish);
 new MutationObserver(place).observe(dialog,{attributes:true,attributeFilter:['open']});
 new ResizeObserver(place).observe(dialog);window.addEventListener('resize',place);
}
