import {subscribeKernelActivity} from './kernel-client.js';
const names={printSupport:'連結リブサポートの作成',assemblyMate:'部品の位置合わせ・固定',assemblyInfo:'位置合わせの基準面',assemblyRelease:'固定の解除',join:'結合・切り取り',fillet:'フィレット',chamfer:'面取り',replay:'履歴の再計算',compactProject:'保存データの整理',extrusionBatch:'押し出し',barrierPreparedPreview:'バリア押し出しのプレビュー・確定準備',extrusion:'押し出し',move:'移動／回転',shell:'シェル',enclose:'囲み形成',coilJoint:'コイル接合',stepImport:'STEP読込',coil:'コイル',revolve:'回転体',pipe:'パイプ',loft:'ロフト',thread:'ねじ',offset:'オフセット平面',circular:'円形状パターン',rectangular:'矩形状パターン',printLayout:'印刷配置',qrCode:'QRコード'};
Object.assign(names,{stlMeshes:'STL出力',threadDisplayMeshes:'ねじの軽量表示'});
Object.assign(names,{exactExtrusionPreview:'加工後のCADプレビュー'});
Object.assign(names,{selectionTemplateExport:'選択部品の保存',selectionTemplateImport:'選択部品の読み込み'});
Object.assign(names,{geometryGapRepair:'隙間の修正プレビュー',geometryHealth:'形状の精度・微小箇所の検査',resize:'サイズ変更・寸法維持',bodyComponents:'離れた部品の検査',compareShapes:'加工前後の比較'});
export function installKernelActivityView({host,onFailure,onSuccess}){
 const panel=document.createElement('section');panel.id='kernel-activity-panel';panel.className='workspace-panel';panel.hidden=true;panel.innerHTML='<strong id="kernel-activity-title"></strong><p id="kernel-activity-status" role="status" aria-live="polite"></p><progress id="kernel-activity-progress" style="width:100%"></progress><p id="kernel-activity-time"></p><button id="kernel-activity-cancel" type="button">この処理を中止</button>';
 panel.setAttribute('popover','manual');host.parentElement.append(panel);const q=name=>panel.querySelector('#kernel-activity-'+name),jobs=new Map();let clientIndex=0;const clients=new WeakMap();let timer=null,active=null;
 const key=event=>{if(!clients.has(event.client))clients.set(event.client,++clientIndex);return clients.get(event.client)+':'+event.id;};
 function render(){
  active=[...jobs.values()].find(job=>job.state!=='queued')||[...jobs.values()][0];panel.hidden=!active;if(!active){try{panel.hidePopover();}catch{}clearInterval(timer);timer=null;return;}
  const operation=active.spec?.type==='preview'?active.spec.operation:active.spec,type=operation?.type||'形状計算';q('title').textContent=(active.spec?.type==='preview'?'プレビュー：':'')+(names[type]||'形状計算');q('status').textContent=active.progress?.stage||(active.state==='queued'?'前の計算を待っています':'形状を計算しています…');
  const p=active.progress;if(Number.isFinite(p?.current)&&Number.isFinite(p?.total)&&p.total>0){q('progress').max=p.total;q('progress').value=Math.max(0,Math.min(p.total,p.current));}else q('progress').removeAttribute('value');
  q('time').textContent='経過 '+Math.floor((Date.now()-(active.started||active.created))/1000)+' 秒'+(jobs.size>1?' ／ 他に '+(jobs.size-1)+' 件':'');
  const dialog=document.querySelector('dialog[open]');if(dialog&&!dialog.contains(panel)){panel.style.cssText='';dialog.append(panel);}else if(!dialog&&panel.parentElement!==host.parentElement){panel.style.cssText='';host.parentElement.append(panel);}
  try{if(!panel.matches(':popover-open'))panel.showPopover();}catch{}
  if(!timer)timer=setInterval(render,1000);
 }
 subscribeKernelActivity(event=>{
  if(['drawingCoordinates','printLayoutInfo'].includes(event.spec?.type)||!event.spec)return;
  const id=key(event);
  if(['completed','error','cancelled'].includes(event.state)){jobs.delete(id);if(event.state==='error')onFailure?.(event.error,event.spec,event.features);if(event.state==='completed')onSuccess?.();}
  else jobs.set(id,{...(jobs.get(id)||{}),...event});render();
 });
 q('cancel').onclick=()=>{if(active)active.client.cancel(active.id);};
 return {get busy(){return jobs.size>0;}};
}
