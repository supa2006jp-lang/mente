import {cadErrorAdvice} from './cad-error-advice.js';
import {compactExtrusionRequest} from './kernel-transfer.js';
import {createFilletInspectionGuard} from './fillet-inspection-guard.js';
import {previewResultGuard} from './preview-result-guard.js';
import {previewTimeoutCache,previewTimeoutKey,isAutomaticPreview} from './preview-timeout-cache.js';
import {isPrecisionPreview,precisionPreviewDeferReason,precisionPreviewMode,rememberSlowPrecisionPreview,waitForPrecisionPreview} from './precision-preview-mode.js';
const liveClients=new Set();
export function cancelAutomaticPrecisionPreviews(){for(const reference of liveClients){const client=reference.deref();if(!client){liveClients.delete(reference);continue;}for(const [id,p]of [...client.pending])if(p.precisionPreview)client.cancel(id);}}
const activityListeners=new Set();
export function subscribeKernelActivity(listener){activityListeners.add(listener);return ()=>activityListeners.delete(listener);}
function activity(client,id,p,state,extra={}){
 if(state==='progress'&&extra.progress?.stage&&extra.progress.stage!==p.lastStage){
  p.lastStage=extra.progress.stage;
  p.stageStarted=Date.now();
 }
 if(p.lastStage){
  const now=Date.now();
  extra.calculation={stage:p.lastStage,stageElapsedMs:Math.max(0,now-p.stageStarted),elapsedMs:Math.max(0,now-p.started)};
 }
 const event={
  client,id,state,spec:p.payload.spec,features:p.activityFeatures||p.payload.features||[],
  started:p.started,created:p.created,
  automaticPreview:p.automaticPreview||isAutomaticPreview(p.payload.spec),...extra
 };
 for(const listener of activityListeners){
  try{listener(event);}catch(error){console.warn('計算状況の表示を更新できませんでした',error);}
 }
}
export function freshSvgEngine(features,spec){const operation=spec?.type==='preview'?spec.operation:spec;return operation?.type==='svgWrap'||spec?.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='svgWrap');}
const fatalKernelError=message=>/indirect call to null|null function|memory access out of bounds|unreachable|table index|function signature mismatch|aborted|RuntimeError/i.test(message||'');
// Requests run one at a time. A queued request cannot time out an active CAD job.
export function kernelTimeout(features,spec){
 if(spec.type==='sketchRegionAnalysis')return 15000;
 if(spec.type==='meshCombinePreview')return 5000;
 if(spec.type==='formPreview'&&spec.form?.wall)return 25000;
 if(spec.type==='formWallSearch')return 36000;
 const operation=spec.type==='preview'?spec.operation:spec;
 const coil=['coilJoint','coilTestPiece'].includes(operation?.type)||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='coilJoint');
 const svgWrap=operation?.type==='svgWrap'||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='svgWrap');
 const join=operation?.type==='join'||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='join');
 return coil?600000:svgWrap||join?300000:['pull','stepImport'].includes(operation?.type)?300000:90000;
}
export class KernelClient {
 constructor(factory=()=>{const url=new URL('kernel-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;return new Worker(url,{type:'module'});},{filletTrialTimeout=4000}={}){this.factory=factory;this.filletTrialTimeout=filletTrialTimeout;this.worker=null;this.pending=new Map();this.next=0;this.active=null;liveClients.add(new WeakRef(this));}
 reset(error=new Error('計算をキャンセルしました')){this.worker?.terminate();this.worker=null;this.active=null;for(const [id,p] of this.pending){clearTimeout(p.timer);p.filletGuard?.clear();const formatted=cadErrorAdvice(error,p.payload.spec);activity(this,id,p,formatted.code==='cancelled'?'cancelled':'error',{error:formatted});p.reject(formatted);}this.pending.clear();}
 cancel(id){const p=this.pending.get(id);if(!p)return;clearTimeout(p.timer);p.filletGuard?.clear();this.pending.delete(id);if(this.active===id){this.worker?.terminate();this.worker=null;this.active=null;}const error=cadErrorAdvice('計算をキャンセルしました',p.payload.spec);activity(this,id,p,'cancelled',{error});p.reject(error);this.dispatch();}
 finishFilletInspection(id,worker,reason='trial-time'){
  const p=this.pending.get(id);if(!p||this.active!==id||this.worker!==worker)return;
  const result=p.filletGuard.result(reason);clearTimeout(p.timer);p.filletGuard.clear();worker.terminate();this.worker=null;this.active=null;this.pending.delete(id);
  if(result){p.resolve(result);}
  else{previewTimeoutCache.remember(p.timeoutDocument,p.timeoutKey);const error=cadErrorAdvice(Object.assign(Error(p.payload.spec?.type==='filletRadiusSearch'?'半径の検査を時間上限で中断しました。全ての辺へ掛けられる半径はまだ確認できていません。対象を絞って再度調べてください':'輪郭の検査を時間上限で中断しました。まだ適用できる辺を確認できていません。辺を絞って再実行してください。元のボディは変更していません'),{code:'fillet-budget'}),p.payload.spec);activity(this,id,p,'error',{error});p.reject(error);}
  this.dispatch();
 }
 acceptFilletRadius(){
  const p=this.pending.get(this.active);if(p?.payload.spec?.type!=='filletRadiusSearch'||!p.filletGuard?.hasResult())return false;
  this.finishFilletInspection(this.active,this.worker,'user');return true;
 }
 cancelPreviews(){for(const [id,p] of [...this.pending])if(p.payload.spec?.type==='preview')this.cancel(id);}
 cancelExtrusionPreviews(){for(const [id,p] of [...this.pending])if(p.payload.spec?.type==='exactExtrusionPreview'||p.payload.spec?.type==='extrusionToolPreview'||p.payload.spec?.type==='extrusionJoinInspect'||p.payload.spec?.type==='barrierPreparedPreview'||p.payload.spec?.type==='preview'&&p.payload.spec.operation?.type==='extrusion')this.cancel(id);}
 cancelQueuedExtrusions(){for(const [id,p] of [...this.pending])if(id!==this.active&&(p.payload.spec?.type==='exactExtrusionPreview'||p.payload.spec?.type==='extrusionToolPreview'||p.payload.spec?.type==='extrusionJoinInspect'||p.payload.spec?.type==='barrierPreparedPreview'||p.payload.spec?.type==='preview'&&p.payload.spec.operation?.type==='extrusion'))this.cancel(id);}
 dispatch(){
  if(this.active!==null)return;const entry=this.pending.entries().next().value;if(!entry)return;const [id,p]=entry;
  if(freshSvgEngine(p.payload.features||[],p.payload.spec)&&this.worker){this.worker.terminate();this.worker=null;}
  if(!this.worker){let worker;try{worker=this.factory();}catch(e){this.reset(e);return;}this.worker=worker;worker.onmessage=({data})=>{if(this.worker!==worker)return;const pending=this.pending.get(data.id);if(!pending)return;if(data.progress){const progress=pending.filletGuard.progress(data.progress);activity(this,data.id,pending,'progress',{progress});pending.onProgress?.(progress);return;}clearTimeout(pending.timer);pending.filletGuard?.clear();if(data.timings){try{pending.onTiming?.(data.timings);}catch(error){console.warn('計算時間を表示できませんでした',error);}}if(data.error&&fatalKernelError(data.error)&&pending.payload.spec?.type==='filletRadiusSearch'&&pending.filletGuard?.hasResult()){this.finishFilletInspection(data.id,worker,'kernel-error');return;}if(data.error&&fatalKernelError(data.error)){this.worker?.terminate();this.worker=null;this.active=null;if(!pending.retried){pending.retried=true;pending.onProgress?.({stage:'計算エンジンを再起動しています',current:0,total:1});this.dispatch();return;}}this.pending.delete(data.id);this.active=null;if(pending.precisionPreview)rememberSlowPrecisionPreview(pending.timeoutDocument,pending.payload.spec,Date.now()-pending.started);if(data.error){const error=cadErrorAdvice(Object.assign(new Error(data.error),data.details||{}),pending.payload.spec);activity(this,data.id,pending,'error',{error});pending.reject(error);}else{pending.resolve(data.result);}this.dispatch();};worker.onerror=e=>{if(this.worker!==worker)return;const p=this.pending.get(this.active);if(p?.payload.spec?.type==='filletRadiusSearch'&&p.filletGuard?.hasResult()){this.finishFilletInspection(this.active,worker,'kernel-error');return;}this.reset(Error(e.message||'CADエンジンを起動できませんでした'));};worker.onmessageerror=()=>{if(this.worker===worker)this.reset(Error('CADの計算結果を受信できませんでした'));};}
  this.active=id;p.started=Date.now();p.lastStage=null;const worker=this.worker;p.filletGuard=createFilletInspectionGuard(p.payload.spec,()=>this.finishFilletInspection(id,worker),{delay:this.filletTrialTimeout});activity(this,id,p,'started');p.timer=setTimeout(()=>{
   previewTimeoutCache.remember(p.timeoutDocument,p.timeoutKey);
   if(p.precisionPreview){
    rememberSlowPrecisionPreview(p.timeoutDocument,p.payload.spec,Math.max(4000,Date.now()-p.started));
    if(precisionPreviewMode()==='adaptive')waitForPrecisionPreview(this,p.timeoutDocument,p.timeoutKey);
   }
   this.reset(Error('計算が長引いています。寸法や個数を小さくして再実行してください'));
  },p.timeout);try{this.worker.postMessage({...p.payload,id});}catch(e){this.reset(e);}
 }
 request(payload,timeout=90000,onProgress,onTiming,activityFeatures,verification){
  const id=++this.next;return new Promise((resolve,reject)=>{const accept=result=>{try{if(verification)previewResultGuard.accept(verification.features,verification.spec,result);activity(this,id,p,'completed');resolve(result);}catch(cause){const error=cadErrorAdvice(cause,verification?.spec||payload.spec);activity(this,id,p,'error',{error});reject(error);}};const p={resolve:accept,reject,payload,timeout,onProgress,onTiming,activityFeatures,automaticPreview:verification?.automaticPreview,precisionPreview:verification?.precisionPreview,timeoutKey:verification?.timeoutKey,timeoutDocument:verification?.timeoutDocument,timer:null,created:Date.now()};this.pending.set(id,p);activity(this,id,p,'queued');if(this.active!==null)onProgress?.({stage:'現在の計算が終わるのを待っています'});this.dispatch();});
 }
 warmup(){return this.request({type:'warmup'});}
 runLatestExactExtrusion(features,spec,{replaceWaitMs=1500,...options}={}){
  if(spec?.type!=='exactExtrusionPreview')throw Error('距離変更用の押し出しプレビューだけを置き換えられます');
  const result=this.run(features,spec,options),id=this.next;
  // Let short jobs finish and retain their warm engine. A stalled old preview
  // must not block the newest distance until the full CAD timeout expires.
  const timer=setTimeout(()=>{const current=this.pending.get(this.active);if(this.pending.has(id)&&this.active!==id&&current?.payload.spec?.type==='exactExtrusionPreview')this.cancel(this.active);},replaceWaitMs);
  return result.finally(()=>clearTimeout(timer));
 }
 run(features,spec,{onProgress,onTiming,timeout,retry=false,document=features,automaticPreview=false,foreground=false}={}){
  const precisionPreview=!foreground&&isPrecisionPreview(spec,automaticPreview);
  const descriptor=automaticPreview&&!isAutomaticPreview(spec)?{type:'preview',operation:spec}:spec;
  const key=foreground?null:previewTimeoutKey(descriptor);
  const requestInfo={payload:{features,spec},automaticPreview,activityFeatures:features,created:Date.now()};
  const defer=precisionPreview&&precisionPreviewDeferReason(this,document,key,spec);
  if(defer){
   waitForPrecisionPreview(this,document,key);
   const error=Object.assign(Error(defer+'「精密確認」を押すと加工後の形状を計算します。'),{code:'preview-manual'});
   activity(this,++this.next,requestInfo,'deferred',{error});
   return Promise.reject(error);
  }
  if(retry)previewTimeoutCache.clear();
  if(previewTimeoutCache.has(document,key)){
   const error=Object.assign(Error('同じ設定のプレビューは時間上限で中断済みです。設定を変更するか「プレビューを再試行」を押してください。'),{code:'preview-timeout-cached'});
   activity(this,++this.next,requestInfo,'error',{error});
   return Promise.reject(error);
  }
  const maximum=kernelTimeout(features,spec);
  const limit=(spec.type==='machiningValueTrial'||isAutomaticPreview(descriptor))&&Number.isFinite(timeout)&&timeout>0?Math.min(timeout,maximum):maximum;
  return this.request(compactExtrusionRequest(features,spec),limit,onProgress,onTiming,features,{
   features,spec:descriptor,automaticPreview,precisionPreview,timeoutKey:key,timeoutDocument:document
  });
 }
}
export const kernelClient=new KernelClient();
