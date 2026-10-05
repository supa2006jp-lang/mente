import {previewImageSource} from './project-preview.js';
import {createProjectLibraryStore,projectLibraryEntry} from './project-library-store.js';

export function createProjectLibrary({parse,onChoose,getRevision,getModified,store=createProjectLibraryStore()}){
 const dialog=document.createElement('dialog');dialog.id='project-library';dialog.setAttribute('aria-labelledby','project-library-title');
 dialog.innerHTML='<div class="dialog-heading"><h2 id="project-library-title">画像を見てファイルを開く</h2><button type="button" id="project-library-close" aria-label="閉じる">×</button></div><p class="project-library-hint">これから保存するデータは自動で一覧に残ります。以前の保存ファイルは、ファイルやフォルダーを選んで追加してください。一覧はこのブラウザーに保存されます。</p><div class="project-library-toolbar"><button type="button" id="project-library-add">ファイルを追加</button><button type="button" id="project-library-folder">保存フォルダーを選ぶ</button><label>名前で検索<input id="project-library-search" type="search" placeholder="ファイル名を入力"></label><label>並び順<select id="project-library-sort"><option value="new">新しい順</option><option value="name">名前順</option></select></label></div><input id="project-library-files" type="file" accept=".json,.forma" multiple hidden><input id="project-library-directory" type="file" webkitdirectory multiple hidden><p id="project-library-status" role="status" aria-live="polite"></p><p id="project-library-warning" hidden>未保存の変更があります。ファイルを選んだ後の確認画面で「このファイルを開く」を押すと置き換わります。</p><div id="project-library-grid"></div><p id="project-library-empty">まだファイルがありません。「ファイルを追加」か「保存フォルダーを選ぶ」で以前の保存データを選んでください。</p>';
 document.body.append(dialog);const $=id=>dialog.querySelector('#project-library-'+id);let revision=0,entries=new Map(),busy=false;const memory=new Map();
 function status(text){$('status').textContent=text;}
 function controls(){for(const id of ['add','folder'])$(id).disabled=busy;}
 function render(){
  const query=$('search').value.trim().toLocaleLowerCase(),items=[...entries.values()].filter(e=>e.name.toLocaleLowerCase().includes(query));
  items.sort($('sort').value==='name'?(a,b)=>a.name.localeCompare(b.name,'ja')||b.savedAt-a.savedAt:(a,b)=>b.savedAt-a.savedAt||a.name.localeCompare(b.name,'ja'));
  $('grid').replaceChildren();$('empty').hidden=!!items.length;$('empty').textContent=entries.size?'一致するファイルがありません。検索する名前を変えてください。':'まだファイルがありません。「ファイルを追加」か「保存フォルダーを選ぶ」で以前の保存データを選んでください。';
  for(const entry of items){
   const card=document.createElement('article');card.className='project-library-card';card.dataset.projectId=entry.id;
   const open=document.createElement('button');open.type='button';open.className='project-library-open';open.setAttribute('aria-label',entry.name+' を確認して開く');
   const picture=document.createElement('span');picture.className='project-library-picture';const src=previewImageSource(entry.preview);
   const placeholder=()=>{picture.replaceChildren();const text=document.createElement('span');text.textContent='画像なし';picture.append(text);};
   if(src){const img=document.createElement('img');img.src=src;img.alt=entry.name+' の保存画像';img.loading='lazy';img.onerror=placeholder;picture.append(img);}else placeholder();
   const name=document.createElement('strong');name.className='project-library-name';name.textContent=entry.name;
   const details=document.createElement('span');details.className='project-library-details';details.textContent=new Date(entry.savedAt).toLocaleString('ja-JP')+' · 工程 '+entry.featureCount+' 件';
   if(entry.relativePath){details.title=entry.relativePath;}
   open.append(picture,name,details);open.onclick=()=>choose(entry,open);
   const remove=document.createElement('button');remove.type='button';remove.className='project-library-remove';remove.textContent='一覧から外す';remove.setAttribute('aria-label',entry.name+' を一覧から外す');remove.title='保存ファイルは削除しません';remove.onclick=async()=>{if(busy)return;try{const temporary=memory.has(entry.id);if(!temporary)await store.remove(entry.id);memory.delete(entry.id);entries.delete(entry.id);render();status('一覧から外しました。保存ファイルはそのままです。');}catch{status('一覧から外せませんでした。再度お試しください。');}};
   card.append(open,remove);$('grid').append(card);
  }
 }
 async function choose(entry,button){
  if(busy)return;const current=revision,request=getRevision();button.disabled=true;busy=true;controls();
  try{const text=memory.get(entry.id)??await store.read(entry.id);if(current!==revision||!dialog.open||request!==getRevision())return;if(text===null)throw Error('作業データが見つかりません。保存ファイルを追加し直してください');const data=parse(text);dialog.close();onChoose({file:{name:entry.name,size:entry.bytes},...data,modified:getModified(),request});}
  catch(error){if(current===revision&&dialog.open)status('読み込みできません：'+error.message);}
  finally{if(current===revision){busy=false;button.disabled=false;controls();}}
 }
 async function register({name,text,data,savedAt,relativePath},keepMemory=false){
  const entry=await projectLibraryEntry({name,text,preview:data.preview,featureCount:data.next.length,savedAt,relativePath});
  try{await store.write(entry,text);memory.delete(entry.id);}catch(error){if(!keepMemory)throw error;memory.set(entry.id,text);entries.set(entry.id,entry);return {entry,persisted:false};}
  entries.set(entry.id,entry);return {entry,persisted:true};
 }
 async function importFiles(files){
  const current=revision,request=getRevision(),selected=[...files].filter(f=>/\.(json|forma)$/i.test(f.name));let loaded=0,failed=0,temporary=0;
  busy=true;controls();
  try{
   for(const file of selected){
    if(current!==revision||!dialog.open||request!==getRevision())return;
    status('ファイルを確認中… '+(loaded+failed+1)+' / '+selected.length);
    try{if(file.size>80_000_000)throw Error('80 MBを超えています');const text=await file.text();if(current!==revision||!dialog.open||request!==getRevision())return;const data=parse(text);const item=await register({name:file.name,text,data,savedAt:file.lastModified||Date.now(),relativePath:file.webkitRelativePath||''},true);loaded++;if(!item.persisted)temporary++;}
    catch{failed++;}
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(current===revision&&dialog.open){render();status(loaded+' 件を追加しました'+(failed?'。対応しないファイル・壊れたデータなど '+failed+' 件は追加できませんでした':'')+(temporary?'。'+temporary+' 件はブラウザーに保存できないため、再読み込みまでの一時表示になります':'')+(!selected.length?'。FORMA CADの .json ファイルを選んでください':''));}
  }finally{if(current===revision){busy=false;controls();}}
 }
 $('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{revision++;busy=false;controls();});
 $('search').oninput=$('sort').onchange=render;
 $('add').onclick=()=>$('files').click();$('folder').onclick=()=>$('directory').click();
 for(const id of ['files','directory'])$(id).onchange=()=>{const files=[...$(id).files];$(id).value='';if(files.length)importFiles(files);};
 return {
  async open(){if(dialog.open)return;const current=++revision;busy=false;controls();$('warning').hidden=!getModified();status('保存履歴を読み込み中…');render();dialog.showModal();try{const saved=await store.list();if(current!==revision||!dialog.open)return;entries=new Map([...entries].filter(([id])=>memory.has(id)));for(const entry of saved)entries.set(entry.id,entry);render();status(entries.size+' 件。画像をクリックすると内容を確認して開けます。');}catch{if(current===revision&&dialog.open)status('保存履歴を読み込めません。ファイルを追加すると画像を確認して開けます。');}},
  async remember({name,text,data}){await register({name,text,data});if(dialog.open)render();},
  cancel(){if(dialog.open)dialog.close();}
 };
}
