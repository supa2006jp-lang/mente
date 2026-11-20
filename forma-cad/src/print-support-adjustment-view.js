import * as THREE from 'three';
import {supportAdjustmentFields,supportAdjustmentLabel} from './print-support-adjustments.js';

const permissionsKey='forma-print-support-allowed-adjustments-v1';

export function createSupportAdjustmentPermissions(anchor,onChange){
 const panel=document.createElement('details');
 panel.dataset.id='auto-adjust-options';
 const summary=document.createElement('summary');
 summary.textContent='自動調整で変更してよい項目';
 panel.append(summary);
 anchor.append(panel);
 let allowed=supportAdjustmentFields;
 try{
  const saved=JSON.parse(localStorage.getItem(permissionsKey));
  if(Array.isArray(saved))allowed=saved;
 }catch{}
 const checks=supportAdjustmentFields.map(key=>{
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';input.dataset.autoAdjustAllow=key;input.checked=allowed.includes(key);
  input.onchange=()=>{
   try{localStorage.setItem(permissionsKey,JSON.stringify(value()));}catch{}
   onChange();
  };
  label.append(input,supportAdjustmentLabel(key));
  panel.append(label);
  return input;
 });
 const value=()=>checks.filter(input=>input.checked).map(input=>input.dataset.autoAdjustAllow);
 return {value,controls({enabled,disabled}){
  panel.hidden=!enabled;
  for(const input of checks)input.disabled=disabled;
 }};
}

const rounded=value=>Number(value.toFixed(2));

export function createSupportAdjustmentReview({anchor,scene,host,bodyName,loadFace,fitPreview}){
 const panel=document.createElement('details'),heading=document.createElement('summary'),status=document.createElement('small'),list=document.createElement('div');
 panel.dataset.id='auto-adjust-trials';panel.hidden=true;
 status.setAttribute('role','status');
 panel.append(heading,status,list);anchor.append(panel);
 let revision=0,blocked=false,highlight,active;
 function clearFocus(){
  revision++;
  if(highlight){
   highlight.removeFromParent();
   highlight.geometry.dispose();
   highlight.material.dispose();
  }
  highlight=null;
  active?.setAttribute('aria-pressed','false');
  active=null;status.textContent='';
  delete host.dataset.supportTrialFace;
 }
 async function focus(button,face){
  if(blocked)return;
  const toggle=active===button;
  clearFocus();
  if(toggle)return;
  const token=revision;
  active=button;
  button.setAttribute('aria-pressed','true');
  status.textContent='下面を確認しています…';
  try{
   const mesh=await loadFace(face.selection);
   if(revision!==token||blocked)return;
   if(!mesh?.vertices.length||!mesh.triangles.length)throw Error('下面の形状を取得できませんでした。');
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);
   geometry.computeBoundingBox();
   const material=new THREE.MeshBasicMaterial({color:face.placed?0x0088a8:0xea692e,side:THREE.DoubleSide,
    transparent:true,opacity:.7,depthTest:false,depthWrite:false});
   highlight=new THREE.Mesh(geometry,material);highlight.renderOrder=34;scene.add(highlight);
   fitPreview(geometry.boundingBox.clone().expandByScalar(.5));
   host.dataset.supportTrialFace=JSON.stringify({selection:face.selection,placed:face.placed});
   status.textContent=button.textContent;
  }catch(error){
   if(revision!==token)return;
   clearFocus();
   status.textContent=error?.message||'下面を表示できませんでした。';
  }
 }
 function controls(value){
  blocked=value;
  for(const button of list.querySelectorAll('button'))button.disabled=blocked;
  if(blocked&&active)clearFocus();
 }
 function show(reports){
  clearFocus();list.replaceChildren();
  const total=reports.reduce((sum,{report})=>sum+report.trials.length,0);
  panel.hidden=!total;
  if(!total)return;
  heading.textContent='試行結果（'+total+'件）';
  for(const {target,report} of reports){
   if(reports.length>1){
    const label=document.createElement('strong');
    label.textContent=bodyName(target);list.append(label);
   }
   for(const trial of report.trials){
    const details=document.createElement('details'),caption=document.createElement('summary');
    details.dataset.supportTrial=String(trial.number);
    const adopted=trial.number>0&&report.selected===trial.number;
    details.open=adopted||report.selected===null&&trial.number===0;
    const label=trial.number?'候補 '+trial.number:'調整前';
    const result=adopted?'採用':trial.status==='ready'?'検査通過':trial.status==='preflight'?'3MF要確認':'作成できず';
    caption.textContent=label+' ／ '+result;
    details.append(caption);
    if(trial.changes.length){
     const changes=document.createElement('small');changes.textContent=trial.changes.join(' ／ ');details.append(changes);
    }
    if(trial.quality){
     const {faces,roofArea,gap}=trial.quality,metrics=document.createElement('small');
     metrics.textContent='配置 '+faces+'面 ／ 上面の薄皮 '+rounded(roofArea)+' mm²'+
      (gap===null?'':' ／ 支えのない最大幅 '+rounded(gap)+' mm（目安）');
     details.append(metrics);
    }
    for(const note of trial.notices){
     const line=document.createElement('small');line.textContent=note;details.append(line);
    }
    for(const face of trial.faces){
     const button=document.createElement('button');
     button.type='button';button.dataset.supportTrialFace='';
     button.style.cssText='display:block;width:100%;margin:5px 0;text-align:left';
     const location=(face.number?'下面 '+face.number:'下面')+'（高さ '+rounded(face.selection.point[2])+' mm）';
     button.textContent=location+' ／ '+face.status;
     if(face.notes.length){
      const note=document.createElement('small');note.textContent=face.notes.join(' ／ ');button.append(note);
     }
     button.setAttribute('aria-pressed','false');
     button.onclick=()=>focus(button,face);
     details.append(button);
    }
    list.append(details);
   }
  }
  controls(blocked);
 }
 return {show,controls,clearFocus,clear(){panel.open=false;show([]);}};
}
