// Requests run one at a time. A queued request cannot time out an active CAD job.
export function kernelTimeout(features,spec){
 const operation=spec.type==='preview'?spec.operation:spec;
 const coil=['coilJoint','coilTestPiece'].includes(operation?.type)||spec.type==='replay'&&features.slice(spec.start||0).some(f=>f.spec?.type==='coilJoint');
 return coil?600000:['pull','stepImport'].includes(operation?.type)?300000:90000;
}
export class KernelClient {
 constructor(factory=()=>new Worker(new URL('kernel-worker.js',location.href),{type:'module'})){this.factory=factory;this.worker=null;this.pending=new Map();this.next=0;this.active=null;}
 reset(error=new Error('計算をキャンセルしました')){this.worker?.terminate();this.worker=null;this.active=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
 cancelPreviews(){if(this.pending.get(this.active)?.payload.spec?.type==='preview'){this.reset();return;}for(const [id,p] of this.pending)if(p.payload.spec?.type==='preview'){clearTimeout(p.timer);this.pending.delete(id);p.reject(new Error('計算をキャンセルしました'));}}
 cancelQueuedExtrusions(){for(const [id,p] of this.pending)if(id!==this.active&&(p.payload.spec?.type==='extrusionToolPreview'||p.payload.spec?.type==='preview'&&p.payload.spec.operation?.type==='extrusion')){this.pending.delete(id);p.reject(new Error('計算をキャンセルしました'));}}
 dispatch(){
  if(this.active!==null)return;const entry=this.pending.entries().next().value;if(!entry)return;const [id,p]=entry;
  if(!this.worker){let worker;try{worker=this.factory();}catch(e){this.reset(e);return;}this.worker=worker;worker.onmessage=({data})=>{const pending=this.pending.get(data.id);if(!pending)return;if(data.progress){pending.onProgress?.(data.progress);return;}clearTimeout(pending.timer);this.pending.delete(data.id);this.active=null;data.error?pending.reject(Error(data.error)):pending.resolve(data.result);this.dispatch();};worker.onerror=e=>this.reset(Error(e.message||'CADエンジンを起動できませんでした'));worker.onmessageerror=()=>this.reset(Error('CADの計算結果を受信できませんでした'));}
  this.active=id;p.timer=setTimeout(()=>this.reset(Error('計算が長引いています。寸法や個数を小さくして再実行してください')),p.timeout);try{this.worker.postMessage({...p.payload,id});}catch(e){this.reset(e);}
 }
 request(payload,timeout=90000,onProgress){
  const id=++this.next;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,payload,timeout,onProgress,timer:null});if(this.active!==null)onProgress?.({stage:'現在の計算が終わるのを待っています'});this.dispatch();});
 }
 warmup(){return this.request({type:'warmup'});}
 run(features,spec,{onProgress}={}){if(spec.type==='extrusionBatch')features=features.map(f=>{const slim=r=>({...r,outputs:r.outputs.map(({id,brep})=>({id,brep}))});return f.kind==='cadop'?slim(f):f.cadResult?{...f,cadResult:slim(f.cadResult)}:f;});return this.request({features,spec},kernelTimeout(features,spec),onProgress);}
}
export const kernelClient=new KernelClient();
