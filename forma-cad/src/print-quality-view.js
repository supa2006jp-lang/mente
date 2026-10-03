import * as THREE from 'three';
import {analyzePrintQuality} from './print-quality.js';
import {draggablePanel} from './draggable-panel.js';
export function createPrintQualityView({scene,host,meshes,canOpen,notify,getBodyName}){
 const panel=document.createElement('div');panel.id='print-quality-panel';panel.className='print-quality-panel';panel.hidden=true;
 panel.innerHTML='<label>確認するボディ<select id="print-quality-target"></select></label><label>ノズル径 (mm)<input id="print-quality-nozzle" type="number" min="0.1" max="2" step="0.05" value="0.6"></label><p id="print-quality-legend"></p><p class="print-quality-hint">壁や細い模様の局所的な厚さを色表示します。表示形状から測る目安です。色がない箇所も印刷条件に合わせて確認してください。</p><p id="print-quality-status" role="status" aria-live="polite"></p><button id="print-quality-check" type="button">薄い部分を確認</button><button id="print-quality-clear" type="button">色を戻す</button><button id="print-quality-close" type="button">閉じる</button>';
 host.parentElement.append(panel);draggablePanel(panel,'印刷前の薄さ確認');
 const button=document.createElement('button');button.id='print-quality-toggle';button.type='button';button.textContent='◒ 薄さ確認';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const $=id=>panel.querySelector('#'+id);let overlay=null,revision=0;
 function clear(){++revision;if(overlay){scene.remove(overlay);overlay.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});overlay=null;}delete host.dataset.printQuality;delete host.dataset.printQualityWarnings;delete host.dataset.printQualityCritical;}
 function close(){clear();panel.hidden=true;button.setAttribute('aria-pressed','false');}
 function legend(){const value=Number($('print-quality-nozzle').value);$('print-quality-legend').textContent=Number.isFinite(value)?'赤：'+value+' mm未満 ／ 黄：'+value+'〜'+Number((value*2).toFixed(3))+' mm':'';}
 async function check(){
  clear();legend();const request=revision,selection=$('print-quality-target').value,nozzle=Number($('print-quality-nozzle').value);
  $('print-quality-status').textContent='薄い壁と模様を確認しています…';
  try{
   const outputs=[],transforms=new Map();
   for(const [id,mesh]of meshes){if(!mesh.visible||selection!=='all'&&selection!==id)continue;mesh.updateMatrixWorld(true);transforms.set(id,mesh.matrixWorld.clone().invert());const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,vertices=[],point=new THREE.Vector3();for(let i=0;i<positions.count;i++)vertices.push(...point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).toArray());outputs.push({id,vertices,triangles:index?Array.from(index.array):Array.from({length:positions.count},(_,i)=>i)});}
   if(!outputs.length)throw Error('表示中のボディがありません');
   const result=await analyzePrintQuality(outputs,{nozzle,shouldCancel:()=>request!==revision||panel.hidden});if(request!==revision||panel.hidden)return;
   overlay=new THREE.Group();overlay.name='print-quality-warnings';
   for(const output of result.outputs)for(const [key,color]of [['yellow',0xffcf28],['red',0xf25340]]){if(!output[key].length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output[key],3));const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,depthWrite:false});const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=8;mesh.userData.bodyId=output.id;mesh.userData.quality=key;mesh.userData.qualityInverse=transforms.get(output.id);mesh.matrixAutoUpdate=false;overlay.add(mesh);}
   scene.add(overlay);host.dataset.printQuality='true';host.dataset.printQualityWarnings=String(result.warningTriangles);host.dataset.printQualityCritical=String(result.criticalTriangles);
   $('print-quality-status').textContent=result.warningTriangles||result.criticalTriangles?'赤・黄の箇所を表示しました。回転して壁と細い模様を確認してください。':'判定値を下回る箇所は見つかりませんでした。';
  }catch(error){if(request===revision&&error.name!=='AbortError')$('print-quality-status').textContent=error.message;}
 }
 button.onclick=()=>{if(!panel.hidden){close();return;}if(!canOpen()){notify('編集中の操作を終了してから薄さを確認してください');return;}const previous=$('print-quality-target').value;$('print-quality-target').replaceChildren(new Option('表示中のすべて','all'));for(const [id,mesh]of meshes)if(mesh.visible)$('print-quality-target').add(new Option(getBodyName?.(id)||'ボディ',id));if([...$('print-quality-target').options].some(o=>o.value===previous))$('print-quality-target').value=previous;panel.hidden=false;button.setAttribute('aria-pressed','true');legend();check();};
 $('print-quality-check').onclick=check;$('print-quality-clear').onclick=()=>{clear();$('print-quality-status').textContent='通常の色に戻しました';};$('print-quality-close').onclick=close;
 for(const id of ['print-quality-nozzle','print-quality-target'])$(id).addEventListener('input',check);
 document.getElementById('section-toggle')?.addEventListener('click',close);
 function syncVisibility(){if(!overlay)return;for(const mesh of overlay.children){const source=meshes.get(mesh.userData.bodyId);mesh.visible=!!source?.visible&&source.material.visible!==false;if(source){source.updateMatrixWorld(true);mesh.matrix.copy(source.matrixWorld).multiply(mesh.userData.qualityInverse);mesh.matrixWorldNeedsUpdate=true;}}}
 return {close,invalidate:close,syncVisibility};
}
