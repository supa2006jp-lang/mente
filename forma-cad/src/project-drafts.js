import {createProjectLibraryStore} from './project-library-store.js';
import {encodeProjectDocument} from './project-codec.js';

export function installProjectDrafts({anchor,getSnapshot,restore,notify}){
 const store=createProjectLibraryStore({databaseName:'forma-cad-project-drafts-v1'});
 const button=document.createElement('button');
 button.id='project-draft-open';button.type='button';button.textContent='前回の作業を復元';button.hidden=true;
 const indicator=document.createElement('small');
 indicator.id='project-draft-status';indicator.hidden=true;
 anchor.after(indicator,button);
 const dialog=document.createElement('dialog');
 dialog.id='project-draft-dialog';
 dialog.style.cssText='width:min(510px,90vw);max-height:80vh;overflow:auto';
 dialog.innerHTML='<h3>前回の作業を復元</h3><p>このブラウザーに自動保存した下書きです。</p><p data-status role="status"></p><div data-list></div><button type="button" data-close>閉じる</button>';
 document.body.append(dialog);
 const list=dialog.querySelector('[data-list]'),status=dialog.querySelector('[data-status]');
 let id=crypto.randomUUID(),replaceId=null,latest=null,last=null,timer=null,queue=Promise.resolve(),restoring=false;

 async function refresh(){
  const rows=(await store.list()).filter(row=>row.id!==id).sort((a,b)=>b.savedAt-a.savedAt);
  button.hidden=!rows.length;
  list.replaceChildren();
  for(const entry of rows){
   const item=document.createElement('article');
   const title=document.createElement('p');
   title.textContent=entry.name+' ／ '+entry.featureCount+'工程 ／ '+new Date(entry.savedAt).toLocaleString('ja-JP');
   const load=document.createElement('button'),remove=document.createElement('button');
   load.type=remove.type='button';load.textContent='この作業を復元';remove.textContent='破棄';
   load.onclick=async()=>{
    if(restoring)return;
    restoring=true;load.disabled=remove.disabled=true;
    try{
     const text=await store.read(entry.id);
     if(!text)throw Error('下書きが見つかりません');
     await restore(entry,text,()=>dialog.open);
     dialog.close();notify('下書きから作業を復元しました');
    }catch(error){status.textContent=error.message;}
    finally{restoring=false;load.disabled=remove.disabled=false;}
   };
   remove.onclick=async()=>{
    if(restoring||!window.confirm('この下書きを破棄しますか？'))return;
    try{await store.remove(entry.id);await refresh();}catch(error){status.textContent=error.message;}
   };
   item.append(title,load,remove);list.append(item);
  }
  if(!rows.length)list.textContent='復元できる下書きはありません。';
 }

 function enqueue(work){queue=queue.catch(()=>{}).then(work);return queue;}
 function flush(){
  clearTimeout(timer);timer=null;
  if(!latest)return;
  const snapshot=latest;
  latest=null;
  enqueue(async()=>{
   const {document,name,compressed,id:entryId,replaceId}=snapshot;
   const encoded=await encodeProjectDocument(document,{compress:true});
   await store.write({id:entryId,name,compressed,savedAt:snapshot.savedAt,featureCount:document.features.length,bytes:encoded.bytes},encoded.text,{replaceId});
   if(last?.snapshot===snapshot){
    indicator.hidden=false;
    indicator.textContent='下書き保存済み';
    indicator.title=new Date(snapshot.savedAt).toLocaleString('ja-JP');
   }
   const older=(await store.list()).sort((a,b)=>b.savedAt-a.savedAt).slice(5);
   for(const row of older)await store.remove(row.id);
  }).catch(error=>{
   status.textContent='下書きを保存できません：'+error.message;
   if(last?.snapshot===snapshot){last=null;indicator.hidden=false;indicator.textContent='下書き保存失敗';indicator.title=error.message;}
  });
 }
 function observe(){
  const next=getSnapshot();
  if(!next){
   clearTimeout(timer);timer=null;latest=null;last=null;
   indicator.hidden=true;
   return;
  }
  const key=JSON.stringify([next.document.drawing,next.document.measurements,next.name]);
  if(last?.id===id&&last.features===next.document.features&&last.values===next.document.namedDimensions&&last.key===key)return;
  latest={...next,id,replaceId,savedAt:Date.now()};
  last={id,features:next.document.features,values:next.document.namedDimensions,key,snapshot:latest};
  indicator.hidden=false;
  indicator.textContent='下書き保存中…';
  indicator.removeAttribute('title');
  clearTimeout(timer);
  timer=setTimeout(flush,700);
 }
 function leave(previousId=null){
  flush();
  id=crypto.randomUUID();replaceId=previousId;indicator.hidden=true;
  queue.then(refresh).catch(()=>{});
 }
 function saved(){
  clearTimeout(timer);timer=null;latest=null;last=null;
  indicator.hidden=true;
  const current=id,previous=replaceId;
  replaceId=null;
  enqueue(async()=>{
   await store.remove(current);
   if(previous)await store.remove(previous);
   await refresh();
  }).catch(()=>{});
 }
 button.onclick=async()=>{
  try{await refresh();status.textContent='';dialog.showModal();}
  catch(error){notify(error.message);}
 };
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
 window.addEventListener('pagehide',flush);
 refresh().catch(()=>{});
 return {observe,leave,saved};
}
