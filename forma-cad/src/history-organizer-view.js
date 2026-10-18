import {historyCatalog,filterHistory,historyBuckets,historyGroupName} from './history-organizer.js';
import {draggableDialog} from './draggable-dialog.js';

export function createHistoryOrganizer({timeline,container,getFeatures,getBodies,canModify,onApply,onSelect}){
 const button=document.createElement('button');button.type='button';button.id='history-organizer-open';button.textContent='検索・整理';button.title='履歴をボディ・加工種類で検索し、グループに整理';timeline.querySelector('.timeline-label').after(button);
 const count=document.createElement('span');count.id='history-visible-count';count.hidden=true;button.after(count);
 const dialog=document.createElement('dialog');dialog.id='history-organizer-dialog';dialog.setAttribute('aria-labelledby','history-organizer-title');
 dialog.innerHTML='<div class="dialog-heading"><h2 id="history-organizer-title">履歴の検索・整理</h2><button type="button" id="history-organizer-close" aria-label="履歴の検索・整理を閉じる">×</button></div><div class="history-organizer-filters"><label>キーワード<input id="history-query" type="search" placeholder="工程名・ボディ名・加工名" autocomplete="off"></label><label>ボディ<select id="history-body"></select></label><label>加工種類<select id="history-type"></select></label><label>グループ<select id="history-group-filter"></select></label></div><div class="history-organizer-actions"><button type="button" id="history-clear-filters">絞り込みを解除</button><button type="button" id="history-select-visible">表示中を選択</button><button type="button" id="history-clear-selection">選択解除</button><button type="button" id="history-collapse-all">グループを折りたたむ</button><button type="button" id="history-expand-all">すべて展開</button></div><p id="history-organizer-count" role="status"></p><div id="history-organizer-list"></div><div class="history-group-editor"><label>グループ名<input id="history-group-name" maxlength="60" autocomplete="off" placeholder="新しい名前、または既存のグループ名"></label><div class="history-organizer-actions"><button type="button" id="history-assign-group">選択をグループ化</button><button type="button" id="history-remove-group">選択をグループから外す</button><button type="button" id="history-rename-group">絞り込み中のグループ名を変更</button></div></div><p class="history-organizer-hint">同じスケッチの線はまとめて選択されます。グループ分けは表示の整理だけです。工程番号・計算順は変わりません。グループ名は作業データに保存され、元に戻す・やり直しにも対応します。</p><p id="history-organizer-error" role="status"></p>';
 document.body.append(dialog);draggableDialog(dialog);
 const style=document.createElement('style');style.textContent='#history-organizer-open{padding:5px 8px;font-size:12px;white-space:nowrap}#history-visible-count{font-size:11px;white-space:nowrap;color:#9cbed0}.history-group{display:flex;align-items:center;gap:4px;flex-shrink:0;border:1px solid #5693ac;border-radius:6px;padding:3px}.history-group-summary{font-size:12px;padding:6px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.history-group-members{display:flex;gap:4px}.history-group-members[hidden]{display:none}#history-organizer-dialog{width:min(720px,calc(100vw - 32px));box-sizing:border-box;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;z-index:104}#history-organizer-dialog .dialog-heading{margin-bottom:10px}#history-organizer-dialog h2{font-size:18px;margin:0}#history-organizer-dialog .history-organizer-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px}#history-organizer-dialog label{margin:0;min-width:0;display:flex;flex-direction:column;gap:4px;font-size:12px}#history-organizer-dialog input,#history-organizer-dialog select{box-sizing:border-box;min-width:0;width:100%;padding:7px;font-size:13px}#history-organizer-dialog .history-organizer-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#history-organizer-dialog button{font-size:12px;padding:6px 8px}#history-organizer-list{max-height:30dvh;min-height:70px;overflow:auto;border:1px solid #40576a;border-radius:5px;padding:6px;display:grid;gap:4px}#history-organizer-list .history-organizer-row{display:flex;align-items:center;gap:8px;padding:4px;border-bottom:1px solid #40576a}#history-organizer-list input{width:auto;flex:none;margin:0}#history-organizer-list .history-organizer-entry{flex:1;text-align:left;white-space:normal;min-width:0}#history-organizer-list .history-organizer-entry small{display:block;color:#9db7c9;font-size:11px}#history-organizer-list .history-list-group{display:grid;gap:4px}#history-organizer-list .history-list-group-title{text-align:left;background:#21465c}#history-organizer-dialog .history-group-editor{margin-top:10px;border-top:1px solid #40576a;padding-top:8px}#history-organizer-dialog .history-organizer-hint{font-size:12px;color:#9db7c9;margin:8px 0}#history-organizer-error{color:#ffb392;font-size:12px}#history-organizer-count{font-size:12px;margin:8px 0}.history-empty{font-size:12px;color:#abc2d0;padding:8px}';document.head.append(style);
 const q=id=>dialog.querySelector('#history-'+id),selected=new Set(),collapsed=new Set();let catalog={entries:[],bodies:[],types:[],groups:[]},rows=new Map(),visible=[],lastSync=0;
 function filters(){const group=q('group-filter').value;return {query:q('query').value,body:q('body').value,type:q('type').value,group:group==='all'?null:group==='none'?'':group.slice(2)};}
 function selectOptions(input,choices,defaultValue=''){
  const value=input.value;input.replaceChildren();for(const [id,label]of choices)input.add(new Option(label,id));input.value=choices.some(([id])=>id===value)?value:defaultValue;
 }
 function setCollapsed(group){collapsed.has(group)?collapsed.delete(group):collapsed.add(group);applyTimeline();renderList();}
 function applyTimeline(){
  container.replaceChildren();for(const bucket of historyBuckets(visible)){
   if(!bucket.group){const row=rows.get(bucket.entries[0].id);if(row)container.append(row);continue;}
   const wrap=document.createElement('div');wrap.className='history-group';wrap.setAttribute('role','group');wrap.setAttribute('aria-label','履歴グループ '+bucket.group);
   const toggle=document.createElement('button');toggle.type='button';toggle.className='history-group-summary';toggle.setAttribute('aria-expanded',String(!collapsed.has(bucket.group)));toggle.textContent=(collapsed.has(bucket.group)?'▶ ':'▼ ')+bucket.group+'（'+bucket.entries.reduce((sum,e)=>sum+e.ids.length,0)+'）';toggle.title=bucket.group;toggle.onclick=()=>setCollapsed(bucket.group);
   const members=document.createElement('div');members.className='history-group-members';members.hidden=collapsed.has(bucket.group);for(const entry of bucket.entries){const row=rows.get(entry.id);if(row)members.append(row);}wrap.append(toggle,members);container.append(wrap);
  }
  if(!visible.length){const empty=document.createElement('span');empty.className='history-empty';empty.textContent=catalog.entries.length?'条件に一致する工程がありません':'工程はまだありません';container.append(empty);}
  const active=filters();count.hidden=!active.query&&!active.body&&!active.type&&active.group===null;count.textContent=visible.reduce((n,e)=>n+e.ids.length,0)+' / '+getFeatures().length;
 }
 function updateActions(){
  const allowed=canModify(),chosen=selected.size>0;
  q('assign-group').disabled=q('remove-group').disabled=!allowed||!chosen;
  const group=filters().group;q('rename-group').disabled=!allowed||!group;
  q('organizer-count').textContent=visible.length+'行（'+visible.reduce((n,e)=>n+e.ids.length,0)+'工程） / 全'+getFeatures().length+'工程 · '+selected.size+'工程を選択'+(!allowed?' ／ 加工中はグループ変更できません':'');
 }
 function renderList(){
  const list=q('organizer-list'),scroll=list.scrollTop;list.replaceChildren();
  for(const bucket of historyBuckets(visible)){
   const parent=document.createElement('div');parent.className='history-list-group';
   if(bucket.group){const toggle=document.createElement('button');toggle.type='button';toggle.className='history-list-group-title';toggle.textContent=(collapsed.has(bucket.group)?'▶ ':'▼ ')+bucket.group;toggle.setAttribute('aria-expanded',String(!collapsed.has(bucket.group)));toggle.onclick=()=>setCollapsed(bucket.group);parent.append(toggle);}
   if(!collapsed.has(bucket.group))for(const entry of bucket.entries){
    const row=document.createElement('div');row.className='history-organizer-row';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.setAttribute('aria-label',entry.number+'. '+entry.name+'を整理対象に選択');checkbox.checked=entry.ids.every(id=>selected.has(id));checkbox.indeterminate=!checkbox.checked&&entry.ids.some(id=>selected.has(id));checkbox.onchange=()=>{for(const id of entry.ids)checkbox.checked?selected.add(id):selected.delete(id);updateActions();};
    const open=document.createElement('button');open.type='button';open.className='history-organizer-entry';open.dataset.featureId=entry.id;const title=document.createElement('span');title.textContent=entry.number+'. '+entry.name;const detail=document.createElement('small');detail.textContent=entry.typeLabel+(entry.group?' · '+entry.group:'')+' ／ '+[...entry.bodyIds].map(id=>catalog.bodies.find(b=>b.id===id)?.name).filter(Boolean).join('・');open.append(title,detail);open.onclick=()=>{dialog.close();onSelect(entry.id);};row.append(checkbox,open);parent.append(row);
   }
   list.append(parent);
  }
  if(!visible.length){const empty=document.createElement('p');empty.className='history-empty';empty.textContent='条件に一致する工程がありません。「絞り込みを解除」で全工程を表示します。';list.append(empty);}
  list.scrollTop=scroll;updateActions();
 }
 function applyFilters(){visible=filterHistory(catalog.entries,filters());applyTimeline();if(dialog.open)renderList();}
 function refresh(){
  rows=new Map([...container.querySelectorAll('[data-history-feature]')].map(row=>[row.dataset.historyFeature,row]));catalog=historyCatalog(getFeatures(),getBodies());
  const ids=new Set(getFeatures().map(f=>f.id));for(const id of selected)if(!ids.has(id))selected.delete(id);for(const group of collapsed)if(!catalog.groups.includes(group))collapsed.delete(group);
  selectOptions(q('body'),[['','すべてのボディ'],...catalog.bodies.map(b=>[b.id,b.name])]);selectOptions(q('type'),[['','すべての加工種類'],...catalog.types.map(t=>[t.id,t.name])]);selectOptions(q('group-filter'),[['all','すべてのグループ'],['none','グループなし'],...catalog.groups.map(g=>['g:'+g,g])],'all');
  applyFilters();
 }
 function applyGroup(ids,name){try{if(!canModify())throw Error('加工や保存を終了してからグループを変更してください');onApply(ids,name);q('organizer-error').textContent='グループを更新しました';return true;}catch(error){q('organizer-error').textContent=error.message;return false;}}
 q('assign-group').onclick=()=>{try{const name=historyGroupName(q('group-name').value);if(!name)throw Error('グループ名を入力してください');applyGroup([...selected],name);}catch(error){q('organizer-error').textContent=error.message;}};
 q('remove-group').onclick=()=>applyGroup([...selected],'');
 q('rename-group').onclick=()=>{try{const old=filters().group,name=historyGroupName(q('group-name').value);if(!old||!name)throw Error('グループを絞り込み、新しいグループ名を入力してください');if(applyGroup(getFeatures().filter(f=>(f.historyGroup||'')===old).map(f=>f.id),name)){q('group-filter').value='g:'+name;applyFilters();}}catch(error){q('organizer-error').textContent=error.message;}};
 for(const id of ['query','body','type','group-filter'])q(id).addEventListener(id==='query'?'input':'change',()=>{q('organizer-error').textContent='';if(id==='group-filter'&&filters().group)q('group-name').value=filters().group;applyFilters();});
 q('clear-filters').onclick=()=>{q('query').value=q('body').value=q('type').value='';q('group-filter').value='all';applyFilters();};
 q('select-visible').onclick=()=>{for(const entry of visible)for(const id of entry.ids)selected.add(id);renderList();};q('clear-selection').onclick=()=>{selected.clear();renderList();};
 q('collapse-all').onclick=()=>{catalog.groups.forEach(group=>collapsed.add(group));applyFilters();};q('expand-all').onclick=()=>{collapsed.clear();applyFilters();};
 q('organizer-close').onclick=()=>dialog.close();button.onclick=()=>{if(!dialog.open)dialog.show();renderList();q('query').focus();};
 const stableStyle=document.createElement('style');stableStyle.textContent='#history-organizer-dialog{height:min(680px,calc(100dvh - 32px));background:#142231;color:#ddebf5;border:1px solid #526c80;border-radius:8px;box-shadow:0 10px 32px #0006}#history-organizer-dialog[open]{display:flex;flex-direction:column}#history-organizer-dialog>.dialog-heading,#history-organizer-dialog>.history-organizer-filters,#history-organizer-dialog>.history-organizer-actions,#history-organizer-dialog>.history-group-editor,#history-organizer-dialog>.history-organizer-hint,#history-organizer-count,#history-organizer-error{flex-shrink:0}#history-organizer-list{flex:1;max-height:none}';document.head.append(stableStyle);
 refresh();return {refresh,close(){if(dialog.open)dialog.close();},sync(){if(!dialog.open||Date.now()-lastSync<150)return;lastSync=Date.now();updateActions();}};
}
