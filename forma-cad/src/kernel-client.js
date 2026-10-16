import {cadErrorAdvice} from './cad-error-advice.js';
import {compactExtrusionRequest} from './kernel-transfer.js';
const activityListeners=new Set();
export function subscribeKernelActivity(listener){activityListeners.add(listener);return ()=>activityListeners.delete(listener);}
function activity(client,id,p,state,extra={}){for(const listener of activityListeners)try{listener({client,id,state,spec:p.payload.spec,features:p.activityFeatures||p.payload.features||[],started:p.started,created:p.created,...extra});}catch(error){console.warn('計算状況の表示を更新できませんでした',error);}}
export function freshSvgEngine(features,spec){const operation=spec?.type==='preview'?spec.operation:spec;return operation?.type==='svgWrap'||spec?.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='svgWrap');}
const fatalKernelError=message=>/indirect call to null|null function|memory access out of bounds|unreachable|table index|function signature mismatch|aborted|RuntimeError/i.test(message||'');
// Requests run one at a time. A queued request cannot time out an active CAD job.
export function kernelTimeout(features,spec){
 const operation=spec.type==='preview'?spec.operation:spec;
 const coil=['coilJoint','coilTestPiece'].includes(operation?.type)||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='coilJoint');
 const svgWrap=operation?.type==='svgWrap'||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='svgWrap');
 const join=operation?.type==='join'||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='join');
 return coil?600000:svgWrap||join?300000:['pull','stepImport'].includes(operation?.type)?300000:90000;
}
export class KernelClient {
 constructor(factory=()=>{const url=new URL('kernel-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;return new Worker(url,{type:'module'});}){this.factory=factory;this.worker=null;this.pending=new Map();this.next=0;this.active=null;}
 reset(error=new Error('計算をキャンセルしました')){this.worker?.terminate();this.worker=null;this.active=null;for(const [id,p] of this.pending){clearTimeout(p.timer);const formatted=cadErrorAdvice(error,p.payload.spec);activity(this,id,p,formatted.code==='cancelled'?'cancelled':'error',{error:formatted});p.reject(formatted);}this.pending.clear();}
 cancel(id){const p=this.pending.get(id);if(!p)return;clearTimeout(p.timer);this.pending.delete(id);if(this.active===id){this.worker?.terminate();this.worker=null;this.active=null;}const error=cadErrorAdvice('計算をキャンセルしました',p.payload.spec);activity(this,id,p,'cancelled',{error});p.reject(error);this.dispatch();}
 cancelPreviews(){for(const [id,p] of [...this.pending])if(p.payload.spec?.type==='preview')this.cancel(id);}
 cancelExtrusionPreviews(){for(const [id,p] of [...this.pending])if(p.payload.spec?.type==='extrusionToolPreview'||p.payload.spec?.type==='barrierPreparedPreview'||p.payload.spec?.type==='preview'&&p.payload.spec.operation?.type==='extrusion')this.cancel(id);}
 cancelQueuedExtrusions(){for(const [id,p] of [...this.pending])if(id!==this.active&&(p.payload.spec?.type==='extrusionToolPreview'||p.payload.spec?.type==='barrierPreparedPreview'||p.payload.spec?.type==='preview'&&p.payload.spec.operation?.type==='extrusion'))this.cancel(id);}
 dispatch(){
  if(this.active!==null)return;const entry=this.pending.entries().next().value;if(!entry)return;const [id,p]=entry;
  if(freshSvgEngine(p.payload.features||[],p.payload.spec)&&this.worker){this.worker.terminate();this.worker=null;}
  if(!this.worker){let worker;try{worker=this.factory();}catch(e){this.reset(e);return;}this.worker=worker;worker.onmessage=({data})=>{if(this.worker!==worker)return;const pending=this.pending.get(data.id);if(!pending)return;if(data.progress){activity(this,data.id,pending,'progress',{progress:data.progress});pending.onProgress?.(data.progress);return;}clearTimeout(pending.timer);if(data.timings){try{pending.onTiming?.(data.timings);}catch(error){console.warn('計算時間を表示できませんでした',error);}}if(data.error&&fatalKernelError(data.error)){this.worker?.terminate();this.worker=null;this.active=null;if(!pending.retried){pending.retried=true;pending.onProgress?.({stage:'計算エンジンを再起動しています',current:0,total:1});this.dispatch();return;}}this.pending.delete(data.id);this.active=null;if(data.error){const error=cadErrorAdvice(Object.assign(new Error(data.error),data.details||{}),pending.payload.spec);activity(this,data.id,pending,'error',{error});pending.reject(error);}else{activity(this,data.id,pending,'completed');pending.resolve(data.result);}this.dispatch();};worker.onerror=e=>{if(this.worker===worker)this.reset(Error(e.message||'CADエンジンを起動できませんでした'));};worker.onmessageerror=()=>{if(this.worker===worker)this.reset(Error('CADの計算結果を受信できませんでした'));};}
  this.active=id;p.started=Date.now();activity(this,id,p,'started');p.timer=setTimeout(()=>this.reset(Error('計算が長引いています。寸法や個数を小さくして再実行してください')),p.timeout);try{this.worker.postMessage({...p.payload,id});}catch(e){this.reset(e);}
 }
 request(payload,timeout=90000,onProgress,onTiming,activityFeatures){
  const id=++this.next;return new Promise((resolve,reject)=>{const p={resolve,reject,payload,timeout,onProgress,onTiming,activityFeatures,timer:null,created:Date.now()};this.pending.set(id,p);activity(this,id,p,'queued');if(this.active!==null)onProgress?.({stage:'現在の計算が終わるのを待っています'});this.dispatch();});
 }
 warmup(){return this.request({type:'warmup'});}
 run(features,spec,{onProgress,onTiming}={}){return this.request(compactExtrusionRequest(features,spec),kernelTimeout(features,spec),onProgress,onTiming,features);}
}
export const kernelClient=new KernelClient();
