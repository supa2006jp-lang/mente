import {KernelClient} from './kernel-client.js';

export function createFilletRadiusTool({getFeatures,getSpec,cancelPreview,showResult,showLimit=()=>{},bodyName=id=>id,formatError=error=>error.message}){
 const worker=new KernelClient(),$=id=>document.getElementById(id);let revision=0,busy=false,button,status,verifiedStatus,useButton,expandInput,limitStatus,limitToggle,verified=null,limiting=null;
 function updateLimit(){
  if(!limitStatus)return;
  const value=limiting&&(!verified||limiting.radius>verified.radius)?limiting:null,diagnostics=value?.diagnostics;
  if(!value){limitStatus.textContent='';showLimit(null);return;}
  const names=(diagnostics?.bodyIds||[]).map(bodyName).join('、'),exact=diagnostics?.certainty==='faulty-contour';
  limitStatus.textContent='R'+value.radius.toFixed(2)+' mmで失敗：'+(names||'対象ボディ')+'。'+(exact?'赤：失敗を報告した元の辺。':'橙：失敗したボディの対象範囲。原因の辺は未特定です。');
  showLimit(limitToggle.checked?value:null);
 }
 function updateVerified(info){verified=info;verifiedStatus.textContent=info?'確認済み：R'+info.radius.toFixed(2)+' mm ／ '+info.bodies+'ボディ・'+info.edges+'辺':'';useButton.hidden=useButton.disabled=!busy||!info;updateLimit();}
 function cancel(clear=true){
  ++revision;if(busy){worker.reset();busy=false;$('cad-apply').disabled=false;}
  if(button)button.textContent='全ての辺に掛けられる半径を調べる';if(useButton)useButton.hidden=useButton.disabled=true;
  if(clear){verified=limiting=null;if(status)status.textContent='';if(verifiedStatus)verifiedStatus.textContent='';if(limitStatus)limitStatus.textContent='';showLimit(null);}
 }
 async function start(){
  if(busy){cancel(false);status.textContent='検査を中止しました。半径とモデルは変更していません';return;}
  const original=getFeatures(),spec=getSpec(),signature=JSON.stringify(spec),input=$('cad-radius'),expand=expandInput.checked;
  if(!input.checkValidity()||!Number.isFinite(spec.radius)||spec.radius<.01){status.textContent='上限半径を0.01 mm以上で入力してください';return;}
  cancelPreview(true);const current=++revision;busy=true;$('cad-apply').disabled=true;button.textContent='半径の検査を中止';status.textContent='全ての対象を同じ半径で検査しています…';$('cad-error').textContent='';
  const isActive=()=>current===revision&&getFeatures()===original&&$('tools-dialog').open&&$('cad-command').value==='fillet';
  const isCurrent=()=>isActive()&&JSON.stringify(getSpec())===signature&&expandInput.checked===expand;
  try{
   const result=await worker.run(original,{type:'filletRadiusSearch',operation:spec,expand},{onProgress:progress=>{
    if(!isCurrent())return;if(progress.stage)status.textContent=progress.stage;
    if(progress.filletRadiusVerified)updateVerified(progress.filletRadiusVerified);
    if(progress.filletRadiusFailure){limiting=progress.filletRadiusFailure;updateLimit();}
   }});
   if(!isCurrent())return;
   const info=result.analysis?.filletRadiusSearch;if(!info||!result.outputs?.length)throw Error('全ての辺へ適用できる半径を確認できませんでした');
   input.value=info.radius.toFixed(2);await showResult(result,{...spec,radius:info.radius},original);limiting=info.limiting||null;updateVerified(info);
   status.textContent=(info.limitReason==='user'?'確認済みの値で検査を終了しました。':info.limitReason==='kernel-error'?'形状計算が不安定になったため、全対象で確認済みの値を表示しています。上限は未確認です。':info.limitReason==='radius-limit'?'検索上限のR10000.00 mmまで確認しました。':info.limitReason?'検査上限までに確認できた値です。':info.expanded?'小さい半径から上限を広げ、0.01 mm単位で検査しました。':'入力した上限 R'+info.upperRadius.toFixed(2)+' mm以下を0.01 mm単位で検査しました。')+'「実行」で適用します';
  }catch(error){if(isActive())status.textContent=formatError(error);}
  finally{if(current===revision){busy=false;$('cad-apply').disabled=false;useButton.hidden=useButton.disabled=true;button.textContent='全ての辺に掛けられる半径を調べる';}}
 }
 return {
  cancel,
  render(){
   cancel();$('fillet-radius-tools')?.remove();button=status=verifiedStatus=useButton=expandInput=limitStatus=limitToggle=null;
   if($('cad-command').value!=='fillet'||!$('cad-radius'))return;
   $('cad-radius').min='.01';
   const section=document.createElement('section');section.id='fillet-radius-tools';section.style.cssText='display:grid;gap:8px';
   button=document.createElement('button');button.type='button';button.id='fillet-radius-search';button.textContent='全ての辺に掛けられる半径を調べる';button.onclick=start;
   function check(id,text){const label=document.createElement('label');label.style.cssText='display:flex;flex-direction:row;align-items:center;gap:8px;font-size:13px;margin:0';const input=document.createElement('input');input.type='checkbox';input.id=id;input.checked=true;input.style.cssText='width:auto;margin:0';label.append(input,document.createTextNode(text));return {label,input};}
   const expand=check('fillet-radius-expand','入力半径を超えて上限も自動で探す');expandInput=expand.input;
   const toggle=check('fillet-radius-show-limit','失敗した箇所を色表示');limitToggle=toggle.input;limitToggle.oninput=event=>{event.stopPropagation();updateLimit();};
   function text(id){const node=document.createElement('p');node.id=id;node.setAttribute('role','status');node.style.cssText='font-size:13px;line-height:1.6;margin:0';return node;}
   verifiedStatus=text('fillet-radius-verified');status=text('fillet-radius-status');limitStatus=text('fillet-radius-limit');
   useButton=document.createElement('button');useButton.id='fillet-radius-use';useButton.type='button';useButton.hidden=useButton.disabled=true;useButton.textContent='確認済みのこの値を使う';useButton.onclick=()=>{if(busy&&verified)worker.acceptFilletRadius();};
   const help=document.createElement('small');help.textContent='小さい半径から全対象の辺を省かず、同じ半径で検査します。確認済みの値で途中終了できます。';help.style.cssText='font-size:13px;line-height:1.6';
   section.append(expand.label,button,help,verifiedStatus,useButton,status,toggle.label,limitStatus);$('cad-radius').closest('label').after(section);
  }
 };
}
