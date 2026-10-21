import {mirrorAxisDragSnap} from './mirror-workflow.js';

export function createMirrorAxisDrag({host,controls,project,active,getDistance,setDistance,getOptions,getSpan,getDisplayDistance=null,onSnapChange=()=>{},onConfirm=()=>{}}){
 const layer=document.createElement('div');layer.id='mirror-axis-drag';layer.hidden=true;
 layer.innerHTML='<svg><defs><marker id="mirror-dimension-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z"/></marker></defs><line class="mirror-axis-visible"/><line class="mirror-axis-hit"/><g id="mirror-distance-dimension" role="img"><line class="mirror-dimension-extension source"/><line class="mirror-dimension-extension copy"/><line class="mirror-dimension-line"/><circle class="mirror-dimension-source" r="4"/><circle class="mirror-dimension-copy" r="4"/><text class="mirror-dimension-source-name">元</text><text class="mirror-dimension-copy-name">コピー</text><text class="mirror-dimension-value" text-anchor="middle"/></g></svg><button type="button" id="mirror-axis-handle" aria-label="クリックでミラーを確定・ドラッグで位置を調整">↔<strong>＋決定</strong><span></span></button>';
 host.append(layer);const handle=layer.querySelector('button'),hit=layer.querySelector('.mirror-axis-hit'),visible=layer.querySelector('.mirror-axis-visible');
 let reference=null,chosen=null,drag=null,snapped=false,snapValue=null,suppressClick=false;
 const dimension=layer.querySelector('#mirror-distance-dimension');
 const attrs=(element,values)=>{for(const [key,value] of Object.entries(values))element.setAttribute(key,value);};
 function drawDimension(ref,target,travel){
  dimension.style.display=ref.sourceCenter?'':'none';if(!ref.sourceCenter){delete host.dataset.mirrorDimension;return;}
  const a=project(ref.sourceCenter),b=project(target);if(a.z< -1||a.z>1||b.z< -1||b.z>1){dimension.style.display='none';delete host.dataset.mirrorDimension;return;}
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=length>1?dy/length:0,ny=length>1?-dx/length:-1,side=ny>0?-1:1,ox=nx*side*52,oy=ny*side*52;
  for(const [name,p] of [['source',a],['copy',b]]){attrs(dimension.querySelector('.mirror-dimension-extension.'+name),{x1:p.x,y1:p.y,x2:p.x+ox,y2:p.y+oy});attrs(dimension.querySelector('.mirror-dimension-'+name),{cx:p.x,cy:p.y});const label=dimension.querySelector('.mirror-dimension-'+name+'-name');label.style.display=length<2?'none':'';attrs(label,{x:p.x+8,y:p.y-10});}
  attrs(dimension.querySelector('.mirror-dimension-line'),{x1:a.x+ox,y1:a.y+oy,x2:b.x+ox,y2:b.y+oy,'marker-start':length<2?'none':'url(#mirror-dimension-arrow)','marker-end':length<2?'none':'url(#mirror-dimension-arrow)'});
  const value=Number(travel.toFixed(4)),text=dimension.querySelector('.mirror-dimension-value');text.textContent=(length<2?'元・コピー：':'元 → コピー：')+value+' mm';attrs(text,{x:Math.max(110,Math.min(host.clientWidth-110,(a.x+b.x)/2+ox)),y:Math.max(20,Math.min(host.clientHeight-20,(a.y+b.y)/2+oy-10))});dimension.setAttribute('aria-label','元とコピーの中心間の移動距離 '+value+' mm');host.dataset.mirrorDimension=JSON.stringify({source:ref.sourceCenter.toArray(),copy:target.toArray(),travel:value});
 }
 function markSnap(next,value=null){snapped=next;snapValue=next?value:null;layer.dataset.snapped=String(next);host.dataset.mirrorSnapped=String(next);onSnapChange(next);}
 function stop(cancelled=false){if(!drag)return;const {element,id,enabled,moved}=drag;suppressClick=cancelled||moved;drag=null;controls.enabled=enabled;if(element.hasPointerCapture(id))element.releasePointerCapture(id);delete layer.dataset.dragging;}
 function update(){
  layer.hidden=!active()||!reference;if(layer.hidden){stop();if(snapped)markSnap(false);delete host.dataset.mirrorDimension;return;}
  if(snapped&&(!getOptions().snap||Math.abs(getDistance()-snapValue)>1e-7))markSnap(false);
  const ref=drag?.ref||reference,value=getDistance(),anchor=ref.base.clone().addScaledVector(ref.direction,value),axisPoint=project(anchor),axisNext=project(anchor.clone().add(ref.direction)),handleDirection=ref.handleDirection||ref.direction,handleAnchor=(ref.handleBase||ref.base).clone().addScaledVector(handleDirection,value),p=project(handleAnchor),q=project(handleAnchor.clone().add(handleDirection)),dx=q.x-p.x,dy=q.y-p.y;
  if(Math.hypot(dx,dy)<.1||p.z< -1||p.z>1){layer.hidden=true;stop();return;}
  chosen={...ref,dx,dy,axisDx:axisNext.x-axisPoint.x,axisDy:axisNext.y-axisPoint.y};const span=getSpan(),a=project(anchor.clone().addScaledVector(ref.axis,-span)),b=project(anchor.clone().addScaledVector(ref.axis,span));
  for(const line of [hit,visible])for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,value);
  drawDimension(ref,handleAnchor,getDisplayDistance?getDisplayDistance():value*(ref.handleScale||1));
  handle.style.left=Math.max(32,Math.min(host.clientWidth-32,p.x))+'px';handle.style.top=Math.max(38,Math.min(host.clientHeight-48,p.y))+'px';handle.querySelector('span').textContent=(snapped?'＋ グリッド吸着 · ':'')+(ref.handleScale?'コピー ':'')+Number((getDisplayDistance?getDisplayDistance():value*(ref.handleScale||1)).toFixed(4))+' mm';handle.setAttribute('aria-label','クリックでミラーを確定・'+(ref.handleScale?'ドラッグでコピーを移動':'ドラッグでミラー軸を移動'));handle.title='クリックで確定・ドラッグで位置を調整・Shiftで微調整'+(snapped?'（グリッド '+getOptions().step+' mm に吸着中）':'');
 }
 for(const element of [handle,hit]){
  element.addEventListener('pointerdown',e=>{if(e.button!==0||!chosen)return;const dx=element===handle?chosen.dx:chosen.axisDx,dy=element===handle?chosen.dy:chosen.axisDy;if(Math.hypot(dx,dy)<.1)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();suppressClick=false;drag={element,id:e.pointerId,x:e.clientX,y:e.clientY,dx,dy,raw:getDistance(),ref:chosen,enabled:controls.enabled,moved:false};controls.enabled=false;layer.dataset.dragging='true';element.setPointerCapture(e.pointerId);});
  element.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4)return;drag.moved=true;const {dx,dy}=drag,delta=((e.clientX-drag.x)*dx+(e.clientY-drag.y)*dy)/(dx*dx+dy*dy)*(e.shiftKey?.1:1);drag.x=e.clientX;drag.y=e.clientY;drag.raw=Math.max(-10000,Math.min(10000,drag.raw+delta));const options=getOptions(),result=mirrorAxisDragSnap(drag.raw,{...options,snap:options.snap&&!e.shiftKey,pixelsPerMm:Math.hypot(dx,dy),reference:drag.ref,handle:element===handle});setDistance(result.value);markSnap(result.snapped,result.value);update();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stop(type!=='pointerup');});
  element.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(element===handle&&active()&&!suppressClick)onConfirm();suppressClick=false;});
 }
 return {setReference(ref){if(snapped&&reference&&['base','direction','handleBase','handleDirection'].some(key=>!!reference[key]!==!!ref?.[key]||reference[key]&&reference[key].distanceTo(ref[key])>1e-7))markSnap(false);reference=ref;update();onSnapChange(snapped);},update,clear(){stop();markSnap(false);reference=null;chosen=null;layer.hidden=true;delete host.dataset.mirrorSnapped;delete host.dataset.mirrorDimension;}};
}
