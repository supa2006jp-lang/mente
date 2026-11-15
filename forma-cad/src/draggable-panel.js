const dragCancels=new Set();
export function cancelPanelDrags(){for(const cancel of dragCancels)cancel();}
export function draggablePanel(panel,title,{topMargin=()=>0,resetOnHide=false,handle,resizeTarget,onPositionChange,onPositionCommit,initialPosition=null}={}){
 if(!panel)return;
 if(!handle){
  handle=document.createElement('div');handle.textContent=title;panel.prepend(handle);
 }
 handle.classList.add('panel-drag-handle');handle.title='ドラッグして移動';
 let drag=null,position=initialPosition;
 function currentPosition(){
  const bounds=panel.getBoundingClientRect(),parent=(panel.offsetParent||document.documentElement).getBoundingClientRect();
  return {x:bounds.left-parent.left,y:bounds.top-parent.top};
 }
 function place(){
  if(!position||panel.hidden)return;
  const bounds=(panel.offsetParent||document.documentElement).getBoundingClientRect();
  position.x=Math.max(0,Math.min(Math.max(0,bounds.width-panel.offsetWidth),position.x));
  const minTop=Math.min(topMargin(),Math.max(0,bounds.height-panel.offsetHeight));
  position.y=Math.max(minTop,Math.min(Math.max(minTop,bounds.height-panel.offsetHeight),position.y));
  const changed=panel.dataset.panelPosition!=='manual';
  panel.dataset.panelPosition='manual';
  panel.style.setProperty('--panel-left',position.x+'px');
  panel.style.setProperty('--panel-top',position.y+'px');
  if(changed)onPositionChange?.(true);
 }
 handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const start=currentPosition();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:start.x,top:start.y};e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();drag.moved=true;position={x:drag.left+e.clientX-drag.x,y:drag.top+e.clientY-drag.y};place();});
 function finish(e){
  if(!drag||drag.id!==e.pointerId)return;
  const moved=drag.moved;
  drag=null;
  if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
  if(moved&&position)onPositionCommit?.(position);
 }
 function reset(){
  if(drag)finish({pointerId:drag.id});
  position=null;
  const changed=panel.dataset.panelPosition==='manual';
  delete panel.dataset.panelPosition;
  panel.style.removeProperty('--panel-left');
  panel.style.removeProperty('--panel-top');
  if(changed)onPositionChange?.(false);
 }
 dragCancels.add(()=>{if(drag)finish({pointerId:drag.id});});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
 const observer=new ResizeObserver(place);
 observer.observe(panel);
 if(resizeTarget)observer.observe(resizeTarget);
 window.addEventListener('resize',place);
 new MutationObserver(()=>{if(resetOnHide&&panel.hidden)reset();else place();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 return {reset,fix(){position=currentPosition();place();onPositionCommit?.(position);}};
}
