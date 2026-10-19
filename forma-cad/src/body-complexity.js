import {cadPosition} from './cad-coordinates.js';

const utf8=new TextEncoder();
const operationNames={fillet:'フィレット',chamfer:'面取り',thread:'ねじ',shell:'シェル',join:'結合・切り取り',move:'移動・回転',circular:'円形状パターン',rectangular:'矩形状パターン',extrusion:'押し出し',pipe:'パイプ',coil:'コイル',coilJoint:'コイル接合',qrCode:'QRコード',split:'分離',enclose:'囲み形成',stepImport:'STEP読込'};
export function bodyStorageRecords(features){
 const current=new Map(),history=[];
 for(const [index,feature] of features.entries()){
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null),base={feature,index,operation:operationNames[feature.spec?.type]||feature.name||(feature.kind==='extrusion'?'押し出し':'形状作成')};
  if(result){
   for(const id of result.remove||[])current.delete(id);
   for(const output of result.outputs||[]){const previous=current.get(output.id),record={...base,id:output.id,data:output,output,previous};current.set(output.id,record);history.push(record);}
  }else if(!['sketch','plane','referenceImage'].includes(feature.kind)){
   const id=feature.operation==='new'?feature.id:feature.target;if(!id)continue;
   const record={...base,id,data:feature,output:null,previous:current.get(id)};current.set(id,record);history.push(record);
  }
 }
 return {current,history};
}

export function bodyBufferBytes(mesh){
 const buffers=new Set();let bytes=0;
 const add=value=>{const array=value?.isInterleavedBufferAttribute?value.data.array:value?.array;if(array?.buffer&&!buffers.has(array.buffer)){buffers.add(array.buffer);bytes+=array.buffer.byteLength;}};
 mesh.traverse(object=>{const geometry=object.geometry;if(!geometry)return;for(const attribute of Object.values(geometry.attributes||{}))add(attribute);add(geometry.index);add(cadPosition(geometry));for(const list of Object.values(geometry.morphAttributes||{}))for(const attribute of list)add(attribute);});
 return bytes;
}

export function bodyCadFaceCount(output){
 // BREP already contains the native face definitions. Counting its records
 // avoids deserializing/meshing a heavy screw just to report its complexity.
 if(typeof output?.brep==='string'&&/CASCADE Topology V\d/.test(output.brep.slice(0,160))){let count=0;for(const match of output.brep.matchAll(/^Fa\r?$/gm))count++;return count||null;}
 return null;
}

export function createBodyComplexityAnalyzer(){
 const saved=new WeakMap();
 function storage(record){
  if(!record)return {jsonBytes:0,brepBytes:0,faces:null};
  const signature=Object.entries(record.data),cached=saved.get(record.data);
  if(!cached||signature.length!==cached.signature.length||signature.some(([key,value],i)=>cached.signature[i][0]!==key||cached.signature[i][1]!==value)){
   const json=JSON.stringify(record.data);
   saved.set(record.data,{signature,value:{jsonBytes:utf8.encode(json).byteLength,brepBytes:typeof record.output?.brep==='string'?utf8.encode(record.output.brep).byteLength:0,faces:bodyCadFaceCount(record.output)}});
  }
  return saved.get(record.data).value;
 }
 return {async analyze(features,meshes,{getName=id=>id,shouldCancel=()=>false,onProgress=()=>{},yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
  const {current,history}=bodyStorageRecords(features),historyBytes=new Map(),historyCounts=new Map();let allHistoryBytes=0,lastYield=performance.now();
  const check=()=>{if(shouldCancel())throw new DOMException('集計を中止しました','AbortError');};
  await yieldControl();check();
  for(const [i,record] of history.entries()){
   check();const bytes=storage(record).jsonBytes;allHistoryBytes+=bytes;historyBytes.set(record.id,(historyBytes.get(record.id)||0)+bytes);historyCounts.set(record.id,(historyCounts.get(record.id)||0)+1);
   if(performance.now()-lastYield>8){onProgress({current:i+1,total:history.length,stage:'履歴の保存データ量を集計しています'});await yieldControl();lastYield=performance.now();}
  }
  const rows=[];
  for(const [id,mesh] of meshes){
   check();const record=current.get(id),data=storage(record),position=mesh.geometry.attributes.position;
   const triangles=Math.floor((mesh.geometry.index?.count??position?.count??0)/3),displayBytes=bodyBufferBytes(mesh),previous=record?.previous;
   rows.push({id,name:getName(id),visible:mesh.visible,triangles,vertices:position?.count||0,displayBytes,jsonBytes:record?data.jsonBytes:null,brepBytes:data.brepBytes,faces:data.faces,historyBytes:historyBytes.get(id)||0,historyCount:historyCounts.get(id)||0,operation:record?.operation||'形状データ',featureId:record?.feature.id||null,featureIndex:record?.index??null,deltaBytes:previous?data.jsonBytes-storage(previous).jsonBytes:null,storageKind:record?.output?'output':record?'feature':'unknown'});
   if(performance.now()-lastYield>8){onProgress({current:rows.length,total:meshes.size,stage:'表示用データ量を集計しています'});await yieldControl();lastYield=performance.now();}
  }
  check();const sum=key=>rows.reduce((n,row)=>n+(row[key]||0),0);
  return {rows,totals:{bodies:rows.length,triangles:sum('triangles'),displayBytes:sum('displayBytes'),jsonBytes:sum('jsonBytes'),historyBytes:allHistoryBytes,historyOutputs:history.length}};
 }};
}

export function sortBodyComplexity(rows,key='triangles'){
 return [...rows].sort((a,b)=>key==='name'?a.name.localeCompare(b.name,'ja'):((b[key]??-1)-(a[key]??-1))||a.name.localeCompare(b.name,'ja'));
}
export function formatBodyBytes(bytes){if(bytes===null||bytes===undefined)return '—';if(bytes<1024)return bytes+' B';if(bytes<1024**2)return (bytes/1024).toFixed(1)+' KB';return (bytes/1024**2).toFixed(2)+' MB';}
