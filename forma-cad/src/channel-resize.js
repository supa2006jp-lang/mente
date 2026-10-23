import * as THREE from 'three';
import {basisFor} from './frames.js';
import {channelParameters} from './channel-sketch.js';

export function channelResizeHandles(feature){
 const p=channelParameters(feature);if(!p)return [];
 const b=basisFor(feature),a=p.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),center=new THREE.Vector3(p.x,p.y,p.z);
 const axes={width:b.u.clone().multiplyScalar(c).addScaledVector(b.v,s),height:b.u.clone().multiplyScalar(-s).addScaledVector(b.v,c)};
 return ['width','height'].flatMap(key=>[-1,1].map(sign=>{const direction=axes[key].clone().multiplyScalar(sign);return {key,sign,center:center.clone(),direction,point:center.clone().addScaledVector(direction,p[key]/2),normal:b.n.clone(),size:p[key]};}));
}

// Resize along one local axis, keeping the center and the other dimension fixed.
// Compare attraction in pixels, and reject vertices from other sketch planes.
export function snapChannelResize(handle,raw,{enabled=true,step=10,project,references=[],basis,tolerance=8}={}){
 const size=Math.max(.1,Math.min(10000,raw)),point=handle.center.clone().addScaledVector(handle.direction,size/2),screen=project(point);
 if(!enabled)return {size,point,kind:null};
 let best=null,distance=tolerance;
 function consider(half,kind,target=null){
  if(!Number.isFinite(half)||half<.05||half>5000)return;
  const candidate=handle.center.clone().addScaledVector(handle.direction,half),p=project(candidate);
  if(p.z< -1||p.z>1)return;
  const d=Math.hypot(p.x-screen.x,p.y-screen.y);
  if(target&&candidate.distanceTo(target)>1e-5)return;
  if(d<distance){distance=d;best={size:half*2,point:candidate,kind};}
 }
 // Vertices take priority over the grid at equal distances.
 for(const ref of references){const target=ref.isVector3?ref:new THREE.Vector3(...ref);if(Math.abs(target.clone().sub(handle.center).dot(handle.normal))>1e-5)continue;consider(target.clone().sub(handle.center).dot(handle.direction),'vertex',target);}
 if(!best&&Number.isFinite(step)&&step>0)for(const axis of [basis.u,basis.v]){
  const slope=handle.direction.dot(axis);if(Math.abs(slope)<1e-8)continue;
  const coordinate=point.dot(axis),nearest=Math.round(coordinate/step)*step;
  consider((nearest-handle.center.dot(axis))/slope,'grid');
 }
 return best||{size,point,kind:null};
}

export function createChannelResize({host,controls,project,getFeature,getSnap,getReferences,onResize}){
 const layer=document.createElement('div');layer.id='channel-resize';layer.hidden=true;layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:12';
 const readout=document.createElement('span');readout.hidden=true;readout.style.cssText='position:absolute;padding:5px 8px;border:1px solid #86aebe;border-radius:5px;background:#f4fbfff0;color:#17475a;white-space:nowrap;font:12px sans-serif;transform:translate(-50%,0)';layer.append(readout);
 const buttons=new Map();let drag=null,feature=null,snap=null;
 for(const key of ['width','height'])for(const sign of [-1,1]){
  const button=document.createElement('button');button.type='button';button.dataset.channelResize=key+(sign<0?'-':'+');button.textContent=key==='width'?'↔':'↕';button.setAttribute('aria-label',(sign<0?'負側':'正側')+'から'+(key==='width'?'幅':'高さ')+'を調整');button.title='ドラッグで'+(key==='width'?'幅':'高さ')+'を調整（中心固定）・Shiftで微調整／吸着解除';button.style.cssText='position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;min-width:0;padding:0;border:2px solid white;border-radius:50%;background:#087ca5;color:white;box-shadow:0 1px 5px #173a4f66;font:bold 20px sans-serif;line-height:24px;pointer-events:auto;touch-action:none';layer.append(button);buttons.set(button.dataset.channelResize,button);
  button.addEventListener('pointerdown',event=>{
   if(event.button!==0||!feature||drag)return;const handle=channelResizeHandles(feature).find(h=>h.key===key&&h.sign===sign),p=handle&&project(handle.point),q=handle&&project(handle.point.clone().add(handle.direction));if(!handle||Math.hypot(q.x-p.x,q.y-p.y)<.1)return;
   event.preventDefault();event.stopPropagation();document.activeElement?.blur();drag={button,id:event.pointerId,feature,handle,x:event.clientX,y:event.clientY,dx:q.x-p.x,dy:q.y-p.y,raw:handle.size,original:handle.size,enabled:controls.enabled,references:getReferences(feature),moved:false};controls.enabled=false;button.setPointerCapture(event.pointerId);update(feature);
  });
  button.addEventListener('pointermove',event=>{
   if(drag?.id!==event.pointerId||drag.button!==button)return;event.preventDefault();event.stopPropagation();if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3)return;drag.moved=true;
   const delta=((event.clientX-drag.x)*drag.dx+(event.clientY-drag.y)*drag.dy)/(drag.dx**2+drag.dy**2);drag.x=event.clientX;drag.y=event.clientY;drag.raw=Math.max(.1,Math.min(10000,drag.raw+2*delta*(event.shiftKey?.1:1)));
   const options=getSnap();snap=snapChannelResize(drag.handle,drag.raw,{...options,enabled:options.enabled&&!event.shiftKey&&!event.altKey,project,references:drag.references,basis:basisFor(drag.feature)});onResize(key,Number(snap.size.toFixed(snap.kind?8:4)));update(getFeature());
  });
  button.addEventListener('pointerup',event=>{if(drag?.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();stop(false);});
  for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(drag?.id===event.pointerId)stop(true);});
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
 }
 host.append(layer);
 function stop(cancelled){if(!drag)return;const state=drag;drag=null;controls.enabled=state.enabled;snap=null;if(cancelled&&state.moved&&getFeature()?.id===state.feature.id)onResize(state.handle.key,state.original);if(state.button.hasPointerCapture(state.id))state.button.releasePointerCapture(state.id);readout.hidden=true;update(getFeature());}
 function hide(){stop(true);feature=null;layer.hidden=true;delete host.dataset.channelResize;}
 function update(next){
  if(!next){hide();return;}if(drag&&next.id!==drag.feature.id){stop(true);return;}feature=next;const handles=channelResizeHandles(next);if(!handles.length){hide();return;}layer.hidden=false;const state=[];
  for(const handle of handles){const button=buttons.get(handle.key+(handle.sign<0?'-':'+')),p=project(handle.point),q=project(handle.point.clone().add(handle.direction)),dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy);button.hidden=length<.1||p.z< -1||p.z>1||p.x<0||p.y<0||p.x>host.clientWidth||p.y>host.clientHeight;if(button.hidden)continue;
   const x=p.x+18*dx/length,y=p.y+18*dy/length,active=drag?.button===button,snapped=active&&!!snap?.kind;button.style.left=x+'px';button.style.top=y+'px';button.style.background=snapped?'#07845e':'#087ca5';button.dataset.snapped=String(snapped);button.dataset.value=String(handle.size);state.push({key:handle.key,sign:handle.sign,point:handle.point.toArray(),screen:[x,y],size:handle.size,snap:snapped?snap.kind:null});
   if(active){readout.hidden=false;readout.textContent=(handle.key==='width'?'幅 ':'高さ ')+Number(handle.size.toFixed(4))+' mm'+(snapped?(snap.kind==='vertex'?' · 頂点に吸着':' · グリッドに吸着'):' · 中心固定');readout.style.left=Math.max(100,Math.min(host.clientWidth-100,x))+'px';readout.style.top=Math.max(4,Math.min(host.clientHeight-30,y+23))+'px';readout.style.color=snapped?'#066548':'#17475a';}
  }
  host.dataset.channelResize=JSON.stringify(state);
 }
 window.addEventListener('blur',()=>stop(true));
 return {update,hide,cancelDrag(){if(!drag)return false;stop(true);return true;},get dragging(){return !!drag;}};
}
