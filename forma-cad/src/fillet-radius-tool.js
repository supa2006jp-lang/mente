import {KernelClient} from './kernel-client.js';

export function createFilletRadiusTool({getFeatures,getSpec,cancelPreview,showResult,formatError=error=>error.message}){
 const worker=new KernelClient(),$=id=>document.getElementById(id);let revision=0,busy=false,button,status;
 function cancel(clear=true){
  ++revision;if(busy){worker.reset();busy=false;$('cad-apply').disabled=false;}
  if(button)button.textContent='全ての辺に掛けられる半径を調べる';if(clear&&status)status.textContent='';
 }
 async function start(){
  if(busy){cancel(false);status.textContent='検査を中止しました。半径とモデルは変更していません';return;}
  const original=getFeatures(),spec=getSpec(),signature=JSON.stringify(spec),input=$('cad-radius');
  if(!input.checkValidity()||!Number.isFinite(spec.radius)||spec.radius<.01){status.textContent='上限半径を0.01 mm以上で入力してください';return;}
  cancelPreview(true);const current=++revision;busy=true;$('cad-apply').disabled=true;button.textContent='半径の検査を中止';status.textContent='全ての対象を同じ半径で検査しています…';$('cad-error').textContent='';
  const isActive=()=>current===revision&&getFeatures()===original&&$('tools-dialog').open&&$('cad-command').value==='fillet';
  const isCurrent=()=>isActive()&&JSON.stringify(getSpec())===signature;
  try{
   const result=await worker.run(original,{type:'filletRadiusSearch',operation:spec},{onProgress:progress=>{if(isCurrent()&&progress.stage)status.textContent=progress.stage;}});
   if(!isCurrent())return;
   const info=result.analysis?.filletRadiusSearch;if(!info||!result.outputs?.length)throw Error('全ての辺へ適用できる半径を確認できませんでした');
   input.value=info.radius.toFixed(2);await showResult(result,{...spec,radius:info.radius},original);
   status.textContent='確認済み：R'+info.radius.toFixed(2)+' mm ／ '+info.bodies+'ボディ・'+info.edges+'辺。'+(info.limitReason?'検査上限までに確認できた値です。':'入力した上限 R'+info.upperRadius.toFixed(2)+' mm以下を0.01 mm単位で検査しました。')+'「実行」で適用します';
  }catch(error){if(isActive())status.textContent=formatError(error);}
  finally{if(current===revision){busy=false;$('cad-apply').disabled=false;button.textContent='全ての辺に掛けられる半径を調べる';}}
 }
 return {
  cancel,
  render(){
   cancel();$('fillet-radius-tools')?.remove();button=status=null;
   if($('cad-command').value!=='fillet'||!$('cad-radius'))return;
   $('cad-radius').min='.01';
   const section=document.createElement('section');section.id='fillet-radius-tools';section.style.cssText='display:grid;gap:8px';
   button=document.createElement('button');button.type='button';button.id='fillet-radius-search';button.textContent='全ての辺に掛けられる半径を調べる';button.onclick=start;
   const help=document.createElement('small');help.textContent='入力した半径を上限に、対象の辺を省かず一括適用できる値を調べます。';help.style.cssText='font-size:13px;line-height:1.6';
   status=document.createElement('p');status.id='fillet-radius-status';status.setAttribute('role','status');status.style.cssText='font-size:13px;line-height:1.6;margin:0';section.append(button,help,status);$('cad-radius').closest('label').after(section);
  }
 };
}
