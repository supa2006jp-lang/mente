const phases=new Set(['preview','export3mf','apply']);
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
