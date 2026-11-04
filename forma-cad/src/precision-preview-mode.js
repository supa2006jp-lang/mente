import {extrusionProfileLoad} from './extrusion-profile-load.js';

const modeKey='forma-precision-preview-mode';
const oldModeKey='forma-automatic-precision-preview';
const modes=new Set(['automatic','adaptive','manual']);
let mode='automatic';
try {
 const saved=globalThis.localStorage?.getItem(modeKey);
 if(modes.has(saved))mode=saved;
 else if(globalThis.localStorage?.getItem(oldModeKey)==='false')mode='manual';
} catch {}

const listeners=new Set(),waiting=new Map(),slowOperations=new WeakMap();
let permitted=new WeakMap();
const changed=()=>{for(const listener of listeners)listener();};

export function precisionPreviewMode(){return mode;}
export function isPrecisionPreview(spec,explicitAutomatic=false){
 if(spec?.type==='preview'&&spec.operation?.type==='coilTestPiece')return false;
 return explicitAutomatic||spec?.type==='preview'||spec?.preview===true||
  ['exactExtrusionPreview','extrusionToolPreview','barrierPreparedPreview','meshCombinePreview'].includes(spec?.type);
}

function operationKind(spec){
 const operation=spec?.type==='preview'?spec.operation:spec;
 if(['exactExtrusionPreview','extrusionToolPreview','barrierPreparedPreview','extrusion','extrusionBatch'].includes(operation?.type)){
  const batch=operation.features||[operation.feature];
  return batch.some(feature=>feature?.operation==='cut')?'extrusion:cut':
   batch.some(feature=>feature?.operation==='join')?'extrusion:join':'extrusion:new';
 }
 if(['join','meshCombinePreview'].includes(operation?.type))return 'join:'+(operation.combineMode||operation.mode||'');
 return operation?.type;
}

export function rememberSlowPrecisionPreview(document,spec,elapsedMs){
 if(!document||elapsedMs<4000)return;
 const kind=operationKind(spec);
 if(!kind)return;
 let kinds=slowOperations.get(document);
 if(!kinds)slowOperations.set(document,kinds=new Set());
 kinds.add(kind);
}

function adaptiveReason(document,spec){
 if(slowOperations.get(document)?.has(operationKind(spec)))return 'このモデルでは前回の精密計算に時間がかかりました。';
 const operation=spec.type==='preview'?spec.operation:spec;
 if(operationKind(spec)!=='extrusion:cut')return '';
 const regions=(operation.features||[operation.feature]).filter(f=>f?.operation==='cut').map(f=>f.region)
  .filter(r=>Array.isArray(r?.outer)&&Array.isArray(r.holes));
 const points=regions.reduce((sum,r)=>sum+r.outer.length+r.holes.reduce((n,ring)=>n+ring.length,0),0);
 if(points<80)return '';
 try {
  if(extrusionProfileLoad(regions,document).reduce((sum,r)=>sum+r.edges,0)>=80)return '切り取る輪郭の辺が多いため、簡易表示に切り替えました。';
 } catch {
  if(points>=200)return '切り取る輪郭の点が多いため、簡易表示に切り替えました。';
 }
 return '';
}

export function precisionPreviewDeferReason(client,document,key,spec){
 const entry=permitted.get(client);
 const authorized=entry?.document===document&&entry.key===key;
 if(!authorized)permitted.delete(client);
 const reason=authorized?'':mode==='manual'?'簡易表示中です。':mode==='adaptive'?adaptiveReason(document,spec):'';
 if(!reason&&waiting.delete(client))changed();
 return reason;
}
export function waitForPrecisionPreview(client,document,key){waiting.set(client,{document,key});changed();}
export function precisionPreviewWaiting(){return waiting.size>0;}
export function authorizePrecisionPreview(){
 for(const [client,entry] of waiting)permitted.set(client,entry);
 waiting.clear();
 changed();
}
export function clearPrecisionPreviewRequests(){waiting.clear();permitted=new WeakMap();changed();}
export function setPrecisionPreviewMode(value){
 if(!modes.has(value))return;
 mode=value;
 try{globalThis.localStorage?.setItem(modeKey,value);}catch{}
 clearPrecisionPreviewRequests();
}
export function setPrecisionPreviewAutomatic(value){setPrecisionPreviewMode(value?'automatic':'manual');}
export function subscribePrecisionPreviewMode(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
