import * as THREE from 'three';
import {supportSliceBounds} from './print-support-slice-paths.js';
import {readSupportSliceProject} from './print-support-slice-project.js';
import {proposeSupportSliceRepair} from './print-support-slice-repair.js';
import {captureSupportSliceReport,createSupportSliceHistory,supportSliceComparisonScope} from './print-support-slice-comparison.js';
import {renderSupportSliceMeasurements} from './print-support-slice-measurement-view.js';

const roleNames={rib:'リブ',upper:'上面の薄皮',lower:'底面の薄皮',column:'補完の柱'};
const rowState=row=>!row.checked&&!row.unsliced?'unknown':!row.found?'missing':
 row.checked!==row.found||row.unsliced?'partial':'found';
const range=(values,digits)=>[Math.min(...values),Math.max(...values)].map(value=>Number(value.toFixed(digits)))
 .filter((value,index,list)=>!index||value!==list[0]).join('〜');

function sliceInputs(entries){
 const parts=new Map(),supportIds=new Set(),sources=[];
 for(const {input,result} of entries){
  const pkg=result.supportPackage,preview=result.supportPreview;
  pkg.bodies.forEach(body=>parts.set(body.id,body));supportIds.add(input.id);
  const mesh=pkg.bodies.find(body=>body.id===input.id);
  sources.push({target:input.target,mesh,topGap:input.topGap,sideGap:input.sideGap,bedZ:input.bedZ,wallThickness:input.wallThickness,lineWidth:input.lineWidth,
   baseIds:[...new Set([input.target,...result.analysis.printSupport.baseBodyIds])],
   ribs:(preview.ribs||[]).map(({id,number,axis,center,ceiling,bounds,excluded,ceilingId,thickness})=>({id,number,axis,center,ceiling,bounds,excluded,ceilingId,thickness})),
   skins:(preview.skins||[]).flat().map(({vertices,side,ribs,ceilingId})=>({side,ribs,ceilingId,bounds:supportSliceBounds(vertices)})),
   columns:(preview.columns||[]).map(({point,radius,top,bottom})=>({point,radius,top,bottom})),
   ceilings:(preview.coverage||[]).filter(row=>!row.autoSupportReason&&row.face?.triangles.length)
    .map(({face,ceilingId,ceilingNumber},index)=>({id:ceilingId??'face-'+index,number:ceilingNumber??index+1,
     face:{vertices:face.vertices,triangles:face.triangles}})),
  });
 }
 return {parts:[...parts.values()],sources,models:[...parts.values()].filter(part=>!supportIds.has(part.id))};
}

export function createSupportSliceReview({anchor,scene,host,kernel,getEntries,fitPreview,bodyName,onChange,previewRepair,adoptRepair}){
 const panel=document.createElement('details');
 panel.dataset.id='slice-review';
 panel.innerHTML='<summary>スライス済み3MFで印刷経路を確認</summary><small>この配置をBambu Studioでスライスし、スライス済み3MFを選んでください。同じタブで同じ本体の結果を続けて読み込むと比較できます。</small>'+
  '<button type="button" data-slice="open">スライス済み3MFを選ぶ</button><input type="file" accept=".3mf" data-slice="file" hidden>'+
  '<button type="button" data-slice="clear" hidden>確認マークを消す</button><div data-slice="status" role="status"></div><div data-slice="results"></div>';
 anchor.after(panel);
 const q=id=>panel.querySelector('[data-slice="'+id+'"]');
 let serial=0,checking=false,blocked=false,focus=null;
 const history=createSupportSliceHistory();
 let selectedRepair=null,repairViewed=false;
 const repair=document.createElement('div');
 repair.dataset.slice='repair';repair.hidden=true;
 repair.style.cssText='padding:8px;margin:6px 0;border-left:3px solid #1288a0;';
 repair.innerHTML='<strong data-repair="title"></strong><small data-repair="basis"></small>'+
  '<button type="button" data-repair="try">修正案をプレビュー</button> <button type="button" data-repair="adopt" class="accent" hidden>この修正を採用</button>'+
  '<small data-repair="status" role="status"></small>';
 const control=id=>repair.querySelector('[data-repair="'+id+'"]');
 function selectRepair(button,plan){
  selectedRepair=plan;repairViewed=false;
  repair.hidden=!plan;
  if(!plan)return;
  button.after(repair);
  control('title').textContent=plan.title;
  control('basis').textContent=plan.basis;
  setRepairPreview(false);
  sync(blocked);
 }
 function repairMessage(message){control('status').textContent=message;}
 function setRepairPreview(viewed){
  if(!selectedRepair)return;
  repairViewed=viewed;
  control('try').textContent=viewed?'修正前の配置に戻す':'修正案をプレビュー';
  control('adopt').hidden=!viewed;
  repairMessage(viewed?'修正案の形状を表示しています。':'');
 }
 control('try').onclick=()=>{if((!blocked||repairViewed)&&!checking&&selectedRepair)previewRepair(repairViewed?null:selectedRepair);};
 control('adopt').onclick=()=>{if(repairViewed&&selectedRepair)adoptRepair(selectedRepair);};
 const file=q('file');
 function clearFocus(){
  if(focus){
   focus.removeFromParent();
   focus.traverse(item=>{item.geometry?.dispose();item.material?.dispose();});
   focus=null;
  }
  q('clear').hidden=true;
  for(const button of q('results').querySelectorAll('[aria-pressed]'))button.setAttribute('aria-pressed','false');
  delete host.dataset.supportSliceFocus;
  delete host.dataset.supportSliceOverlay;
 }
 function overlay(button,items,{fit=true,...measurement}={}){
  clearFocus();
  const group=new THREE.Group(),vertices=values=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  let size=0;
  for(const {lines,points,color} of items){
   if(lines?.length){
    const paths=new THREE.LineSegments(vertices(lines),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));
    paths.renderOrder=40;group.add(paths);size+=lines.length/3;
   }
   if(points?.length){
    const marks=new THREE.Points(vertices(points),new THREE.PointsMaterial({color,size:8,sizeAttenuation:false,depthTest:false,depthWrite:false}));
    marks.renderOrder=41;group.add(marks);size+=points.length/3;
   }
  }
  if(!size)return;
  focus=group;scene.add(group);
  if(fit)fitPreview(new THREE.Box3().setFromObject(group).expandByScalar(3));
  button.setAttribute('aria-pressed','true');q('clear').hidden=false;
  host.dataset.supportSliceFocus=String(size);
  if(measurement.kind)host.dataset.supportSliceOverlay=JSON.stringify(measurement);
 }
 function rowButton(label,points,color,plan){
  const button=document.createElement('button');
  button.type='button';button.textContent=label;button.disabled=!points.length;button.dataset.empty=String(!points.length);
  button.style.cssText='display:block;text-align:left;margin:5px 0;width:100%;';
  button.setAttribute('aria-pressed','false');
  button.onclick=()=>{if(!blocked&&!checking){overlay(button,[{points:points.flat(),color}]);selectRepair(button,plan);}};
  return button;
 }
 function show(result,plate,entries,reference){
  const area=q('results'),{rows,layerCount,printSettings}=result;
  area.replaceChildren();
  const states=rows.map(rowState);
  const missing=states.filter(state=>state==='missing').length,partial=states.filter(state=>state==='partial').length;
  const unknown=states.filter(state=>state==='unknown').length;
  q('status').textContent='プレート '+plate+' ／ '+layerCount+'層 ／ 経路なし '+missing+'箇所 ／ 一部要確認 '+partial+'箇所'+(unknown?' ／ 判定できず '+unknown+'箇所':'');
  host.dataset.supportSliceReview=JSON.stringify({plate,layerCount,missing,partial,unknown});
  for(const role of ['upper','lower']){
   const checks=rows.flatMap(row=>row.contacts).filter(contact=>contact.role===role);
   const label=(role==='upper'?'上側':'土台側')+'の縦すき間';
   const note=document.createElement('small');
   note.textContent=checks.length?label+' '+range(checks.map(check=>check.layers),0)+'層（'+range(checks.map(check=>check.gap),2)+' mm） ／ 確認 '+checks.length+'点':
    label+'を確認できる接点がありませんでした。';
   area.append(note);
   if(role==='upper'){
    const touching=checks.filter(check=>!check.layers);
    if(touching.length)area.append(rowButton('空き層がない上側の接点を表示（'+touching.length+'点）',touching.map(check=>check.point),0xffab24));
   }
  }
  area.append(renderSupportSliceMeasurements(result,reference,{bodyName,
   showOverlay(button,items,measurement){
    if(blocked||checking)return;
    selectRepair(null,null);overlay(button,items,measurement);
   },clearOverlay:clearFocus}));
  const names=new Set(rows.map(row=>row.target));
  for(const [i,row] of rows.entries()){
   if(states[i]==='found')continue;
   const label=(names.size>1?bodyName(row.target)+' ／ ':'')+roleNames[row.kind]+' '+row.number;
   const status={missing:'経路が見つかりません',partial:'一部の経路を要確認',unknown:'経路を判定できません'}[states[i]];
   const plan=proposeSupportSliceRepair(row,entries.find(entry=>entry.input.target===row.target),printSettings);
   area.append(rowButton(label+' ／ '+status,row.missingPoints,states[i]==='missing'?0xe8324e:0xffab24,plan));
  }
  const note=document.createElement('small');
  note.textContent='色は確認した位置を示します。経路と線幅から、積層の途中や接点を照合した目安です。';
  area.append(note);
  sync(blocked);
 }
 function reset(){
  serial++;
  if(checking)kernel.reset();
  checking=false;file.value='';
  clearFocus();selectRepair(null,null);setRepairPreview(false);q('status').textContent='';q('results').replaceChildren();
  delete host.dataset.supportSliceReview;
 }
 function sync(disabled,allowRepair=false){
  blocked=disabled;
  const ready=getEntries().length>0;
  q('open').disabled=file.disabled=blocked||checking||!ready;
  for(const control of q('results').querySelectorAll('button,select,input'))control.disabled=blocked||checking||control.dataset.empty==='true';
  control('try').disabled=checking||blocked&&!allowRepair;
  control('adopt').disabled=checking||!allowRepair;
 }
 q('clear').onclick=()=>{clearFocus();if(!repairViewed)selectRepair(null,null);};
 q('open').onclick=()=>file.click();
 file.onchange=async()=>{
  const chosen=file.files?.[0],entries=getEntries();
  file.value='';
  if(!chosen||blocked||checking||!entries.length)return;
  reset();
  const request=serial;
  const current=()=>{
   const latest=getEntries();
   return request===serial&&latest.length===entries.length&&latest.every((entry,i)=>entry.result===entries[i].result);
  };
  checking=true;q('status').textContent='スライス済み3MFを開いています…';onChange();
  try{
   const bytes=new Uint8Array(await chosen.arrayBuffer());
   if(!current())return;
   const {parts,sources,models}=sliceInputs(entries);
   const scope=supportSliceComparisonScope(sources,models),reference=history.previous(scope);
   const {matrix,objectId,gcode,plate}=readSupportSliceProject(bytes,parts);
   const result=await kernel.run([],{type:'printSupportSliceReview',matrix,objectId,gcode,sources,models,previous:reference?.report},{
    foreground:true,onProgress:update=>{if(current()&&update.stage)q('status').textContent=update.stage;},
   });
   if(current()){
    show(result,plate,entries,reference);
    history.remember(scope,{name:chosen.name,report:captureSupportSliceReport(result.rows)});
   }
  }catch(error){if(current())q('status').textContent=error.message;}
  finally{if(request===serial){checking=false;onChange();}}
 };
 return {panel,reset,sync,clearFocus,repairMessage,setRepairPreview,get checking(){return checking;}};
}
