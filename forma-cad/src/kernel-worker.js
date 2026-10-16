import {importStepBodies} from './step-import.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {setOC} from 'replicad';
import {runOperation} from './kernel.js';
import {PhaseTimings,withPhaseTimings,barrierTimingRequest} from './phase-timings.js';
let ready=null,queue=Promise.resolve();
function initialize(){return ready||(ready=fetch(new URL('replicad_single.wasm',self.location.href)).then(response=>{if(!response.ok)throw Error('CADエンジンを取得できませんでした');return response.arrayBuffer();}).then(wasmBinary=>init({wasmBinary})).then(setOC).catch(e=>{ready=null;throw e;}));}
self.onmessage=({data})=>{queue=queue.then(async()=>{
 let timing;
 try{
  await initialize();
  const compute=()=>data.type==='warmup'?{ready:true}:data.spec?.type==='stepImport'?null:runOperation(data.features,data.spec,progress=>self.postMessage({id:data.id,progress}));
  if(barrierTimingRequest(data.features||[],data.spec))timing=new PhaseTimings();
  const result=data.spec?.type==='stepImport'?await importStepBodies(data.spec):timing?withPhaseTimings(timing,compute):compute();
  self.postMessage({id:data.id,result,...(timing?{timings:timing.report()}:{})});
 }catch(e){
  const details={};for(const key of ['code','diagnostics','featureId','featureIndex','failedOperation'])if(e?.[key]!==undefined)details[key]=e[key];
  self.postMessage({id:data.id,error:typeof e==='number'?'形状計算に失敗しました。寸法や選択を変更してください。':e.message||String(e),details,...(timing?{timings:timing.report()}:{})});
 }
});};
