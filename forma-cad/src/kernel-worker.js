import {importStepBodies} from './step-import.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {setOC} from 'replicad';
import {runOperation} from './kernel.js';
let ready=null,queue=Promise.resolve();
function initialize(){return ready||(ready=fetch(new URL('replicad_single.wasm',self.location.href)).then(response=>{if(!response.ok)throw Error('CADエンジンを取得できませんでした');return response.arrayBuffer();}).then(wasmBinary=>init({wasmBinary})).then(setOC).catch(e=>{ready=null;throw e;}));}
self.onmessage=({data})=>{queue=queue.then(async()=>{try{await initialize();const result=data.type==='warmup'?{ready:true}:data.spec?.type==='stepImport'?await importStepBodies(data.spec):runOperation(data.features,data.spec,progress=>self.postMessage({id:data.id,progress}));self.postMessage({id:data.id,result});}catch(e){self.postMessage({id:data.id,error:typeof e==='number'?'形状計算に失敗しました。寸法や選択を変更してください。':e.message||String(e)});}});};
