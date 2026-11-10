import {importStepBodies} from './step-import.js';
import {inspectStlImport,simplifyStlImport,convertStlImport} from './stl-import.js';
import {meshExtrusionProbe} from './extrusion-mesh-probe.js';
import {meshCombinePreview} from './combine-mesh-preview.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {setOC} from 'replicad';
import {runOperation} from './kernel.js';
import {PhaseTimings,withPhaseTimings,barrierTimingRequest} from './phase-timings.js';
let ready=null,queue=Promise.resolve(),stlSession=null;
function initialize(){return ready||(ready=fetch(new URL('replicad_single.wasm',self.location.href)).then(response=>{if(!response.ok)throw Error('CADエンジンを取得できませんでした');return response.arrayBuffer();}).then(wasmBinary=>init({wasmBinary})).then(setOC).catch(e=>{ready=null;throw e;}));}
self.onmessage=({data})=>{queue=queue.then(async()=>{
 let timing;
 let lastStage;
 function progress(update){
  if(Object.keys(update).length===1&&update.stage===lastStage)return;
  if(update.stage)lastStage=update.stage;
  self.postMessage({id:data.id,progress:update});
 }
 try{
  if(data.spec?.type==='meshExtrusionProbe'){progress({stage:'ソリッドとの重なりを調べています'});self.postMessage({id:data.id,result:meshExtrusionProbe(data.spec)});return;}
  if(data.spec?.type==='meshCombinePreview'){progress({stage:'切り取り・交差の簡易形状を作成しています'});self.postMessage({id:data.id,result:meshCombinePreview(data.spec)});return;}
  if(data.spec?.type==='stlImportInspect'){
   stlSession=null;
   stlSession=inspectStlImport(data.spec,progress);
   self.postMessage({id:data.id,result:stlSession.preview});return;
  }
  if(data.spec?.type==='stlImportSimplify'){
   if(stlSession?.id!==data.spec.session)throw Error('STLを読み直してください');
   self.postMessage({id:data.id,result:await simplifyStlImport(stlSession,data.spec,progress)});return;
  }
  if(!ready)progress({stage:'CADエンジンを準備しています'});
  await initialize();
  if(data.spec?.type==='stlImport'){self.postMessage({id:data.id,result:convertStlImport(stlSession,data.spec,progress)});return;}
  progress({stage:'モデルの形状を準備しています'});
  const compute=()=>data.type==='warmup'?{ready:true}:data.spec?.type==='stepImport'?null:runOperation(data.features,data.spec,progress);
  const reportTimings=barrierTimingRequest(data.features||[],data.spec);
  const phases=new PhaseTimings(undefined,stage=>progress({stage:stage+'中…'}));
  if(reportTimings)timing=phases;
  const result=data.spec?.type==='stepImport'?await importStepBodies(data.spec):withPhaseTimings(phases,compute);
  self.postMessage({id:data.id,result,...(timing?{timings:timing.report()}:{})});
 }catch(e){
  const details={};for(const key of ['code','diagnostics','featureId','featureIndex','failedOperation','supportClearanceRegions','supportCoverage'])if(e?.[key]!==undefined)details[key]=e[key];
  self.postMessage({id:data.id,error:typeof e==='number'?'形状計算に失敗しました。寸法や選択を変更してください。':e.message||String(e),details,...(timing?{timings:timing.report()}:{})});
 }
});};
