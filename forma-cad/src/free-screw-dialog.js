import * as THREE from 'three';
import {draggableDialog} from './draggable-dialog.js';
import {freeScrewSettings,screwCoarsePitches,screwDriveDefaults,screwDriveTypes,screwHeadDefaults,screwHeadTypes} from './free-screw-settings.js';

const options=items=>Object.entries(items).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');

export function createFreeScrewDialog({kernel,scene,getFeatures,getBody,place,apply,fit,notify}){
 const dialog=document.createElement('dialog');
 dialog.id='free-screw-dialog';
 dialog.setAttribute('aria-labelledby','free-screw-title');
 dialog.innerHTML=`<form id="free-screw-form">
 <div class="dialog-heading"><h2 id="free-screw-title">ねじを新規作成</h2>
 <button type="button" id="free-screw-close" aria-label="閉じる">×</button></div>
 <fieldset><legend>首下</legend><div class="screw-fields">
 <label>Mサイズ<select id="free-screw-diameter">${[...screwCoarsePitches.keys()].map(d=>'<option value="'+d+'">M'+d+'</option>').join('')}</select></label>
 <label>ピッチ (mm)<input id="free-screw-pitch" type="number" min="0.001" step="any" required></label>
 <label>首下の長さ (mm)<input id="free-screw-length" type="number" min="0.1" step="any" required></label>
 <label>方向<select id="free-screw-hand"><option value="right">右ねじ</option><option value="left">左ねじ</option></select></label>
 </div></fieldset>
 <fieldset><legend>頭部</legend><div class="screw-fields">
 <label>形状<select id="free-screw-head">${options(screwHeadTypes)}</select></label>
 <label><span id="free-screw-head-size-label">頭部の外径 (mm)</span><input id="free-screw-head-size" type="number" min="0.1" step="any" required></label>
 <label>頭部の高さ (mm)<input id="free-screw-head-height" type="number" min="0.2" step="any" required></label>
 </div><p id="free-screw-countersunk-note" hidden>皿頭の傾斜部分は頭部の高さに含まれます。</p></fieldset>
 <fieldset><legend>工具穴</legend><div class="screw-fields">
 <label>締め付け方式<select id="free-screw-drive">${options(screwDriveTypes)}</select></label>
 <label><span id="free-screw-drive-size-label">溝の長さ (mm)</span><input id="free-screw-drive-size" type="number" min="0.1" step="any" required></label>
 <label>工具穴の深さ (mm)<input id="free-screw-drive-depth" type="number" min="0.05" step="any" required></label>
 </div></fieldset>
 <p id="free-screw-error" role="status"></p>
 <div class="editor-actions">
 <button type="button" id="free-screw-fit" disabled>プレビューにフィット</button>
 <button type="submit" class="accent" id="free-screw-apply" disabled>作成</button>
 </div></form>`;
 document.body.append(dialog);
 draggableDialog(dialog);
 const $=name=>dialog.querySelector('#free-screw-'+name),form=$('form');
 let original=null,editing=null,id=null,busy=false,timer=null,revision=0,preview=null,hiddenBody=null,needsFit=false;

 function clearPreview(){
  if(preview){preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();preview=null;}
  if(hiddenBody){hiddenBody.visible=true;hiddenBody=null;}
  $('fit').disabled=true;
 }
 function draft(){
  return {id,diameter:Number($('diameter').value),pitch:$('pitch').valueAsNumber,length:$('length').valueAsNumber,
   head:$('head').value,headSize:$('head-size').valueAsNumber,headHeight:$('head-height').valueAsNumber,
   drive:$('drive').value,driveSize:$('drive-size').valueAsNumber,driveDepth:$('drive-depth').valueAsNumber,
   leftHand:$('hand').value==='left'};
 }
 function read(){
  const input=draft();
  return freeScrewSettings({...input,origin:editing?.spec.origin??place(input)});
 }
 function resetHead(){
  const values=screwHeadDefaults(Number($('diameter').value),$('head').value);
  $('head-size').value=values.headSize;$('head-height').value=values.headHeight;
 }
 function resetDrive(){
  if($('drive').value==='none')return;
  const values=screwDriveDefaults(draft());
  $('drive-size').value=values.driveSize;$('drive-depth').value=values.driveDepth;
 }
 function syncFields(){
  $('head-size-label').textContent=$('head').value==='hex'?'頭部の対辺 (mm)':'頭部の外径 (mm)';
  $('countersunk-note').hidden=$('head').value!=='countersunk';
  const none=$('drive').value==='none';
  $('drive-size-label').textContent=$('drive').value==='hex'?'六角穴の対辺 (mm)':'溝の長さ (mm)';
  for(const name of ['drive-size','drive-depth']){
   $(name).disabled=none;
   $(name).closest('label').hidden=none;
  }
 }
 function fitPreview(){
  if(preview)fit(new THREE.Box3().setFromObject(preview));
 }
 function showPreview(output){
  clearPreview();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));
  geometry.setIndex(output.triangles);
  if(output.normals?.length===output.vertices.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(output.normals,3));
  else geometry.computeVertexNormals();
  preview=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x69b4c6,roughness:.75}));
  const body=editing&&getBody(editing.id);
  if(body?.visible){hiddenBody=body;body.visible=false;}
  scene.add(preview);$('fit').disabled=false;
  if(needsFit){needsFit=false;fitPreview();}
 }
 function schedule(){
  clearTimeout(timer);
  const token=++revision;
  let settings;
  try{settings=read();}catch(error){clearPreview();$('error').textContent=error.message;$('apply').disabled=true;return;}
  $('apply').disabled=false;
  $('error').textContent='軸・頭部・工具穴をプレビューしています…';
  timer=setTimeout(async()=>{
   try{
    const result=await kernel.run([],{type:'freeScrewPreview',...settings});
    if(!dialog.open||token!==revision||getFeatures()!==original)return;
    showPreview(result.outputs[0]);
    $('error').textContent='ねじ山は作成時に反映されます。';
   }catch(error){if(dialog.open&&token===revision){clearPreview();$('error').textContent=error.message;}}
  },150);
 }
 form.oninput=event=>{
  if(busy)return;
  if(event.target===$('diameter')){
   $('pitch').value=screwCoarsePitches.get(Number($('diameter').value));resetHead();resetDrive();
  }else if(event.target===$('head')){resetHead();resetDrive();}
  else if(event.target===$('drive'))resetDrive();
  syncFields();schedule();
 };
 $('fit').onclick=fitPreview;
 $('close').onclick=()=>dialog.close();
 form.onsubmit=async event=>{
  event.preventDefault();
  if(busy||$('apply').disabled)return;
  clearTimeout(timer);
  const token=++revision,before=original,feature=editing;
  const current=()=>dialog.open&&revision===token&&getFeatures()===before;
  busy=true;$('apply').disabled=true;
  form.querySelectorAll('fieldset').forEach(section=>{section.disabled=true;});
  const progress=info=>{if(current())$('error').textContent=(info.stage||'形状を計算しています')+'…';};
  try{
   const spec={type:'freeScrew',...read()};
   progress({stage:'ねじ山を計算しています'});
   const result=await kernel.run([],spec,{onProgress:progress});
   if(!current())return;
   clearPreview();
   await apply(spec,result,feature,before,current,kernel,progress);
   if(!dialog.open||revision!==token)return;
   dialog.close();
   notify(feature?'ねじと後続工程を更新しました':'M'+spec.diameter+'のねじを作成しました');
  }catch(error){if(current())$('error').textContent=error.message;}
  finally{
   if(dialog.open&&revision===token){
    busy=false;form.querySelectorAll('fieldset').forEach(section=>{section.disabled=false;});
    $('apply').disabled=false;
   }
  }
 };
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  revision++;clearTimeout(timer);clearPreview();kernel.reset();busy=false;
 });
 return {open(feature=null){
  if(dialog.open)return;
  original=getFeatures();editing=feature;id=feature?.id??crypto.randomUUID();needsFit=true;
  const spec=feature?.spec;
  $('diameter').value=spec?.diameter??6;$('pitch').value=spec?.pitch??screwCoarsePitches.get(6);
  $('length').value=spec?.length??12;$('hand').value=spec?.leftHand?'left':'right';
  $('head').value=spec?.head??'pan';$('drive').value=spec?.drive??'cross';
  resetHead();
  if(spec){$('head-size').value=spec.headSize;$('head-height').value=spec.headHeight;}
  resetDrive();
  if(spec&&spec.drive!=='none'){$('drive-size').value=spec.driveSize;$('drive-depth').value=spec.driveDepth;}
  form.querySelectorAll('fieldset').forEach(section=>{section.disabled=false;});
  $('title').textContent=feature?'ねじを再編集':'ねじを新規作成';
  $('apply').textContent=feature?'更新':'作成';
  syncFields();dialog.show();$('diameter').focus();schedule();
 }};
}
