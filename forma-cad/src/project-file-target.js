// File handles belong to this document only; gallery snapshots cannot identify disk files.
export function createProjectFileTarget({host=globalThis}={}){
 let handle=null,revision=0,busy=false;
 return {
  attach(next=null){handle=next;revision++;},
  get busy(){return busy;},
  async save(createData,{suggestedName='design.forma.json'}={}){
   if(busy)return null;
   if(!handle&&typeof host.showSaveFilePicker!=='function')throw Error('このブラウザーでは直接上書きできません。Chrome / Edgeで開くか「名前を付けて保存」を使ってください。');
   busy=true;const current=revision;let writable=null;
   try{
    const target=handle||await host.showSaveFilePicker({suggestedName,types:[{description:'FORMA CAD 作業データ',accept:{'application/json':['.forma.json']}}],excludeAcceptAllOption:true});
    if(current!==revision)return null;
    if(handle&&target.requestPermission&&await target.requestPermission({mode:'readwrite'})!=='granted')throw Error('ファイルへの書き込みが許可されませんでした。');
    const data=await createData();
    if(current!==revision)return null;
    writable=await target.createWritable();
    if(current!==revision){await writable.abort();writable=null;return null;}
    await writable.write(data.text);
    if(current!==revision){await writable.abort();writable=null;return null;}
    await writable.close();writable=null;
    if(current!==revision)return null;
    handle=target;
    return {...data,name:target.name||suggestedName};
   }catch(error){
    if(writable)try{await writable.abort();}catch{}
    if(error.name==='AbortError')return null;
    throw error;
   }finally{busy=false;}
  }
 };
}
