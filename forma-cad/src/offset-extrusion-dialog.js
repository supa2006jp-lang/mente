import * as THREE from 'three';
import {findPanelSpace,projectedBounds} from './panel-placement.js';
import {createOffsetExtrusionPreview} from './offset-extrusion-preview.js';

const preferenceKey='forma-offset-extrusion-distance-v1';
export function createOffsetExtrusionDialog({getFeatures,onApply,notify,getRegions,getObjects,scene,camera,canvas,host}){
 let last=0,target=null,original=null;
 try{const text=localStorage.getItem(preferenceKey),value=text===null?0:Number(text);if(Number.isFinite(value)&&Math.abs(value)<=10000)last=value;}catch{}
 const preview=createOffsetExtrusionPreview({scene,host,canvas});let regions=[],previous=null,layoutKey='';
 const dialog=document.createElement('dialog');dialog.id='offset-extrusion-dialog';dialog.style.cssText='position:fixed;inset:auto;margin:0;width:min(250px,calc(100vw - 16px));box-sizing:border-box;padding:8px;max-height:calc(100vh - 16px);overflow:auto';
 dialog.setAttribute('aria-labelledby','offset-extrusion-label');
 dialog.innerHTML='<form><label id="offset-extrusion-label" for="offset-extrusion-distance">OS押出 (mm)</label><div style="display:flex;align-items:center;gap:5px;margin-top:4px"><input id="offset-extrusion-distance" type="number" step="any" min="-10000" max="10000" title="外周が基準。−で狭く、＋で広く。空欄は前回値。Enterで押し出しへ。" style="width:100%;min-width:0;box-sizing:border-box"><button type="button" id="offset-extrusion-cancel" title="キャンセル（Esc）">キャンセル</button><button class="accent" type="submit" title="押し出しへ（Enter）">押出</button></div><p id="offset-extrusion-error" role="alert" hidden></p></form>';
 const style=document.createElement('style');style.textContent='#offset-extrusion-dialog::backdrop{background:#0000000a}#offset-extrusion-dialog form{padding:0;display:block}#offset-extrusion-dialog label{font-size:12px;margin:0}#offset-extrusion-dialog button{font-size:11px;padding:3px 6px;min-height:28px;white-space:nowrap}#offset-extrusion-dialog input{font-size:14px;padding:4px 6px;min-height:30px;margin:0}#offset-extrusion-error{font-size:11px;margin:5px 0 0}#offset-extrusion-error[hidden]{display:none}';document.head.append(style);
 document.body.append(dialog);const input=dialog.querySelector('input'),error=dialog.querySelector('#offset-extrusion-error'),submit=dialog.querySelector('button[type=submit]');
 function reset(){preview.clear();target=null;original=null;regions=[];previous=null;layoutKey='';}
 function close(){if(dialog.open)dialog.close();reset();}
 function layout(){
  const rect=canvas.getBoundingClientRect(),width=window.innerWidth,height=window.innerHeight,key=[rect.x,rect.y,rect.width,rect.height,width,height].join(',');
  if(layoutKey===key)return;layoutKey=key;dialog.style.maxHeight='calc(100vh - 16px)';
  const panelWidth=dialog.offsetWidth,panelHeight=dialog.offsetHeight,point=new THREE.Vector3(...target.point).project(camera),anchor={x:(point.x+1)*rect.width/2,y:(1-point.y)*rect.height/2};
  const obstacles=[...getObjects(),...preview.objects].map(object=>projectedBounds(object,camera,rect.width,rect.height)).filter(Boolean);
  for(const element of host.parentElement.querySelectorAll('#snap-controls,.view-cube,#reference-plane-control,.navigation,#measurement')){if(element.hidden)continue;const box=element.getBoundingClientRect();if(box.width&&box.height)obstacles.push({left:box.left-rect.left,right:box.right-rect.left,top:box.top-rect.top,bottom:box.bottom-rect.top});}
  const spot=findPanelSpace({width:rect.width,height:rect.height,panelWidth,panelHeight,anchor,previous,obstacles,margin:8,gap:12})||{x:Math.max(8,Math.min(rect.width-panelWidth-8,anchor.x+28)),y:8};
  previous=spot;dialog.style.left=Math.max(8,Math.min(width-panelWidth-8,rect.left+spot.x))+'px';dialog.style.top=Math.max(8,Math.min(height-panelHeight-8,rect.top+spot.y))+'px';
 }
 function refresh(){
  error.textContent='';error.hidden=true;const value=input.value.trim()===''?last:Number(input.value);
  try{if(!Number.isFinite(value)||Math.abs(value)>10000)throw Error('−10000〜10000 mmで指定してください');preview.show(regions.map(region=>({...region,holes:[]})),value);submit.disabled=false;return value;}
  catch(cause){preview.clear();error.textContent=cause.message;error.hidden=false;submit.disabled=true;return null;}
 }
 function remember(value){if(!Number.isFinite(value)||Math.abs(value)>10000)return;last=value;try{localStorage.setItem(preferenceKey,String(last));}catch{}}
 input.addEventListener('input',refresh);
 dialog.querySelector('#offset-extrusion-cancel').onclick=close;
 dialog.addEventListener('cancel',reset);dialog.addEventListener('close',()=>{if(!dialog.open)reset();});
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();error.textContent='';
  const value=refresh();if(value===null)return;
  if(original!==getFeatures()){error.textContent='モデルが変わりました。対象を選び直してください';error.hidden=false;return;}
  const selection=target,hasHoles=regions.some(region=>region.holes?.length);remember(value);
  close();try{await onApply(selection,value,{hasHoles});}catch(cause){notify(cause.message||'OS押出を開始できませんでした');}
 };
 return {open(selection){target=selection;original=getFeatures();regions=structuredClone(getRegions(selection));input.value=String(last);error.textContent='';dialog.showModal();refresh();layout();input.focus({preventScroll:true});input.select();},close,remember,
  update(){if(!dialog.open)return;if(original!==getFeatures()){close();return;}preview.update();layout();}};
}
