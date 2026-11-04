import {subscribeKernelActivity} from './kernel-client.js';
import {clearPreviewTimeouts,isAutomaticPreview} from './preview-timeout-cache.js';
export function installPreviewRetry(){
 const buttons=new WeakMap();
 subscribeKernelActivity(event=>{if(event.state!=='error'||!['timeout','preview-timeout-cached','fillet-budget'].includes(event.error?.code)||!(event.automaticPreview||isAutomaticPreview(event.spec)))return;const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(!dialog)return;let button=buttons.get(dialog);if(!button){button=document.createElement('button');button.type='button';button.className='preview-retry';button.textContent='プレビューを再試行';button.onclick=()=>{clearPreviewTimeouts();button.hidden=true;dialog.dispatchEvent(new Event('forma-preview-retry'));};(dialog.querySelector('.editor-actions')||dialog.querySelector('form')||dialog).append(button);buttons.set(dialog,button);dialog.addEventListener('close',()=>button.hidden=true);}button.hidden=false;});
}
