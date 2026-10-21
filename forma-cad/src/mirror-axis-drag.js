import {mirrorAxisDragValue} from './mirror-workflow.js';

export function createMirrorAxisDrag({host,controls,project,active,getDistance,setDistance,getOptions,getSpan}){
 const layer=document.createElement('div');layer.id='mirror-axis-drag';layer.hidden=true;
 layer.innerHTML='<svg><line class="mirror-axis-visible"/><line class="mirror-axis-hit"/></svg><button type="button" id="mirror-axis-handle" aria-label="ドラッグでミラー軸を移動">↔<span></span></button>';
 host.append(layer);const handle=layer.querySelector('button'),hit=layer.querySelector('.mirror-axis-hit'),visible=layer.querySelector('.mirror-axis-visible');
 let reference=null,chosen=null,drag=null;
 function stop(){if(!drag)return;const {element,id,enabled}=drag;drag=null;controls.enabled=enabled;if(element.hasPointerCapture(id))element.releasePointerCapture(id);delete layer.dataset.dragging;}
 function update(){
  layer.hidden=!active()||!reference;if(layer.hidden){stop();return;}
  const ref=drag?.ref||reference,value=getDistance(),anchor=ref.base.clone().addScaledVector(ref.direction,value),axisPoint=project(anchor),axisNext=project(anchor.clone().add(ref.direction)),handleDirection=ref.handleDirection||ref.direction,handleAnchor=(ref.handleBase||ref.base).clone().addScaledVector(handleDirection,value),p=project(handleAnchor),q=project(handleAnchor.clone().add(handleDirection)),dx=q.x-p.x,dy=q.y-p.y;
  if(Math.hypot(dx,dy)<.1||p.z< -1||p.z>1){layer.hidden=true;stop();return;}
  chosen={...ref,dx,dy,axisDx:axisNext.x-axisPoint.x,axisDy:axisNext.y-axisPoint.y};const span=getSpan(),a=project(anchor.clone().addScaledVector(ref.axis,-span)),b=project(anchor.clone().addScaledVector(ref.axis,span));
  for(const line of [hit,visible])for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,value);
  handle.style.left=Math.max(25,Math.min(host.clientWidth-25,p.x))+'px';handle.style.top=Math.max(30,Math.min(host.clientHeight-40,p.y))+'px';handle.querySelector('span').textContent=(ref.handleScale?'コピー ':'')+Number((value*(ref.handleScale||1)).toFixed(4))+' mm';handle.setAttribute('aria-label',ref.handleScale?'ドラッグでミラーコピーを移動':'ドラッグでミラー軸を移動');handle.title=ref.handleScale?'矢印とコピーが同じ距離で動きます。Shiftで微調整':'ドラッグでミラー軸を移動';
 }
 for(const element of [handle,hit]){
  element.addEventListener('pointerdown',e=>{if(e.button!==0||!chosen)return;const dx=element===handle?chosen.dx:chosen.axisDx,dy=element===handle?chosen.dy:chosen.axisDy;if(Math.hypot(dx,dy)<.1)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();drag={element,id:e.pointerId,x:e.clientX,y:e.clientY,dx,dy,raw:getDistance(),ref:chosen,enabled:controls.enabled};controls.enabled=false;layer.dataset.dragging='true';element.setPointerCapture(e.pointerId);});
  element.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const {dx,dy}=drag,delta=((e.clientX-drag.x)*dx+(e.clientY-drag.y)*dy)/(dx*dx+dy*dy)*(e.shiftKey?.1:1);drag.x=e.clientX;drag.y=e.clientY;drag.raw=Math.max(-10000,Math.min(10000,drag.raw+delta));const options=getOptions();setDistance(mirrorAxisDragValue(drag.raw,{...options,snap:options.snap&&!e.shiftKey,pixelsPerMm:Math.hypot(dx,dy)}));update();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stop();});
  element.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
 }
 return {setReference(ref){reference=ref;update();},update,clear(){stop();reference=null;chosen=null;layer.hidden=true;}};
}
