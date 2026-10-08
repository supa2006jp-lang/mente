import * as THREE from 'three';
import {pointReferenceLabel} from './selected-point.js';
const fixed=value=>(Math.abs(value)<.005?0:value).toFixed(2);
export function distanceBetweenPoints(a,b){
 if(![a,b].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw Error('測定点の座標が不正です');
 const delta=b.map((v,i)=>v-a[i]);return {distance:Math.hypot(...delta),delta};
}
export function createPointDistance({host,canvas,camera,container,getRevision,getBodyName,isVisible,onHint}){
 const section=document.createElement('section');section.id='point-distance';section.hidden=true;
 section.innerHTML='<strong>2点間の距離</strong><p data-a></p><p data-b></p><b data-distance></b><p data-delta></p><p data-hint></p><div><button type="button" data-again>2点目を選び直す</button><button type="button" data-clear>測定を終了</button></div>';container.append(section);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='point-distance-overlay';svg.setAttribute('hidden','');svg.setAttribute('aria-hidden','true');svg.innerHTML='<defs><clipPath id="point-distance-clip"><rect/></clipPath></defs><g clip-path="url(#point-distance-clip)"><line stroke="white" stroke-width="5"/><line stroke="#197b94" stroke-width="2" stroke-dasharray="6 4"/><circle data-a r="7" fill="#19855b" stroke="white" stroke-width="2"/><circle data-b r="7" fill="#9250dc" stroke="white" stroke-width="2"/><text data-a fill="#126744">A</text><text data-b fill="#7034b2">B</text><text data-distance fill="#125466" text-anchor="middle"/></g>';host.parentElement.append(svg);
 const style=document.createElement('style');style.textContent='#point-distance{border-top:1px solid #b9cbd4;padding-top:8px;max-width:320px;pointer-events:auto;font-size:12px}#point-distance[hidden],#point-distance-overlay[hidden]{display:none}#point-distance p{margin:5px 0;line-height:1.5;overflow-wrap:anywhere}#point-distance b{display:block;font-size:22px;color:#125466}#point-distance button{color:#234457;background:#e7f7ff;border:1px solid #7fb6d4;border-radius:5px;padding:6px;font-size:12px;margin:3px 4px 0 0}#point-distance button:hover,#point-distance button:focus-visible{background:#d0efff;outline:2px solid #087ca5}#point-distance-overlay{position:absolute;inset:0;width:100%;height:100%;z-index:15;pointer-events:none}#point-distance-overlay text{font-size:13px;font-weight:bold;paint-order:stroke;stroke:white;stroke-width:4px}#measurement:has(#point-distance:not([hidden])){max-height:calc(100% - 180px);bottom:140px;overflow:auto;z-index:25;background:#fffef6}#measurement:has(#point-distance:not([hidden]))>:not(#point-distance){display:none!important}';document.head.append(style);
 let source=null,target=null,revision=null;
 const at=selector=>section.querySelector(selector),copy=ref=>({...ref,point:[...ref.point],normal:[...(ref.normal||[0,0,1])]});
 function reset(){source=target=revision=null;section.hidden=true;svg.setAttribute('hidden','');delete host.dataset.pointDistance;}
 function begin(reference){distanceBetweenPoints(reference.point,reference.point);source=copy(reference);target=null;revision=getRevision();onHint?.('2点目の中心・中点・頂点を選択してください');render();}
 function render(){
  if(!source)return;
  const label=ref=>pointReferenceLabel(ref,getBodyName)+' ('+ref.point.map(fixed).join(', ')+') mm';
  at('[data-a]').textContent='A：'+label(source);at('[data-b]').textContent=target?'B：'+label(target):'B：中心・中点・頂点を選択してください';
  const result=target?distanceBetweenPoints(source.point,target.point):null;
  at('[data-distance]').textContent=result?fixed(result.distance)+' mm':'';
  at('[data-delta]').textContent=result?result.delta.map((v,i)=>'Δ'+['X','Y','Z'][i]+' '+(v>=.005?'+':'')+fixed(v)).join(' / ')+' mm':'';
  at('[data-hint]').textContent=result?'差はAからBの方向です。別の点を選ぶとBを更新します。':'面や辺をクリックし、選択候補から中心・中点・頂点を選べます。';
  at('[data-again]').hidden=!target;
  host.dataset.pointDistance=JSON.stringify({a:source.point,b:target?.point||null,aBody:source.bodyId||null,bBody:target?.bodyId||null,...result});
 }
 at('[data-clear]').onclick=reset;at('[data-again]').onclick=()=>{target=null;render();onHint?.('2点目の中心・中点・頂点を選び直してください');};
 const project=point=>{const p=new THREE.Vector3(...point).project(camera);if(p.z< -1||p.z>1)return null;const r=canvas.getBoundingClientRect(),v=host.parentElement.getBoundingClientRect();return {x:r.left-v.left+(p.x+1)*r.width/2,y:r.top-v.top+(1-p.y)*r.height/2};};
 function update(enabled=true){
  if(source&&(revision!==getRevision()||![source,target].filter(Boolean).every(isVisible)))reset();
  section.hidden=!source||!enabled;svg.setAttribute('hidden','');if(section.hidden)return false;
  render();const a=project(source.point),b=target?project(target.point):null,r=canvas.getBoundingClientRect(),v=host.parentElement.getBoundingClientRect(),clip=svg.querySelector('clipPath rect');
  for(const [key,value]of Object.entries({x:r.left-v.left,y:r.top-v.top,width:r.width,height:r.height}))clip.setAttribute(key,value);
  for(const [name,point]of [['a',a],['b',b]]){const dot=svg.querySelector('circle[data-'+name+']'),text=svg.querySelector('text[data-'+name+']');dot.style.display=text.style.display=point?'':'none';if(point){dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);text.setAttribute('x',point.x+12);text.setAttribute('y',point.y-12);text.textContent=name.toUpperCase();}}
  for(const line of svg.querySelectorAll('line')){line.style.display=a&&b?'':'none';if(a&&b)for(const [key,value]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,value);}
  const length=svg.querySelector('text[data-distance]');length.style.display=a&&b?'':'none';if(a&&b){length.setAttribute('x',(a.x+b.x)/2);length.setAttribute('y',(a.y+b.y)/2-12);length.textContent=fixed(distanceBetweenPoints(source.point,target.point).distance)+' mm';}
  svg.toggleAttribute('hidden',!a);return true;
 }
 return {begin,reset,accept(reference){if(!source)return;target=copy(reference);render();},update,get active(){return !!source;}};
}
