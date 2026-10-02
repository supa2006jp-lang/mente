import * as THREE from 'three';
import {analyzeCoilPrint} from './coil-print-check.js';

// Display-only checks never change the model or its exported triangles.
export function createCoilPrintTools(parent,{scene,getOutputs,exportPiece,onState}){
 const field=document.createElement('fieldset');field.id='coil-print-settings';field.className='coil-settings-group';
 field.innerHTML='<legend>試し刷り・形状確認</legend><button id="coil-test-export" type="button" disabled>接合部だけの試し刷りSTL</button><p class="coil-field-hint">収納部分を短くし、現在のコイル・爪・受けを残します。本体と蓋をXY上に並べて出力。</p><label class="coil-joint-check"><input id="coil-print-highlight" type="checkbox"> 薄い箇所・張り出しを色表示</label><label>薄さの判定 (mm)<input id="coil-print-thickness" type="text" inputmode="decimal" value="0.8"></label><p id="coil-print-legend" class="coil-field-hint" hidden><span class="coil-thin-key">黄：設定値より薄い</span> / <span class="coil-overhang-key">赤：下向きの張り出し</span><br>XY上への印刷を想定した形状の目安です。</p><p id="coil-print-status" role="status" aria-live="polite"></p>';
 parent.append(field);
 const button=field.querySelector('#coil-test-export'),toggle=field.querySelector('#coil-print-highlight'),thickness=field.querySelector('#coil-print-thickness'),legend=field.querySelector('#coil-print-legend'),status=field.querySelector('#coil-print-status');
 let source=null,overlay=null,revision=0,timer=null,busy=false,exporting=false,destroyed=false;
 function removeOverlay(){if(!overlay)return;scene.remove(overlay);overlay.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});overlay=null;onState?.(null);}
 function clear(){source=null;++revision;clearTimeout(timer);removeOverlay();button.disabled=true;status.textContent=toggle.checked?'プレビューの更新を待っています…':'';}
 function abort(){++revision;clearTimeout(timer);removeOverlay();}
 function addFaces(vertices,color){if(!vertices.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.renderOrder=8;overlay.add(mesh);}
 async function update(){
  abort();legend.hidden=!toggle.checked;if(!toggle.checked){status.textContent='';return;}
  if(!source){status.textContent='形状プレビューができると色表示します。';return;}
  const value=Number(thickness.value);if(!Number.isFinite(value)||value<.1||value>10){status.textContent='薄さの判定を0.1〜10 mmで指定してください。';return;}
  const request=revision,snapshot=source;busy=true;status.textContent='薄さと印刷方向を確認しています…';
  try{
   const result=await analyzeCoilPrint(getOutputs(),{minThickness:value,shouldCancel:()=>destroyed||request!==revision||source!==snapshot});
   if(destroyed||request!==revision||source!==snapshot)return;
   overlay=new THREE.Group();overlay.name='coil-print-warnings';for(const part of result.outputs){addFaces(part.thin,0xffcf28);addFaces(part.unsupported,0xf15a48);}scene.add(overlay);onState?.(result.stats);
   status.textContent='色表示を更新しました（薄さ '+value+' mm）。赤い面はサポートや印刷方向を検討してください。';
  }catch(e){if(e.name!=='AbortError'&&request===revision)status.textContent=e.message;}
  finally{busy=false;}
 }
 function poseChanged(){abort();if(toggle.checked){status.textContent='印刷姿勢を更新しています…';timer=setTimeout(update,160);}}
 for(const input of [toggle,thickness])input.addEventListener('input',e=>{e.stopPropagation();update();});
 thickness.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();update();}});
 button.onclick=async()=>{
  if(!source||exporting)return;const snapshot=source;exporting=true;button.disabled=true;status.textContent='試し刷り形状を作成しています…';
  try{const message=await exportPiece(snapshot,progress=>{if(source===snapshot&&!destroyed)status.textContent=progress.stage;});if(source===snapshot&&!destroyed)status.textContent=message||'保存をキャンセルしました。';}
  catch(e){if(e.name!=='AbortError'&&source===snapshot&&!destroyed)status.textContent=e.message;}
  finally{exporting=false;if(!destroyed)button.disabled=!source;}
 };
 return {clear,setSource(value){source=value;button.disabled=exporting||!source;if(toggle.checked)update();},poseChanged,get busy(){return busy;},destroy(){destroyed=true;clear();field.remove();}};
}
