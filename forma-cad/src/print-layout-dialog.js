import * as THREE from 'three';
import {rebuild} from './geometry.js';
import {movePrintPlacement,planPrintLayout,planPrintPlates,printOrientations,printPlacementMatrix} from './print-layout.js';
import {comparePrintOrientations,inspectPrintLayoutPlate,printWarningSummary} from './print-layout-inspection.js';
import {copyCadCoordinates} from './cad-coordinates.js';
import {draggableDialog} from './draggable-dialog.js';
export function printLayoutDialog({scene,host,canvas,camera,meshes,kernel,getFeatures,bodyName,fitPreview,apply,exportPlates,notify}){
 const plate=new THREE.Group();plate.name='print-plate-180';plate.visible=false;
 const surface=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshBasicMaterial({color:0x64cada,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));surface.position.z=-.04;plate.add(surface);
 const corners=m=>[[-90+m,-90+m,.025],[90-m,-90+m,.025],[90-m,90-m,.025],[-90+m,90-m,.025],[-90+m,-90+m,.025]].map(p=>new THREE.Vector3(...p));
 const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners(0)),new THREE.LineBasicMaterial({color:0x0084a6}));plate.add(border);
 const inset=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners(2)),new THREE.LineDashedMaterial({color:0xb47813,dashSize:2,gapSize:2}));inset.computeLineDistances();plate.add(inset);scene.add(plate);let plateMargin=2;function setMargin(value){plateMargin=value;inset.geometry.dispose();inset.geometry=new THREE.BufferGeometry().setFromPoints(corners(value));inset.computeLineDistances();inset.visible=value>0;}
 const toggle=document.createElement('button');toggle.id='print-plate-toggle';toggle.type='button';toggle.textContent='180 mmプレート';toggle.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(toggle);
 const readout=document.createElement('div');readout.id='print-plate-readout';readout.hidden=true;readout.textContent='印刷プレート 180 × 180 mm ／ 原点中心・XY平面';Object.assign(readout.style,{position:'absolute',top:'10px',left:'50%',transform:'translateX(-50%)',padding:'7px 10px',border:'1px solid #69aabd',borderRadius:'5px',background:'#effaffec',color:'#17617a',fontSize:'12px',pointerEvents:'none',maxWidth:'45%'});host.append(readout);
 function showPlate(value){plate.visible=value;readout.hidden=!value;toggle.setAttribute('aria-pressed',String(value));host.dataset.printPlate=String(value);}
 toggle.onclick=()=>showPlate(!plate.visible);
 const dialog=document.createElement('dialog');dialog.id='print-layout-dialog';Object.assign(dialog.style,{position:'fixed',margin:'0',width:'min(390px,calc(100vw - 32px))',maxHeight:'85vh',overflow:'auto'});
 const style=document.createElement('style');style.textContent='#print-layout-dialog{z-index:110;background:#192733;color:#dce6ef;border:1px solid #63849b;border-radius:10px;padding:18px;box-shadow:0 10px 30px #0006}#print-layout-dialog h2{font-size:17px}#print-layout-dialog p{font-size:13px;line-height:1.6}#print-layout-dialog label{display:block;font-size:13px;margin:12px 0}#print-layout-dialog input[type=number]{display:block;width:100%;padding:9px;background:#243649;color:white;border:1px solid #486071;border-radius:5px;margin-top:5px}#print-layout-error{color:#ffb295}#print-layout-dialog .plate-check{display:flex;align-items:center;gap:8px}#print-layout-dialog .plate-check input{accent-color:#46cbe0}#print-layout-dialog .dialog-heading{cursor:grab;touch-action:none}#print-layout-dialog .editor-actions{display:flex;gap:10px}#print-layout-dialog .editor-actions button{flex:1}';document.head.append(style);
 style.textContent+='#print-layout-dialog .plate-check input{width:auto;flex:none;margin:0}#print-layout-orientations>div{padding-bottom:8px;border-bottom:1px solid #486071}#print-layout-orientations button{margin-top:4px}#print-layout-warning-parts{margin:0 0 8px;padding-left:1.2em;font-size:13px;max-height:96px;overflow:auto}';
 dialog.innerHTML='<form id="print-layout-form"><div class="dialog-heading"><h2>180 mmプレートに自動配置</h2><button type="button" id="print-layout-close" aria-label="閉じる">×</button></div><p>表示中のソリッドを180 × 180 mmの四角の中に並べ、各ボディの底をZ=0に合わせます。印刷用の向きと配置を保存できます。</p><label>端からの余白 (mm)<input id="print-layout-margin" type="number" value="2" min="0" max="20" step="0.5" required></label><label>部品同士の間隔 (mm)<input id="print-layout-gap" type="number" value="3" min="0" max="30" step="0.5" required></label><label class="plate-check"><input id="print-layout-rotation" type="checkbox" checked>Z軸方向に90°回転して配置してよい</label><p>表示中のソリッドを対象に、収まらないときは複数のプレートに分けます。「表示中のプレートをモデルに適用」で、そのプレートの位置と向きを実際のボディに反映します。</p><div id="print-layout-orientations" style="max-height:160px;overflow:auto"></div><label id="print-layout-plate-row">表示するプレート <select id="print-layout-plate"></select></label><button id="print-layout-export" type="button" disabled>このプレートを3MF出力</button><p id="print-layout-info"></p><p id="print-layout-error" role="status" aria-live="polite"></p><div class="editor-actions"><button type="button" id="print-layout-cancel">キャンセル</button><button type="submit" id="print-layout-apply" class="accent" disabled>印刷配置を保存</button></div><button type="button" id="print-layout-apply-model" disabled>表示中のプレートをモデルに適用</button></form>';
 document.body.append(dialog);draggableDialog(dialog);const $=id=>document.getElementById('print-layout-'+id);const editsModel=()=>editing?.spec.type==='printLayout';
 const legacy=()=>editsModel()&&!editing.spec.placementOverrides;
 $('orientations').before(Object.assign(document.createElement('div'),{id:'print-layout-placement-tools',innerHTML:'<p>プレート上の部品をドラッグして移動できます。固定した部品は、自動で並べ直しても位置と向きを保ちます。</p><button type="button" id="print-layout-repack">固定を残して自動で並べ直す</button>'}));
 $('export').before(Object.assign(document.createElement('div'),{id:'print-layout-inspection',innerHTML:'<label class="plate-check"><input type="checkbox" id="print-layout-warnings" checked>印刷チェックを色で表示</label><p id="print-layout-warning-status" role="status"></p><ul id="print-layout-warning-parts"></ul>'}));
 $('export').after(Object.assign(document.createElement('button'),{type:'button',id:'print-layout-export-all',textContent:'全プレートを3MF出力（ZIP）',disabled:true}));
 $('plate-row').after(Object.assign(document.createElement('details'),{id:'print-layout-overview',innerHTML:'<summary>全プレートの確認</summary><button type="button" id="print-layout-check-all">全プレートを検査</button><ol id="print-layout-overview-rows"></ol>'}));
 $('orientations').after(Object.assign(document.createElement('div'),{id:'print-layout-orientation-review',hidden:true,innerHTML:'<strong id="print-layout-orientation-title"></strong><p id="print-layout-orientation-status" role="status"></p><div id="print-layout-orientation-candidates"></div><div class="editor-actions"><button type="button" id="print-layout-orientation-close">比較を閉じる</button><button type="button" id="print-layout-orientation-apply" class="accent" disabled>この向きに変更</button></div>'}));
 style.textContent+='#print-layout-overview{margin:10px 0}#print-layout-overview-rows{padding-left:24px;max-height:200px;overflow:auto}#print-layout-overview-rows button,#print-layout-warning-parts button,#print-layout-orientation-candidates button{text-align:left;margin:2px 0}#print-layout-orientation-review{margin:8px 0;padding:10px;border:1px solid #63849b;border-radius:6px}#print-layout-orientation-candidates button[aria-pressed=true]{outline:2px solid #46cbe0}';
 let original,history,editing,id,relocationId,targets=[],items=null,orientations={},plates=[],plan=null,preview=null,hidden=[],version=0,busy=false,loading=false,wasVisible=false,wasMargin=2,applied=false,fitted=false;
 let overrides=[],inspection=null,inspectionRun=null,checking=false,warningGroup=null,drag=null;
 let layoutRevision=0,inspectionRevision=0,focusNext=false,comparison=null;
 const summaries=new WeakMap(),runningChecks=new WeakMap();
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const plateEntries=()=>plates.flatMap((plate,index)=>plate.placements.length?[{plate,index}]:[]);
 const geometries=()=>new Map(preview.children.map(mesh=>[mesh.userData.layoutId,mesh.geometry]));
 function syncExport(){
  const unavailable=busy||!!drag||!!comparison||!plan?.placements.length||legacy();
  $('apply-model').disabled=unavailable;
  $('export').disabled=unavailable||checking;
  $('export-all').disabled=$('check-all').disabled=unavailable;
 }
 function renderOverview(){
  const selected=Number($('plate').value);
  $('overview-rows').replaceChildren(...plateEntries().map(({plate,index})=>{
   const row=document.createElement('li'),button=document.createElement('button'),report=summaries.get(plate);
   const warning=report?.warnings>0;
   button.type='button';button.dataset.printPlateIndex=String(index);
   button.textContent=(index+1)+' 枚目・'+plate.placements.length+' 部品 ／ '+(report?.label??'未確認');
   if(warning)button.style.color='#ffc081';
   if(index===selected)button.setAttribute('aria-current','true');
   button.disabled=busy||!!comparison||!!drag;
   button.onclick=()=>{
    if(busy||comparison||drag)return;
    $('plate').value=String(index);focusNext=warning;showCurrentPlate();
   };
   row.append(button);return row;
  }));
 }
 function checkPlate(checked){
  if(runningChecks.has(checked))return runningChecks.get(checked);
  const revision=layoutRevision,features=original;
  const shouldCancel=()=>revision!==layoutRevision||!dialog.open||getFeatures()!==features;
  const request=inspectPrintLayoutPlate(checked,geometries(),{shouldCancel})
   .catch(error=>shouldCancel()?null:{error:error.message})
   .then(result=>{
    if(!result||shouldCancel())return null;
    summaries.set(checked,{label:printWarningSummary(result),warnings:(result.floating?.length??0)+(result.overhang?.length??0)});
    renderOverview();return result;
   }).finally(()=>runningChecks.delete(checked));
  runningChecks.set(checked,request);
  return request;
 }
 function focusWarning(object){
  $('warnings').checked=true;warningGroup.visible=true;
  for(const item of warningGroup.children){item.material.depthTest=item!==object;item.material.opacity=item===object?.72:1;item.material.transparent=item===object;}
  const box=object.box?.clone()??new THREE.Box3().setFromObject(object);
  if(!box.isEmpty())fitPreview(box.expandByScalar(3));
 }
 function clearWarnings(){
  ++inspectionRevision;inspection=null;inspectionRun=null;checking=false;
  if(warningGroup){warningGroup.removeFromParent();warningGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});warningGroup=null;}
  $('warning-status').textContent='';$('warning-parts').replaceChildren();
 }
 function inspectCurrent(){
  if(legacy()||!plan?.placements.length)return Promise.resolve();
  if(inspection===plan){
   if(focusNext&&warningGroup?.children.length){focusNext=false;focusWarning(warningGroup.children[0]);}
   return inspectionRun;
  }
  clearWarnings();const checked=inspection=plan,revision=inspectionRevision;
  checking=true;syncExport();
  $('warning-status').textContent='浮きとオーバーハングを確認中…';
  inspectionRun=checkPlate(checked)
   .then(result=>{
    if(revision!==inspectionRevision||!result)return;
    if(result.incomplete){$('warning-status').textContent='三角形が30万枚を超えるため、印刷チェックは未実施です。';return;}
    if(result.error){$('warning-status').textContent='印刷チェックを完了できませんでした。'+result.error;return;}
    const {floating,overhang}=result;
    $('warning-status').textContent=floating.length||overhang.length?
     '紫：浮いている部分 '+floating.length+' 箇所 ／ 橙：オーバーハングの候補 '+overhang.length+' ボディ':
     '浮いている部分とオーバーハングの候補は見つかりませんでした。';
    const names=new Map(checked.placements.map(p=>[p.id,p.name||p.id]));
    const details=[...floating.map(row=>names.get(row.bodyId)+' ／ '+row.message),...overhang.map(row=>names.get(row.id)+' ／ 45°を超える下向きの面')];
    warningGroup=new THREE.Group();warningGroup.visible=$('warnings').checked&&!comparison?.selected;scene.add(warningGroup);
    for(const {bounds} of floating)warningGroup.add(new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...bounds.min),new THREE.Vector3(...bounds.max)),0xbd58fa));
    for(const {unsupported} of overhang){
     const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(unsupported,3));
     const material=new THREE.MeshBasicMaterial({color:0xf68a19,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
     warningGroup.add(new THREE.Mesh(geometry,material));
    }
    $('warning-parts').replaceChildren(...details.map((message,i)=>{
     const row=document.createElement('li'),button=document.createElement('button'),object=warningGroup.children[i];
     button.type='button';button.textContent=message;button.style.color=i<floating.length?'#dfafff':'#ffc081';
     button.onclick=()=>{if(!comparison&&!drag)focusWarning(object);};row.append(button);return row;
    }));
    if(focusNext&&warningGroup.children.length){focusNext=false;focusWarning(warningGroup.children[0]);}
   })
   .catch(error=>{if(revision===inspectionRevision)$('warning-status').textContent='表示できませんでした。'+error.message;})
   .finally(()=>{if(revision===inspectionRevision){checking=false;syncExport();}});
  return inspectionRun;
 }
 $('warnings').onchange=()=>{if(warningGroup)warningGroup.visible=$('warnings').checked&&!comparison?.selected;};
 function clearPreview(){if(preview){scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview=null;}for(const [m,v]of hidden)m.visible=v;hidden=[];}
 function close(){++version;++layoutRevision;if(loading||busy)kernel.reset();loading=busy=false;drag=null;comparison=null;focusNext=false;$('orientation-review').hidden=true;clearWarnings();clearPreview();items=null;plates=[];plan=null;delete host.dataset.printLayout;if(!applied){setMargin(wasMargin);showPlate(wasVisible);}}
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});$('close').onclick=$('cancel').onclick=()=>dialog.close();
 function options(){return {margin:Number($('margin').value),gap:Number($('gap').value),allowRotation:$('rotation').checked};}
 function spec(){
  const type=legacy()?'printLayout':'printLayoutPlan';
  return {type,id,targets:[...targets],...options(),
   ...(!legacy()?{orientations:Object.fromEntries(targets.filter(id=>Object.hasOwn(orientations,id)).map(id=>[id,orientations[id]])),placementOverrides:overrides.filter(row=>targets.includes(row.id))}:{})};
 }
 function update(){
  if(busy||drag||!items)return;++layoutRevision;focusNext=false;const previous=Number($('plate').value)||0;plan=null;plates=[];clearWarnings();renderOverview();syncExport();$('apply').disabled=true;$('error').textContent='';$('info').textContent='';
  if(![...dialog.querySelectorAll('input[type=number]')].every(el=>el.value.trim()&&el.checkValidity())){clearPreview();delete host.dataset.printLayout;$('error').textContent='余白・間隔を正しい数値で指定してください';return;}
  try{
   const selected=items.filter(item=>targets.includes(item.id));
   if(!selected.length)throw Error('印刷する部品を選択してください');
   plates=legacy()?[planPrintLayout(selected,options())]:planPrintPlates(selected,spec()).plates;
   $('plate').replaceChildren(...plates.flatMap((plate,i)=>plate.placements.length?[new Option((i+1)+' / '+plates.length+' 枚目（'+plate.placements.length+'部品）',String(i))]:[]));
   if(plates[previous]?.placements.length)$('plate').value=String(previous);
   if(!preview){preview=new THREE.Group();const bodies=rebuild(history);try{for(const {id:target} of items){const source=bodies.get(target);if(!source)throw Error('配置するボディがありません');const m=new THREE.Mesh(copyCadCoordinates(source.geometry,source.geometry.clone()),new THREE.MeshStandardMaterial({color:0x68b4cf,roughness:.65}));m.userData.layoutId=target;m.matrixAutoUpdate=false;preview.add(m);} }finally{for(const b of bodies.values())b.geometry.dispose();}
    for(const {id:target} of items){const m=meshes.get(target);if(m){hidden.push([m,m.visible]);m.visible=false;}}scene.add(preview);
   }
   showCurrentPlate();
  }catch(error){clearPreview();plates=[];$('plate').replaceChildren();delete host.dataset.printLayout;$('error').textContent=error.message;}
 }
 function showCurrentPlate(){
  const index=Number($('plate').value),next=plates[index];
  if(!next||!preview)return;
  const byId=new Map(next.placements.map(placement=>[placement.id,placement]));
  for(const m of preview.children){
   const placement=byId.get(m.userData.layoutId);
   m.visible=!!placement;
   if(placement){m.matrix.copy(printPlacementMatrix(placement));m.matrixWorldNeedsUpdate=true;m.material.color.setHex(placement.locked?0x6786b9:0x68b4cf);}
  }
  setMargin(next.margin);showPlate(true);
  if(!fitted){
   const bounds=new THREE.Box3().setFromObject(plate);
   for(const mesh of preview.children)if(mesh.visible)bounds.union(new THREE.Box3().setFromObject(mesh));
   fitPreview(bounds);fitted=true;
  }
  plan=next;host.dataset.printLayout=JSON.stringify({...next,plateIndex:index,plateCount:plates.length});
  $('info').textContent='プレート '+(index+1)+' / '+plates.length+' ／ '+next.placements.length+'部品 ／ '+next.used.width.toFixed(1)+' × '+next.used.height.toFixed(1)+' mm';
  const needsSinglePlate=editsModel()&&plateEntries().length>1;
  $('apply').disabled=busy||!!comparison||needsSinglePlate;
  if(needsSinglePlate)$('error').textContent='モデルの配置を更新するには、対象を1枚のプレートに収めてください。';
  renderOrientations();renderOverview();inspectCurrent();syncExport();
 }
 function snapshotPlacements(){
  overrides=plates.flatMap((plate,index)=>plate.placements.map(p=>({
   id:p.id,plate:index,x:(p.min[0]+p.max[0])/2,y:(p.min[1]+p.max[1])/2,rotation:p.rotation,locked:!!p.locked,
  })));
 }
 $('repack').onclick=()=>{if(busy||drag)return;overrides=overrides.filter(row=>row.locked);renderOrientations();update();};
 function updateRay(event){
  const rect=canvas.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  ray.setFromCamera(pointer,camera);
 }
 function consume(event){event.preventDefault();event.stopImmediatePropagation();}
 host.addEventListener('pointerdown',event=>{
  if(event.target!==canvas||!dialog.open||!plan||legacy()||busy||comparison||drag||event.button!==0||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
  updateRay(event);preview.updateMatrixWorld(true);
  const hit=ray.intersectObjects(preview.children.filter(m=>m.visible),false)[0];
  if(!hit)return;
  consume(event);
  const id=hit.object.userData.layoutId,placement=plan.placements.find(p=>p.id===id);
  if(placement.locked){$('error').textContent=placement.name+' は固定されています。移動するには固定を解除してください。';return;}
  const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-hit.point.z);
  if(Math.abs(ray.ray.direction.z)<.01){$('error').textContent='プレートを少し上から見える向きにしてドラッグしてください。';return;}
  drag={pointerId:event.pointerId,id,plan,mesh:hit.object,start:hit.point,plane,next:null};
  canvas.setPointerCapture(event.pointerId);$('apply').disabled=$('export').disabled=$('plate').disabled=true;
  syncExport();
  if(warningGroup)warningGroup.visible=false;
 });
 host.addEventListener('pointermove',event=>{
  if(drag?.pointerId!==event.pointerId)return;
  consume(event);updateRay(event);
  const point=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!point)return;
  const dx=point.x-drag.start.x,dy=point.y-drag.start.y;
  drag.next=Math.hypot(dx,dy)>.01?movePrintPlacement(drag.plan,drag.id,dx,dy):drag.plan;
  const placement=(drag.next||drag.plan).placements.find(p=>p.id===drag.id);
  drag.mesh.matrix.copy(printPlacementMatrix(placement));drag.mesh.matrixWorldNeedsUpdate=true;
  $('error').textContent=drag.next?'':'余白または部品間隔を確保できません';
 },true);
 function finishDrag(event){
  if(drag?.pointerId!==event.pointerId)return;
  consume(event);
  const {next,plan:initial}=drag;drag=null;$('plate').disabled=false;
  if(event.type==='pointerup'&&next&&next!==initial){plates[Number($('plate').value)]=next;snapshotPlacements();}
  if(warningGroup)warningGroup.visible=$('warnings').checked;
  showCurrentPlate();
 }
 host.addEventListener('pointerup',finishDrag,true);
 host.addEventListener('pointercancel',finishDrag,true);
 host.addEventListener('lostpointercapture',finishDrag,true);
 function showComparison(row){
  comparison.selected=row;
  const p=row.placement;
  const translation=p.translation.map((v,i)=>i<2?v-(p.min[i]+p.max[i])/2:v);
  for(const mesh of preview.children){
   mesh.visible=mesh.userData.layoutId===p.id;
   if(mesh.visible){mesh.matrix.copy(printPlacementMatrix({...p,translation}));mesh.matrixWorldNeedsUpdate=true;}
  }
  if(warningGroup)warningGroup.visible=false;
  for(const button of $('orientation-candidates').querySelectorAll('button'))
   button.setAttribute('aria-pressed',String(button.dataset.orientation===row.orientation));
  $('orientation-apply').disabled=row.orientation===comparison.current;
 }
 async function reviewOrientation(item){
  if(busy||drag||comparison||!plan||!preview||!targets.includes(item.id)||overrides.some(row=>row.id===item.id&&row.locked))return;
  const current=orientations[item.id]??'z+',review=comparison={id:item.id,current,selected:null},features=original;
  const shouldCancel=()=>comparison!==review||!dialog.open||getFeatures()!==features;
  $('orientation-title').textContent=item.name+' の印刷向き';
  $('orientation-review').hidden=false;$('orientation-apply').disabled=true;
  $('orientation-candidates').replaceChildren();$('orientation-status').textContent='比較しています…';setBusy(false);
  try{
   const input=spec(),selected=items.filter(body=>targets.includes(body.id)),candidates=[];
   for(const [orientation,label] of printOrientations){
    await new Promise(resolve=>setTimeout(resolve,0));
    if(shouldCancel())return;
    try{
     const layouts=orientation===current?plates:planPrintPlates(selected,{...input,orientations:{...input.orientations,[item.id]:orientation},
      placementOverrides:input.placementOverrides.filter(row=>row.id!==item.id)}).plates;
     const plateIndex=layouts.findIndex(plate=>plate.placements.some(p=>p.id===item.id));
     candidates.push({orientation,label,plateIndex,placement:layouts[plateIndex]?.placements.find(p=>p.id===item.id)});
    }catch{candidates.push({orientation,label});}
   }
   const result=await comparePrintOrientations(candidates,geometries().get(item.id),current,{shouldCancel,onProgress:(n,total)=>{
    $('orientation-status').textContent='印刷向きを比較中 '+n+' / '+total;
   }});
   if(!result||shouldCancel())return;
   $('orientation-status').textContent=result.recommended?'部品単体で比較した目安です。候補を押すと向きを見比べられます。':'比較できる向きがありません。';
   const rows=result.rows.map(row=>{
    const button=document.createElement('button');
    button.type='button';button.dataset.orientation=row.orientation;
    button.textContent=row.label+(row.orientation===current?'（現在）':'')+(row.orientation===result.recommended?'（おすすめ）':'')+
     (!row.placement?' ／ 配置不可':row.incomplete?' ／ 検査未実施':' ／ 浮き '+row.floating+'・張り出し '+Number(row.area.toFixed(1))+' mm²');
    button.disabled=!row.placement;button.setAttribute('aria-pressed','false');button.onclick=()=>showComparison(row);
    return button;
   });
   $('orientation-candidates').replaceChildren(...rows);
   const selectedRow=result.rows.find(row=>row.orientation===current&&row.placement);
   if(selectedRow)showComparison(selectedRow);
  }catch(error){if(!shouldCancel())$('orientation-status').textContent='印刷向きを比較できませんでした。'+error.message;}
 }
 function endComparison(){
  comparison=null;$('orientation-review').hidden=true;setBusy(false);showCurrentPlate();
  if(warningGroup)warningGroup.visible=$('warnings').checked;
 }
 $('orientation-close').onclick=endComparison;
 $('orientation-apply').onclick=()=>{
  if(!comparison?.selected||comparison.selected.orientation===comparison.current)return;
  const {id,selected}=comparison;
  comparison=null;$('orientation-review').hidden=true;setBusy(false);
  orientations[id]=selected.orientation;overrides=overrides.filter(row=>row.id!==id);
  update();$('plate').value=String(selected.plateIndex);showCurrentPlate();
 };
 function renderOrientations(){
  $('orientations').replaceChildren(...items.map(item=>{
   const row=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),check=document.createElement('input'),lock=document.createElement('button'),compare=document.createElement('button');
   const locked=!!overrides.find(saved=>saved.id===item.id)?.locked;
   const inactive=busy||!!comparison;
   label.className='plate-check';check.type='checkbox';check.checked=targets.includes(item.id);check.disabled=inactive;
   label.append(check,item.name);row.append(label,select,lock,compare);
   check.onchange=()=>{targets=items.filter(entry=>entry.id===item.id?check.checked:targets.includes(entry.id)).map(entry=>entry.id);if(!check.checked)overrides=overrides.filter(saved=>saved.id!==item.id);renderOrientations();update();};
   select.setAttribute('aria-label',item.name+' の印刷向き');
   select.dataset.printOrientation=item.id;
   select.replaceChildren(...printOrientations.map(([value,name])=>new Option(name,value)));
   select.value=orientations[item.id]??'z+';select.disabled=inactive||!check.checked||locked;
   select.onchange=()=>{orientations[item.id]=select.value;overrides=overrides.filter(saved=>saved.id!==item.id);update();};
   lock.type='button';lock.dataset.printLock=item.id;lock.textContent=locked?'固定を解除':'位置・向きを固定';
   lock.setAttribute('aria-label',item.name+' の'+lock.textContent);lock.setAttribute('aria-pressed',String(locked));
   lock.disabled=inactive||!check.checked||(!locked&&!plates.some(plate=>plate.placements.some(p=>p.id===item.id)));
   compare.type='button';compare.textContent='印刷向きを比較';compare.dataset.printCompare=item.id;
   compare.disabled=inactive||!check.checked||locked||!plan;compare.onclick=()=>reviewOrientation(item);
   lock.onclick=()=>{
    if(busy||drag)return;
    if(plates.length){
     plates=plates.map(plate=>{
      if(!plate.placements.some(p=>p.id===item.id))return plate;
      return {...plate,placements:plate.placements.map(p=>p.id===item.id?{...p,locked:!locked}:p)};
     });
     snapshotPlacements();$('error').textContent='';showCurrentPlate();
    }else{
     overrides=overrides.map(saved=>saved.id===item.id?{...saved,locked:false}:saved);
     renderOrientations();update();
    }
   };
   return row;
  }));
 }
 function setBusy(value){
  busy=value;
  const inactive=value||!!comparison;
  for(const el of dialog.querySelectorAll('input,select')){
   const orientation=el.dataset.printOrientation;
   el.disabled=inactive||
    (orientation!==undefined&&(!targets.includes(orientation)||overrides.some(row=>row.id===orientation&&row.locked)));
  }
  $('repack').disabled=inactive;
  if(items)renderOrientations();
  $('apply').disabled=inactive||!plan||(editsModel()&&plateEntries().length>1);renderOverview();syncExport();
 }
 $('plate').onchange=()=>{focusNext=false;showCurrentPlate();};
 function updateMode(){
  $('orientations').hidden=$('plate-row').hidden=$('export').hidden=$('export-all').hidden=$('overview').hidden=$('inspection').hidden=$('placement-tools').hidden=legacy();
  $('apply').textContent=editsModel()?'モデルの配置を更新':'印刷配置を保存';
  $('apply-model').hidden=editsModel();
  $('apply-model').style.marginTop='8px';
 }
 async function checkOrExport({all=false,exportFiles=false}={}){
  if(busy||drag||comparison||!plan?.placements.length||legacy())return;
  const current=version,features=original,entries=all?plateEntries():[{plate:plan,index:Number($('plate').value)}];
  setBusy(true);if(all)$('overview').open=true;
  const isCurrent=()=>current===version&&dialog.open&&getFeatures()===features;
  try{
   for(const [i,{plate}] of entries.entries()){
    if(!isCurrent())return;
    $('error').textContent='印刷チェックを確認中 '+(i+1)+' / '+entries.length;
    if(!summaries.has(plate))await checkPlate(plate);
   }
   if(!isCurrent())return;
   if(exportFiles)await exportPlates(entries,features,isCurrent,(n,total)=>{$('error').textContent='3MFを作成中 '+n+' / '+total;},all);
   if(isCurrent())$('error').textContent='';
  }
  catch(error){if(isCurrent())$('error').textContent=error.message;}
  finally{if(current===version&&dialog.open)setBusy(false);}
 }
 $('export').onclick=()=>checkOrExport({exportFiles:true});
 $('export-all').onclick=()=>checkOrExport({all:true,exportFiles:true});
 $('check-all').onclick=()=>checkOrExport({all:true});
 $('form').addEventListener('input',event=>{if(event.target.matches('input[type=number],#print-layout-rotation'))update();});
 $('form').onsubmit=event=>{event.preventDefault();if(!$('apply').disabled)saveLayout(editsModel());};
 $('apply-model').onclick=()=>saveLayout(true);
 async function saveLayout(moveBodies){
  if(busy||drag||comparison||!plan?.placements.length)return;
  const input=spec(),current=version;
  if(moveBodies&&!legacy()){
   input.type='printLayout';
   input.id=editsModel()?id:relocationId;
   input.targets=plan.placements.map(p=>p.id);
   input.orientations=Object.fromEntries(plan.placements.map(p=>[p.id,p.orientation]));
   input.placementOverrides=plan.placements.map(p=>({
    id:p.id,plate:0,x:(p.min[0]+p.max[0])/2,y:(p.min[1]+p.max[1])/2,rotation:p.rotation,locked:!!p.locked,
   }));
  }
  setBusy(true);
  $('error').textContent=moveBodies?'モデルの位置と向きを更新しています…':'印刷配置を保存しています…';
  try{
   const result=moveBodies?await kernel.run(history,input):{outputs:[],remove:[]};
   if(current!==version||!dialog.open)return;
   if(getFeatures()!==original)throw Error('モデルが変更されました。開き直してください');
   await apply(input,result,editing?.spec.type===input.type?editing:null,original,()=>current===version&&dialog.open);
   if(current!==version||!dialog.open)return;
   busy=false;applied=moveBodies;dialog.close();
   notify(moveBodies?'表示していたプレートの '+input.targets.length+' ボディを移動しました':'印刷配置を'+plates.length+'枚のプレートで保存しました');
  }catch(error){if(current===version&&dialog.open)$('error').textContent=error.message;}
  finally{if(current===version)setBusy(false);}
 }
 return {open:async(feature=null)=>{
  if([...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)){notify('編集中の操作を終了してから印刷配置してください');return;}if(dialog.open)dialog.close();original=getFeatures();editing=feature;history=editsModel()?original.slice(0,original.findIndex(f=>f.id===feature.id)):original;id=feature?.id||crypto.randomUUID();relocationId=crypto.randomUUID();const visible=[...meshes].filter(([,m])=>m.visible).map(([id])=>id);targets=editsModel()?[...feature.spec.targets]:feature?.spec.targets.filter(id=>meshes.has(id))||visible;const available=editsModel()?[...targets]:[...new Set([...targets,...visible])];if(!available.length){notify('表示中のソリッドがありません');return;}
  orientations={...feature?.spec.orientations};overrides=structuredClone(feature?.spec.placementOverrides??[]);const request=++version;items=null;plates=[];plan=null;$('plate').replaceChildren();$('plate').disabled=false;$('repack').disabled=false;$('orientations').replaceChildren();updateMode();$('export').disabled=true;dialog.querySelector('h2').textContent=editsModel()?'モデルの印刷配置を編集':'印刷配置';busy=false;loading=true;applied=false;fitted=false;wasVisible=plate.visible;wasMargin=plateMargin;for(const el of dialog.querySelectorAll('input'))el.disabled=false;$('margin').value=feature?.spec.margin??2;$('gap').value=feature?.spec.gap??3;$('rotation').checked=feature?.spec.allowRotation??true;$('apply').disabled=true;$('info').textContent='';$('error').textContent='ボディの正確な寸法を確認しています…';showPlate(true);dialog.show();
  try{const result=await kernel.run(history,{type:'printLayoutInfo',targets:available});if(request!==version||!dialog.open)return;if(getFeatures()!==original)throw Error('モデルが変更されました。開き直してください');items=result.items.map(b=>({...b,name:bodyName(b.id)}));if(!legacy())renderOrientations();update();}
  catch(error){if(request===version&&dialog.open)$('error').textContent=error.message;}
  finally{if(request===version)loading=false;}
 },get active(){return dialog.open;}};
}
