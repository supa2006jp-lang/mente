const dragCancels=new Set();
export function cancelPanelDrags(){for(const cancel of dragCancels)cancel();}
export function draggablePanel(panel,title,{topMargin=()=>0,resetOnHide=false}={}){
 if(!panel)return;const handle=document.createElement('div');handle.className='panel-drag-handle';handle.textContent=title;handle.title='ドラッグして移動';panel.prepend(handle);let drag=null,position=null;
 function place(){if(!position||panel.hidden)return;const parent=panel.offsetParent||document.documentElement,r=parent.getBoundingClientRect();position.x=Math.max(0,Math.min(Math.max(0,r.width-panel.offsetWidth),position.x));const minTop=Math.min(topMargin(),Math.max(0,r.height-panel.offsetHeight));position.y=Math.max(minTop,Math.min(Math.max(minTop,r.height-panel.offsetHeight),position.y));panel.dataset.panelPosition='manual';panel.style.setProperty('--panel-left',position.x+'px');panel.style.setProperty('--panel-top',position.y+'px');}
 handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=panel.getBoundingClientRect(),parent=(panel.offsetParent||document.documentElement).getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left-parent.left,top:r.top-parent.top};e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();position={x:drag.left+e.clientX-drag.x,y:drag.top+e.clientY-drag.y};place();});
 function finish(e){if(!drag||drag.id!==e.pointerId)return;drag=null;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);}
 dragCancels.add(()=>{if(drag)finish({pointerId:drag.id});});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
 new ResizeObserver(place).observe(panel);window.addEventListener('resize',place);new MutationObserver(()=>{if(resetOnHide&&panel.hidden){if(drag)finish({pointerId:drag.id});position=null;delete panel.dataset.panelPosition;panel.style.removeProperty('--panel-left');panel.style.removeProperty('--panel-top');}else place();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
}
