export const projectLibraryDatabase='forma-cad-project-library-v1';
export function createProjectLibraryStore({indexedDB=globalThis.indexedDB}={}){
 let pending=null;
 function database(){
  if(!pending)pending=new Promise((resolve,reject)=>{
   if(!indexedDB){reject(Error('ブラウザーの保存領域を使用できません'));return;}
   const request=indexedDB.open(projectLibraryDatabase,1);
   request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('entries',{keyPath:'id'});db.createObjectStore('projects',{keyPath:'id'});};
   request.onerror=()=>reject(request.error||Error('保存領域を開けません'));
   request.onblocked=()=>reject(Error('別のタブを閉じてから再度開いてください'));
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();pending=null;};resolve(db);};
  }).catch(error=>{pending=null;throw error;});
  return pending;
 }
 async function transaction(names,mode,operation){
  const db=await database(),tx=db.transaction(names,mode);
  const complete=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('一覧の保存に失敗しました'));tx.onerror=()=>{};});
  let request;try{request=operation(tx);}catch(error){tx.abort();await complete.catch(()=>{});throw error;}
  const result=request?new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}):Promise.resolve();
  const [value]=await Promise.all([result,complete]);return value;
 }
 return {
  list:()=>transaction(['entries'],'readonly',tx=>tx.objectStore('entries').getAll()),
  read:id=>transaction(['projects'],'readonly',tx=>tx.objectStore('projects').get(id)).then(item=>item?.text??null),
  write:(entry,text,{replaceId}={})=>transaction(['entries','projects'],'readwrite',tx=>{tx.objectStore('projects').put({id:entry.id,text});tx.objectStore('entries').put(entry);if(replaceId&&replaceId!==entry.id){tx.objectStore('projects').delete(replaceId);tx.objectStore('entries').delete(replaceId);}}),
  remove:id=>transaction(['entries','projects'],'readwrite',tx=>{tx.objectStore('entries').delete(id);tx.objectStore('projects').delete(id);})
 };
}
export async function projectLibraryEntry({name,text,preview,featureCount,savedAt=Date.now(),relativePath=''}){
 const bytes=new TextEncoder().encode(name+'\0'+text),hash=await crypto.subtle.digest('SHA-256',bytes);
 const id=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
 return {id,name,preview,featureCount,savedAt,relativePath,bytes:new Blob([text]).size};
}
