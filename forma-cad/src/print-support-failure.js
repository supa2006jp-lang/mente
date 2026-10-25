import {validatePrintSupport} from './print-support.js';
import {currentBodyMeshRecords} from './mesh-quality.js';
const phases=new Set(['preview','export3mf','apply','preflight']);
export function printSupportFailureContext({features,history,input,fields,featureId=null,phase,analysis=null,build='unknown',bodyNames={}}){
 if(!phases.has(phase)||input?.type!=='printSupport')throw Error('サポートの失敗記録が不正です');
 return {features,requestFeatures:history,spec:{...structuredClone(input),preview:true},editing:{stage:'printSupport',bodyNames:structuredClone(bodyNames),support:{version:1,phase,featureId,input:structuredClone(input),fields:structuredClone(fields),analysis:structuredClone(analysis),build:String(build).slice(0,80)}}};
}
export function readPrintSupportFailure(record){
 const saved=record?.editing?.support;
 if(saved?.version!==1||!phases.has(saved.phase)||saved.input?.type!=='printSupport')throw Error('サポートの設定を復元できません');
 const fields={};for(const [key,value]of Object.entries(saved.fields||{}))if(typeof value==='boolean'||typeof value==='string'&&value.length<=1000)fields[key]=value;
 return {...structuredClone(saved),fields};
}
function sameData(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameData(a[key],b[key]));}
export function printSupportFailureFromDocument(doc){
 const failure=doc?.failure;if(!failure?.editing?.support)return null;
 if(doc.format!=='forma-cad'||doc.version!==1||!Array.isArray(doc.features)||doc.features.length>150||!Number.isFinite(failure.createdAt)||failure.createdAt<0||typeof failure.error?.message!=='string'||failure.request?.spec?.type!=='printSupport')throw Error('失敗記録の形式が不正です');
 const saved=readPrintSupportFailure({editing:failure.editing}),input=validatePrintSupport(saved.input);
 let prefix=doc.features;if(saved.featureId!==null){const at=doc.features.findIndex(f=>f.id===saved.featureId&&f.spec?.type==='printSupport');if(at<0)throw Error('失敗時のサポート工程が見つかりません');prefix=doc.features.slice(0,at);}
 if(!Array.isArray(failure.request.features)||!sameData(prefix,failure.request.features))throw Error('失敗時の履歴とモデルが一致しません');
 const bodies=currentBodyMeshRecords(prefix);if(!bodies.has(input.target))throw Error('失敗時の対象ボディが見つかりません');if(typeof input.id!=='string'||!input.id||input.id.length>100||bodies.has(input.id))throw Error('失敗時のサポートIDが不正です');
 return {format:'forma-cad-failure',version:1,id:'file-support-'+failure.createdAt,createdAt:failure.createdAt,document:{format:'forma-cad',version:1,units:'mm',features:structuredClone(doc.features),...(doc.drawing?{drawing:structuredClone(doc.drawing)}:{})},request:structuredClone(failure.request),editing:{...structuredClone(failure.editing),support:saved},error:structuredClone(failure.error)};
}
