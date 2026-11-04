import * as THREE from 'three';
import {KernelClient} from './kernel-client.js';
import {combinePreviewMeshes} from './combine-mesh-preview.js';
export function installCombinePreview({scene,host,getMesh,getSelectedIds,getFeatures}){
 const dialog=document.getElementById('tools-dialog'),fields=document.getElementById('cad-fields'),command=document.getElementById('cad-command'),error=document.getElementById('cad-error'),client=new KernelClient();let preview=null,muted=[],timer=null,revision=0,ownError=false;
 function clear(){++revision;client.reset();if(preview){scene.remove(preview);preview.geometry.dispose();preview.material.dispose();preview=null;}for(const [mesh,material] of muted){mesh.material.dispose();mesh.material=material;}muted=[];delete host.dataset.combinePreview;delete host.dataset.combineClearance;if(ownError){error.textContent='';ownError=false;}}
 function show(geometry,target,tools,mode,matrix){preview=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xf04438,transparent:true,opacity:.72,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));if(matrix){preview.matrix.copy(matrix);preview.matrix.decompose(preview.position,preview.quaternion,preview.scale);}preview.renderOrder=50;scene.add(preview);for(const mesh of new Set([target,...tools])){muted.push([mesh,mesh.material]);mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=.25;mesh.material.depthWrite=false;}host.dataset.combinePreview=mode;}
 async function update(all=false){
  clear();if(!dialog.open||command.value!=='join'||document.getElementById('cad-apply').disabled)return;
  const mode=document.getElementById('cad-combineMode')?.value;if(!['切り取り','交差'].includes(mode))return;
  const id=document.getElementById('cad-target')?.value,target=getMesh(id),ids=all?getSelectedIds().filter(x=>x!==id):[document.getElementById('cad-other')?.value];if(!target||!ids.length||ids.includes(id))return;
  const tools=ids.map(getMesh);if(tools.some(m=>!m))return;
  const gap=mode==='切り取り'?Number(document.getElementById('cad-cutClearance')?.value||0):0,token=revision;
  host.dataset.combinePreview='calculating';ownError=true;error.textContent=gap?'すき間を含む切り取り範囲を計算中…':'重なる範囲を計算中…';
  try{
   let result;
   if(gap){
    const operation={type:'join',id:'clearance-preview',target:id,others:ids,combineMode:mode,keepTools:'保持',cutClearance:gap},native=await client.run(getFeatures(),{type:'preview',operation},{timeout:15000});
    const removed=native.removed.find(o=>o.id===id);result=removed?{positions:removed.vertices,indices:removed.triangles}:null;
   }else result=await client.run([],{type:'meshCombinePreview',bodies:combinePreviewMeshes(target,tools)},{document:getFeatures()});
   if(token!==revision||!dialog.open||document.getElementById('cad-apply').disabled)return;
   error.textContent='';ownError=false;
   if(!result?.positions?.length){host.dataset.combinePreview='empty';return;}
   const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(result.positions,3));if(result.indices)g.setIndex(Array.from(result.indices));
   show(g,target,tools,mode,result.matrix?new THREE.Matrix4().fromArray(result.matrix):null);if(gap)host.dataset.combineClearance=String(gap);
  }catch(e){if(token===revision&&dialog.open&&!document.getElementById('cad-apply').disabled){host.dataset.combinePreview='unavailable';error.textContent=e.code==='timeout'?'プレビューは時間上限で中断しました。設定を変えるか、そのまま実行できます。':e.message;ownError=true;}}
 }
 function schedule(){clear();clearTimeout(timer);timer=setTimeout(()=>update(),350);}
 document.getElementById('tools-form').addEventListener('submit',()=>{clearTimeout(timer);clear();});
 fields.addEventListener('input',schedule);fields.addEventListener('change',schedule);command.addEventListener('change',schedule);dialog.addEventListener('close',()=>{clearTimeout(timer);clear();});dialog.addEventListener('forma-preview-retry',schedule);new MutationObserver(schedule).observe(dialog,{attributes:true,attributeFilter:['open']});new MutationObserver(schedule).observe(fields,{childList:true});
 fields.addEventListener('pointerover',e=>{if(e.target.closest('#join-selected')){clearTimeout(timer);update(true);}});fields.addEventListener('pointerout',e=>{if(e.target.closest('#join-selected'))schedule();});
}
