export function createFailureRecoveryStore({indexedDB=globalThis.indexedDB,maxEntries=3,maxBytes=80*1024*1024}={}){
 let pending;
 async function database(){return pending||(pending=new Promise((resolve,reject)=>{if(!indexedDB){reject(Error('ブラウザーの保存領域を使用できません'));return;}const request=indexedDB.open('forma-cad-failure-recovery-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('保存領域を開けません'));request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();pending=null;};resolve(db);};}).catch(error=>{pending=null;throw error;}));}
 async function transaction(mode,operation){const db=await database(),tx=db.transaction('records',mode),store=tx.objectStore('records');return new Promise((resolve,reject)=>{let result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('記録を保存できませんでした'));tx.onerror=()=>{};const fail=error=>{try{tx.abort();}catch{}reject(error);};try{operation(store,value=>{result=value;},fail);}catch(error){fail(error);}});}
 return {
  async write(record){const text=JSON.stringify(record),bytes=new Blob([text]).size;if(bytes>maxBytes)throw Error('記録が保存上限を超えています。ファイルに保存できます');return transaction('readwrite',(store,done,fail)=>{const request=store.getAll();request.onsuccess=()=>{try{const old=request.result.filter(row=>row.id!==record.id).sort((a,b)=>b.createdAt-a.createdAt);let total=bytes,kept=0;for(const row of old){if(kept>=maxEntries-1||total+row.bytes>maxBytes)store.delete(row.id);else{total+=row.bytes;kept++;}}store.put({id:record.id,createdAt:record.createdAt,bytes,text});done(record.id);}catch(error){fail(error);}};});},
  list:()=>transaction('readonly',(store,done)=>{const request=store.getAll();request.onsuccess=()=>done(request.result.sort((a,b)=>b.createdAt-a.createdAt).map(({text,...row})=>({...row,record:JSON.parse(text)})));}),
  remove:id=>transaction('readwrite',(store,done)=>{store.delete(id);done(true);})
 };
}

export function failureRecord({features,spec,requestFeatures=features,editing=null,drawing=null,error,now=Date.now(),id=crypto.randomUUID()}){
 return {format:'forma-cad-failure',version:1,id,createdAt:now,document:{format:'forma-cad',version:1,units:'mm',features:structuredClone(features),...(drawing?{drawing:structuredClone(drawing)}:{})},request:{features:structuredClone(requestFeatures),spec:structuredClone(spec)},editing:structuredClone(editing),error:{message:error?.message||String(error),...(error?.name?{name:error.name}:{}),...(error?.rawMessage?{rawMessage:error.rawMessage}:{}),...(error?.code?{code:error.code}:{}),...(error?.featureId?{featureId:error.featureId}:{}),...(error?.diagnostics?{diagnostics:structuredClone(error.diagnostics)}:{})}};
}

export function failureDocument(record){
 return {...structuredClone(record.document),failure:{createdAt:record.createdAt,error:structuredClone(record.error),request:structuredClone(record.request),editing:structuredClone(record.editing)}};
}
