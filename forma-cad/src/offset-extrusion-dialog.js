import * as THREE from 'three';
import {findPanelSpace,projectedBounds} from './panel-placement.js';
import {createOffsetExtrusionPreview} from './offset-extrusion-preview.js';

const preferenceKey='forma-offset-extrusion-distance-v1';
export function createOffsetExtrusionDialog({getFeatures,onApply,notify,getRegions,getObjects,scene,camera,canvas,host}){
 let last=0,target=null,original=null;
 try{const text=localStorage.getItem(preferenceKey),value=text===null?0:Number(text);if(Number.isFinite(value)&&Math.abs(value)<=10000)last=value;}catch{}
 const preview=createOffsetExtrusionPreview({scene,host,canvas});let regions=[],previous=null,layoutKey='';
 const dialog=document.createElement('dialog');dialog.id='offset-extrusion-dialog';dialog.style.cssText='position:fixed;inset:auto;margin:0;width:min(300px,calc(100vw - 16px));box-sizing:border-box;padding:14px;max-height:calc(100vh - 16px);overflow:auto';
 dialog.innerHTML='<form><h2 style="margin:0 0 12px;font-size:18px">OS押出</h2><label>輪郭のオフセット距離 (mm)<input id="offset-extrusion-distance" type="number" step="any" min="-10000" max="10000" style="width:100%;box-sizing:border-box"></label><p style="font-size:12px">−で範囲を狭く、＋で広くします。空欄なら前回値を使います。</p><p id="offset-extrusion-error" role="alert" style="font-size:12px"></p><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="offset-extrusion-cancel">キャンセル</button><button class="accent" type="submit">押し出しへ</button></div></form>';
 const legend=document.createElement('p');legend.style.cssText='font-size:11px;margin:6px 0';legend.innerHTML='<span style="color:#ff8a24">━━ OS輪郭</span> ／ <span style="color:#91a7ba">┄ 元の輪郭</span>';dialog.querySelector('label').after(legend);
 const sourceHint=document.createElement('p');sourceHint.style.cssText='font-size:11px;margin:6px 0';sourceHint.textContent='外周が基準です。内側の穴は塞いで作成します。';legend.after(sourceHint);
 const style=document.createElement('style');style.textContent='#offset-extrusion-dialog::backdrop{background:#0000000a}#offset-extrusion-error{min-height:16px;margin:4px 0}';document.head.append(style);
 document.body.append(dialog);const input=dialog.querySelector('input'),error=dialog.querySelector('#offset-extrusion-error'),submit=dialog.querySelector('button[type=submit]');
 function reset(){preview.clear();target=null;original=null;regions=[];previous=null;layoutKey='';}
 function close(){if(dialog.open)dialog.close();reset();}
 function layout(){
  const rect=canvas.getBoundingClientRect(),width=window.innerWidth,height=window.innerHeight,key=[rect.x,rect.y,rect.width,rect.height,width,height].join(',');
  if(layoutKey===key)return;layoutKey=key;dialog.style.maxHeight='calc(100vh - 16px)';
  const panelWidth=dialog.offsetWidth,panelHeight=dialog.offsetHeight,point=new THREE.Vector3(...target.point).project(camera),anchor={x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
  const search={width,height,panelWidth,panelHeight,anchor,previous,margin:8,gap:12};
  // Prefer the sidebars, so even an expanded guide stays clear of the input.
  let spot=findPanelSpace({...search,obstacles:[rect]});
  if(!spot){const obstacles=[...getObjects(),...preview.objects].map(object=>projectedBounds(object,camera,rect.width,rect.height)).filter(Boolean).map(box=>({left:box.left+rect.left,right:box.right+rect.left,top:box.top+rect.top,bottom:box.bottom+rect.top}));spot=findPanelSpace({...search,obstacles});}
  // A crowded narrow viewport still has its command area above the canvas.
  // Use that area with scrolling rather than covering the selected geometry.
  if(!spot){dialog.style.maxHeight=Math.max(64,rect.top-16)+'px';spot={x:Math.max(8,Math.min(width-panelWidth-8,anchor.x-panelWidth/2)),y:8};}
  previous=spot;dialog.style.left=spot.x+'px';dialog.style.top=spot.y+'px';
 }
 function refresh(){
  error.textContent='';const value=input.value.trim()===''?last:Number(input.value);
  try{if(!Number.isFinite(value)||Math.abs(value)>10000)throw Error('−10000〜10000 mmで指定してください');preview.show(regions.map(region=>({...region,holes:[]})),value);submit.disabled=false;return value;}
  catch(cause){preview.clear();error.textContent=cause.message;submit.disabled=true;return null;}
 }
 function remember(value){if(!Number.isFinite(value)||Math.abs(value)>10000)return;last=value;try{localStorage.setItem(preferenceKey,String(last));}catch{}}
 input.addEventListener('input',refresh);
 dialog.querySelector('#offset-extrusion-cancel').onclick=close;
 dialog.addEventListener('cancel',reset);dialog.addEventListener('close',()=>{if(!dialog.open)reset();});
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();error.textContent='';
  const value=refresh();if(value===null)return;
  if(original!==getFeatures()){error.textContent='モデルが変わりました。対象を選び直してください';return;}
  const selection=target,hasHoles=regions.some(region=>region.holes?.length);remember(value);
  close();try{await onApply(selection,value,{hasHoles});}catch(cause){notify(cause.message||'OS押出を開始できませんでした');}
 };
 return {open(selection){target=selection;original=getFeatures();regions=structuredClone(getRegions(selection));input.value=String(last);error.textContent='';dialog.showModal();refresh();layout();input.focus({preventScroll:true});input.select();},close,remember,
  update(){if(!dialog.open)return;if(original!==getFeatures()){close();return;}preview.update();layout();}};
}
