import {mirrorAxisDragSnap} from './mirror-workflow.js';

export function createMirrorAxisDrag({host,controls,project,active,getDistance,setDistance,getOptions,getSpan,getDisplayDistance=null,onSnapChange=()=>{},onConfirm=()=>{}}){
 const layer=document.createElement('div');layer.id='mirror-axis-drag';layer.hidden=true;
 layer.innerHTML='<svg><line class="mirror-axis-visible"/><line class="mirror-axis-hit"/></svg><button type="button" id="mirror-axis-handle" aria-label="クリックでミラーを確定・ドラッグで位置を調整">↔<strong>＋決定</strong><span></span></button>';
 host.append(layer);const handle=layer.querySelector('button'),hit=layer.querySelector('.mirror-axis-hit'),visible=layer.querySelector('.mirror-axis-visible');
 let reference=null,chosen=null,drag=null,snapped=false,snapValue=null,suppressClick=false;
 function markSnap(next,value=null){snapped=next;snapValue=next?value:null;layer.dataset.snapped=String(next);host.dataset.mirrorSnapped=String(next);onSnapChange(next);}
 function stop(cancelled=false){if(!drag)return;const {element,id,enabled,moved}=drag;suppressClick=cancelled||moved;drag=null;controls.enabled=enabled;if(element.hasPointerCapture(id))element.releasePointerCapture(id);delete layer.dataset.dragging;}
 function update(){
  layer.hidden=!active()||!reference;if(layer.hidden){stop();if(snapped)markSnap(false);return;}
  if(snapped&&(!getOptions().snap||Math.abs(getDistance()-snapValue)>1e-7))markSnap(false);
  const ref=drag?.ref||reference,value=getDistance(),anchor=ref.base.clone().addScaledVector(ref.direction,value),axisPoint=project(anchor),axisNext=project(anchor.clone().add(ref.direction)),handleDirection=ref.handleDirection||ref.direction,handleAnchor=(ref.handleBase||ref.base).clone().addScaledVector(handleDirection,value),p=project(handleAnchor),q=project(handleAnchor.clone().add(handleDirection)),dx=q.x-p.x,dy=q.y-p.y;
  if(Math.hypot(dx,dy)<.1||p.z< -1||p.z>1){layer.hidden=true;stop();return;}
  chosen={...ref,dx,dy,axisDx:axisNext.x-axisPoint.x,axisDy:axisNext.y-axisPoint.y};const span=getSpan(),a=project(anchor.clone().addScaledVector(ref.axis,-span)),b=project(anchor.clone().addScaledVector(ref.axis,span));
  for(const line of [hit,visible])for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,value);
  handle.style.left=Math.max(32,Math.min(host.clientWidth-32,p.x))+'px';handle.style.top=Math.max(38,Math.min(host.clientHeight-48,p.y))+'px';handle.querySelector('span').textContent=(snapped?'＋ グリッド吸着 · ':'')+(ref.handleScale?'コピー ':'')+Number((getDisplayDistance?getDisplayDistance():value*(ref.handleScale||1)).toFixed(4))+' mm';handle.setAttribute('aria-label','クリックでミラーを確定・'+(ref.handleScale?'ドラッグでコピーを移動':'ドラッグでミラー軸を移動'));handle.title='クリックで確定・ドラッグで位置を調整・Shiftで微調整'+(snapped?'（グリッド '+getOptions().step+' mm に吸着中）':'');
 }
 for(const element of [handle,hit]){
  element.addEventListener('pointerdown',e=>{if(e.button!==0||!chosen)return;const dx=element===handle?chosen.dx:chosen.axisDx,dy=element===handle?chosen.dy:chosen.axisDy;if(Math.hypot(dx,dy)<.1)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();suppressClick=false;drag={element,id:e.pointerId,x:e.clientX,y:e.clientY,dx,dy,raw:getDistance(),ref:chosen,enabled:controls.enabled,moved:false};controls.enabled=false;layer.dataset.dragging='true';element.setPointerCapture(e.pointerId);});
  element.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4)return;drag.moved=true;const {dx,dy}=drag,delta=((e.clientX-drag.x)*dx+(e.clientY-drag.y)*dy)/(dx*dx+dy*dy)*(e.shiftKey?.1:1);drag.x=e.clientX;drag.y=e.clientY;drag.raw=Math.max(-10000,Math.min(10000,drag.raw+delta));const options=getOptions(),result=mirrorAxisDragSnap(drag.raw,{...options,snap:options.snap&&!e.shiftKey,pixelsPerMm:Math.hypot(dx,dy),reference:drag.ref,handle:element===handle});setDistance(result.value);markSnap(result.snapped,result.value);update();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stop(type!=='pointerup');});
  element.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(element===handle&&active()&&!suppressClick)onConfirm();suppressClick=false;});
 }
 return {setReference(ref){if(snapped&&reference&&['base','direction','handleBase','handleDirection'].some(key=>!!reference[key]!==!!ref?.[key]||reference[key]&&reference[key].distanceTo(ref[key])>1e-7))markSnap(false);reference=ref;update();onSnapChange(snapped);},update,clear(){stop();markSnap(false);reference=null;chosen=null;layer.hidden=true;delete host.dataset.mirrorSnapped;}};
}
