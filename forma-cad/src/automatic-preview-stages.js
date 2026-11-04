import {subscribeKernelActivity} from './kernel-client.js';
import {createOperationDraftPreview} from './operation-draft-preview.js';
export function installAutomaticPreviewStages({scene,meshes,host}){
 const draft=createOperationDraftPreview({scene,meshes,host}),specs=new WeakMap();let active=null;
 function show(dialog,spec){draft.show(spec);let label=dialog.querySelector('.automatic-preview-phase');if(!label){label=document.createElement('p');label.className='automatic-preview-phase';label.setAttribute('role','status');(dialog.querySelector('form')||dialog).append(label);}label.textContent='簡易表示：加工対象の範囲。操作を止めてから精密形状を計算します。';}
 document.addEventListener('input',event=>{const dialog=event.target.closest?.('dialog[open]');if(dialog&&specs.has(dialog))show(dialog,specs.get(dialog));},true);
 subscribeKernelActivity(event=>{
  if(!event.automaticPreview)return;const spec=event.spec?.type==='preview'?event.spec.operation:event.spec;if(['meshExtrusionProbe','nativeExtrusionProbe','sketchRegionAnalysis','meshCombinePreview','exactExtrusionPreview'].includes(spec?.type))return;
  const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(!dialog||dialog.id==='tools-dialog')return;if(event.error?.code==='preview-manual'){specs.set(dialog,spec);show(dialog,spec);dialog.querySelector('.automatic-preview-phase').textContent='簡易表示中です。「精密確認」で加工後の形状を計算します。';return;}
  if(event.state==='started'){active={client:event.client,id:event.id,dialog};specs.set(dialog,spec);show(dialog,spec);}
  else if(active?.client===event.client&&active.id===event.id&&['completed','cancelled','error'].includes(event.state)){draft.clear();const label=active.dialog.querySelector('.automatic-preview-phase');if(label)label.textContent=event.state==='completed'?'精密プレビュー':event.state==='cancelled'?'':'精密プレビューを中断しました';active=null;}
 });
 document.addEventListener('close',()=>{draft.clear();active=null;},true);
}
