import {slideLidBodyIds,setSlideLidTransparency} from './slide-lid-transparency.js';
import * as THREE from 'three';
import {isSectionSplit} from './section-split.js';
export function splitDisplayOffsets(features,gap=20){
 const offsets=new Map();
 for(const f of features){const result=f.cadResult||(f.kind==='cadop'?f:null);if(!result)continue;const hasInherited=offsets.has(f.spec?.target),inherited=offsets.get(f.spec?.target)?.clone()||new THREE.Vector3();for(const id of result.remove||[])offsets.delete(id);
  if(isSectionSplit(f)&&(f.spec.keep??'both')==='both'){
   const direction=new THREE.Vector3(...(f.spec.splitFrame?.n||{XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[f.spec.plane])).normalize();
   for(const o of result.outputs)offsets.set(o.id,inherited.clone().addScaledVector(direction,o.id===f.spec.target?-gap/2:gap/2));
  }else for(const o of result.outputs)if(hasInherited)offsets.set(o.id,inherited.clone());
 }
 return offsets;
}
export function createBodyDisplay({meshes,scene,host,hiddenBodies,getFeatures,getSelected,canChange,onChange}){
 let exploded=false,isolation=null,gap=20,offsets=new Map(),transformed=false,lidTransparent=false;
 const tools=document.createElement('div');tools.className='body-display-tools';tools.innerHTML='<button id="transparent-slide-lids" type="button" aria-pressed="false" hidden>蓋を半透明にする</button><button id="explode-bodies" type="button" aria-pressed="false" hidden>離して表示</button><button id="isolate-selection" type="button" disabled>選択だけ表示</button><button id="restore-isolation" type="button" hidden>単独表示を解除</button><label id="explode-gap-row" hidden>表示の間隔 <input id="explode-gap" type="number" min="1" max="200" step="1" value="20"> mm</label>';
 document.getElementById('body-count').parentElement.after(tools);
 const q=id=>tools.querySelector('#'+id),notice=document.createElement('div');notice.id='body-display-notice';notice.hidden=true;host.parentElement.append(notice);
 function available(){return [...meshes.keys()].filter(id=>offsets.has(id)).length>=2;}
 function update(){
  const lids=slideLidBodyIds(getFeatures());for(const [id,mesh]of meshes)setSlideLidTransparency(mesh,lidTransparent&&lids.has(id));q('transparent-slide-lids').hidden=![...lids].some(id=>meshes.has(id));q('transparent-slide-lids').disabled=!canChange();q('transparent-slide-lids').textContent=lidTransparent?'蓋を不透明に戻す':'蓋を半透明にする';q('transparent-slide-lids').setAttribute('aria-pressed',String(lidTransparent));host.dataset.transparentSlideLids=JSON.stringify(lidTransparent?[...lids].filter(id=>meshes.has(id)):[]);
  const allowed=canChange(),ids=getSelected().filter(id=>meshes.has(id));q('explode-bodies').hidden=!available();q('explode-bodies').disabled=!allowed;q('explode-bodies').textContent=exploded?'元の位置で表示':'離して表示';q('explode-bodies').setAttribute('aria-pressed',String(exploded));q('explode-bodies').title='表示だけを離します。保存・出力の位置は変わりません。編集開始時に通常表示へ戻ります。';
  q('isolate-selection').disabled=!allowed||!ids.length;q('restore-isolation').hidden=!isolation;q('restore-isolation').disabled=!allowed;q('explode-gap-row').hidden=!exploded;q('explode-gap').disabled=!allowed;
  const text=[exploded?'離して表示中（表示のみ）':'',isolation?'単独表示中':''].filter(Boolean).join(' / ');notice.hidden=!text;if(notice.textContent!==text)notice.textContent=text;
  host.dataset.exploded=String(exploded);host.dataset.isolatedBodies=JSON.stringify(isolation?[...isolation]:[]);host.dataset.displayOffsets=JSON.stringify(exploded?Object.fromEntries([...offsets].filter(([id])=>meshes.has(id)).map(([id,v])=>[id,v.toArray()])):{});
 }
 function applyVisibility(){if(isolation&&![...isolation].some(id=>meshes.has(id)))isolation=null;for(const [id,mesh] of meshes)mesh.visible=isolation?isolation.has(id):!hiddenBodies.has(id);}
 function stopExploded(silent=false){if(!exploded)return;exploded=false;update();if(!silent)onChange();}
 function attach(mesh){
  if(mesh.userData.displayRaycast)return;
  const original=mesh.raycast;
  mesh.userData.displayRaycast=function(raycaster,hits){const offset=exploded&&!transformed?offsets.get(mesh.userData.bodyId):null;if(!offset)return original.call(this,raycaster,hits);const previous=raycaster.ray;raycaster.ray=previous.clone();raycaster.ray.origin.sub(offset);try{return original.call(this,raycaster,hits);}finally{raycaster.ray=previous;}};mesh.raycast=mesh.userData.displayRaycast;
 }
 function rebuild(){exploded=false;offsets=splitDisplayOffsets(getFeatures(),gap);applyVisibility();for(const mesh of meshes.values())attach(mesh);update();}
 function isolate(ids){if(!canChange())return;const selected=ids.filter(id=>meshes.has(id));if(!selected.length)return;isolation=new Set(selected);applyVisibility();update();onChange();}
 function restoreIsolation(silent=false){if(!isolation)return;isolation=null;applyVisibility();update();if(!silent)onChange();}
 function withDisplay(action){
  if(!exploded||transformed)return action();const changed=[];transformed=true;
  const move=(object,id)=>{const offset=offsets.get(id);if(!offset)return;changed.push([object,object.position.clone()]);object.position.add(offset);object.updateMatrixWorld(true);};
  try{for(const [id,mesh] of meshes)move(mesh,id);scene.traverse(object=>{if(object.userData.displayBodyId)move(object,object.userData.displayBodyId);});return action();}
  finally{for(const [object,position] of changed){object.position.copy(position);object.updateMatrixWorld(true);}transformed=false;}
 }
 function setLidTransparent(enabled){lidTransparent=!!enabled;update();}
 q('transparent-slide-lids').onclick=()=>{if(canChange())setLidTransparent(!lidTransparent);};
 q('explode-bodies').onclick=()=>{if(!canChange()||!available())return;exploded=!exploded;update();onChange();};q('isolate-selection').onclick=()=>isolate(getSelected());q('restore-isolation').onclick=()=>restoreIsolation();
 q('explode-gap').oninput=()=>{const value=Number(q('explode-gap').value);q('explode-gap').setCustomValidity(value>=1&&value<=200?'':'表示の間隔は1〜200 mmです');if(value<1||value>200||!Number.isFinite(value))return;gap=value;offsets=splitDisplayOffsets(getFeatures(),gap);update();};
 rebuild();return {update,rebuild,setLidTransparent,get lidTransparent(){return lidTransparent;},withDisplay,isolate,restoreIsolation,stopExploded,reset(){setLidTransparent(false);stopExploded(true);restoreIsolation(true);update();},get exploded(){return exploded;},offset(id){return exploded?offsets.get(id)||new THREE.Vector3():new THREE.Vector3();}};
}
