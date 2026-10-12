import {offsetDragValue} from './sketch-offset-workflow.js';

export function createSketchOffsetDrag({host,controls,project,active,getDistance,setDistance,getOptions,getDialog}){
 const handle=document.createElement('button');handle.id='sketch-offset-handle';handle.type='button';handle.hidden=true;handle.setAttribute('aria-label','ドラッグでオフセット距離を変更');handle.innerHTML='<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M14 24V4m-7 7 7-7 7 7"/></svg><span></span>';host.append(handle);
 let references=[],chosen=null,drag=null;
 function stop(){if(!drag)return;const id=drag.id;controls.enabled=drag.enabled;drag=null;if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);delete handle.dataset.dragging;}
 function update(){
  handle.hidden=!active()||!references.length;if(handle.hidden){stop();return;}
  const value=getDistance(),rect=host.getBoundingClientRect(),dialog=getDialog().getBoundingClientRect();
  const candidates=references.map(ref=>{const p=project(ref.base.clone().addScaledVector(ref.direction,value)),q=project(ref.base.clone().addScaledVector(ref.direction,value+1)),dx=q.x-p.x,dy=q.y-p.y;const blocked=p.x+rect.left>dialog.left-35&&p.x+rect.left<dialog.right+35&&p.y+rect.top>dialog.top-35&&p.y+rect.top<dialog.bottom+35;return {...ref,p,dx,dy,score:Math.hypot(dx,dy)+(blocked?-100000:0)+(p.x<30||p.y<30||p.x>host.clientWidth-30||p.y>host.clientHeight-50||p.z< -1||p.z>1?-100000:0)};});
  const ref=drag?drag.ref:candidates.sort((a,b)=>b.score-a.score)[0];if(!ref||Math.hypot(ref.dx,ref.dy)<.1){handle.hidden=true;stop();return;}chosen=ref;
  const p=project(ref.base.clone().addScaledVector(ref.direction,value));handle.style.left=Math.max(25,Math.min(host.clientWidth-25,p.x))+'px';handle.style.top=Math.max(25,Math.min(host.clientHeight-40,p.y))+'px';handle.querySelector('svg').style.transform='rotate('+(Math.atan2(ref.dy,ref.dx)*180/Math.PI+90)+'deg)';handle.querySelector('span').textContent=String(Number(Math.abs(value).toFixed(4)))+' mm';handle.title='ドラッグで距離を変更・Shiftで微調整（'+value+' mm）';
 }
 handle.addEventListener('pointerdown',e=>{if(e.button!==0||!chosen)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();drag={id:e.pointerId,x:e.clientX,y:e.clientY,raw:getDistance(),ref:chosen,enabled:controls.enabled};controls.enabled=false;handle.dataset.dragging='true';handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const {dx,dy}=drag.ref,delta=((e.clientX-drag.x)*dx+(e.clientY-drag.y)*dy)/(dx*dx+dy*dy)*(e.shiftKey?.1:1),options=getOptions();drag.x=e.clientX;drag.y=e.clientY;drag.raw=Math.max(options.allAround?.001:-10000,Math.min(10000,drag.raw+delta));setDistance(offsetDragValue(drag.raw,{...options,snap:options.snap&&!e.shiftKey,pixelsPerMm:Math.hypot(dx,dy)}));update();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stop();});
 handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
 return {setReferences(refs){references=refs;update();},update,clear(){stop();references=[];chosen=null;handle.hidden=true;}};
}
