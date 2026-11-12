import * as THREE from 'three';
import {rebuild} from './geometry.js';
import {geometryHistoryLineage} from './geometry-history-trace.js';
import {KernelClient} from './kernel-client.js';
import {draggablePanel} from './draggable-panel.js';
import {geometryHealthLabels} from './geometry-health-view.js';
import {stlIssueLabels} from './stl-inspection-view.js';

export function createGeometryHistoryTraceView({scene,host,meshes,getFeatures,getBodyName,onSelect,fitModelToolBox,onStart}){
 const kernel=new KernelClient(),panel=document.createElement('section');
 panel.id='geometry-history-trace';panel.className='workspace-panel';panel.hidden=true;panel.style.zIndex='240';
 panel.innerHTML='<p data-target></p><p data-status role="status" aria-live="polite"></p><div data-results></div><div class="workspace-actions" data-compare hidden><button type="button" data-mode="before">工程の直前</button><button type="button" data-mode="after">工程の直後</button><button type="button" data-zoom>異常箇所にズーム</button><button type="button" data-edit>この工程を開く</button></div><p data-view class="hint"></p><div class="workspace-actions"><button type="button" data-cancel hidden>検査を中止</button><button type="button" data-close>閉じる</button></div>';
 host.parentElement.append(panel);draggablePanel(panel,'形状異常を履歴で探す');
 const q=name=>panel.querySelector('[data-'+name+']');
 let revision=0,original=null,owner=null,selected=null,overlay=null,hidden=[],area=null,busy=false;
 function clearPreview(){
  if(overlay){overlay.removeFromParent();overlay.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});overlay=null;}
  for(const [mesh,visible] of hidden)mesh.visible=visible;
  hidden=[];area=null;delete host.dataset.geometryHistoryPreview;
 }
 function stop(){
  ++revision;if(busy)kernel.reset();busy=false;q('cancel').hidden=true;
 }
 function close(){stop();clearPreview();panel.hidden=true;selected=null;original=null;owner=null;delete host.dataset.geometryHistoryTrace;}
 function preview(mode){
  if(!selected||getFeatures()!==original)return;
  const {index,bodyId,beforeIds,finding}=selected,after=mode==='after',ids=new Set(after?[bodyId]:beforeIds),prefix=original.slice(0,index+Number(after));
  clearPreview();overlay=new THREE.Group();
  try{
   if(ids.size){
    const records=geometryHistoryLineage(prefix);
    const outputs=[...ids].map(id=>records.get(id)?.output);
    const saved=outputs.every(output=>output?.vertices?.length&&output?.triangles?.length);
    const shapes=rebuild(saved?[{kind:'cadop',id:'history-preview',outputs,remove:[]}]:prefix);
    for(const [id,{geometry}] of shapes){
     if(ids.has(id))overlay.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:after?0x48a2bf:0x849bb3,roughness:.7,side:THREE.DoubleSide})));
     else geometry.dispose();
    }
   }
   if(after&&finding.bounds){
    area=new THREE.Box3(new THREE.Vector3(...finding.bounds[0]),new THREE.Vector3(...finding.bounds[1]));
    area.expandByScalar(Math.max(.08,area.getSize(new THREE.Vector3()).length()*.02));
    const frame=new THREE.Box3Helper(area,0xe7502d);frame.material.depthTest=false;frame.renderOrder=119;overlay.add(frame);
   }
   if(after&&finding.segments?.length){
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(finding.segments,3));
    const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe7502d,depthTest:false}));line.renderOrder=120;overlay.add(line);
   }
   scene.add(overlay);
   for(const mesh of meshes.values()){hidden.push([mesh,mesh.visible]);mesh.visible=false;}
   for(const button of panel.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
   q('zoom').disabled=!area;
   q('view').textContent=(index+1)+'工程目の'+(after?'直後'+(area?' ／ 赤：検出した範囲':''):ids.size?'直前 ／ 入力ボディ':'直前 ／ 対象ボディがまだありません');
   host.dataset.geometryHistoryPreview=JSON.stringify({mode,featureId:selected.featureId,bodyIds:[...ids]});
  }catch(error){clearPreview();q('zoom').disabled=true;q('view').textContent='当時の形状を表示できませんでした。'+error.message;}
 }
 function showResult(report,mode){
  host.dataset.geometryHistoryTrace=JSON.stringify({checked:report.checked,partial:report.partial,origins:report.origins.map(({featureId,index,finding,uncertain})=>({featureId,index,code:finding.code,uncertain}))});
  q('status').textContent=report.checked+' 件の保存形状を検査。'+(report.origins.length?
   '見つかった工程を選ぶと前後を比較できます。':report.partial?'確認した範囲で、該当する異常を特定できませんでした。':'対象ボディの保存形状から、追跡できる異常は見つかりませんでした。')+
   (report.partial?' 検査上限や照合できない箇所があり、一部は未確定です。':'');
  const labels=mode==='stl'?stlIssueLabels:geometryHealthLabels;
  q('results').replaceChildren(...report.origins.map(row=>{
   const button=document.createElement('button');button.type='button';button.dataset.historyOrigin=row.featureId;
   button.style.cssText='display:block;width:100%;text-align:left;margin:5px 0;white-space:normal';
   const feature=original[row.index];
   const measure=Number.isFinite(row.finding.size)?' '+Number(row.finding.size.toPrecision(5))+' mm':row.finding.count?' '+row.finding.count+' 件':'';
   button.textContent=(row.index+1)+'工程目「'+(feature.name||feature.spec?.type||'工程')+'」 ／ '+(labels[row.finding.code]||row.finding.code)+measure+(row.uncertain?'（追跡範囲内）':'（最初の検出）');
   button.onclick=()=>{
    selected=row;q('compare').hidden=false;
    for(const item of q('results').children)item.setAttribute('aria-pressed',String(item===button));
    preview('after');
   };
   return button;
  }));
 }
 q('close').onclick=close;
 q('cancel').onclick=()=>{stop();q('status').textContent='履歴の検査を中止しました。';};
 for(const button of panel.querySelectorAll('[data-mode]'))button.onclick=()=>preview(button.dataset.mode);
 q('zoom').onclick=()=>{if(area)fitModelToolBox?.(area);};
 q('edit').onclick=()=>{
  if(!selected||getFeatures()!==original)return;
  const id=selected.featureId;close();onSelect(id);
  [...document.querySelectorAll('[data-history-feature]')].find(row=>row.dataset.historyFeature===id)?.scrollIntoView({block:'nearest',inline:'nearest'});
 };
 document.addEventListener('click',event=>{
  if(panel.hidden)return;
  const button=event.target.closest('button');
  if(button&&(['open','save','save-overwrite','save-light','export','export-color-3mf','undo','redo','clear'].includes(button.id)||
   button.closest('#features,#bodies,.command-toolbar,.toolbar,.workspace-tabs')))close();
 },true);
 async function open({target,mode='cad',codes,threshold}){
  close();onStart?.();original=getFeatures();owner=[...document.querySelectorAll('dialog[open]')].at(-1)||null;
  const request=++revision,documentFeatures=original;
  panel.hidden=false;q('target').textContent=getBodyName(target)+(mode==='stl'?' ／ STL出力と同じ検査':' ／ CAD形状の検査');
  q('compare').hidden=true;q('view').textContent='';q('results').replaceChildren();
  q('status').textContent='対象ボディが更新された工程を調べています…';q('cancel').hidden=false;busy=true;
  const current=()=>request===revision&&getFeatures()===documentFeatures&&!panel.hidden;
  try{
   const report=await kernel.run(original,{type:'geometryHistoryTrace',target,mode,codes,threshold},{onProgress:p=>{if(current())q('status').textContent=p.stage;}});
   if(current())showResult(report,mode);
  }catch(error){if(current())q('status').textContent='履歴を検査できませんでした。'+error.message;}
  finally{if(request===revision){busy=false;q('cancel').hidden=true;}}
 }
 return {open,close,sync(){if(!panel.hidden&&(original!==getFeatures()||owner&&!owner.open))close();}};
}
