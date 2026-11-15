import {KernelClient} from './kernel-client.js';
import {draggablePanel} from './draggable-panel.js';
import {createAssemblyPairHighlight} from './assembly-contact-view.js';

const labels={interference:'干渉',contact:'接触',gap:'隙間',unknown:'検査できない組'};
const rank={interference:0,gap:1,contact:2,unknown:3};
const format=value=>Number(value.toPrecision(6)).toLocaleString(undefined,{maximumFractionDigits:10});
const pageSize=40;

export function createAssemblyAuditView({scene,host,meshes,getFeatures,getBodyName,getSelectionState,canOpen,notify,onOpen,fitModelToolBox}){
 const kernel=new KernelClient(),detailKernel=new KernelClient(),graphics=createAssemblyPairHighlight({scene,getObject:id=>meshes.get(id)});
 const panel=document.createElement('section');panel.id='assembly-audit';panel.className='workspace-panel';panel.hidden=true;panel.style.zIndex='215';
 panel.innerHTML='<label>検査範囲 <select data-scope><option value="visible">表示中の全ボディ</option><option value="selected">選択したボディ同士</option><option value="against">選択したボディと周囲</option></select></label><label>表示する隙間の上限 (mm)<input type="number" min="0" max="1000" step="any" value="2" data-gap></label><div class="workspace-actions"><button type="button" data-check>一括検査</button><button type="button" data-cancel hidden>検査を中止</button></div><p data-status role="status" aria-live="polite"></p><div data-results hidden><label>結果を絞る <select data-filter><option value="all">すべて</option><option value="interference">干渉</option><option value="gap">隙間</option><option value="contact">接触</option><option value="unknown">検査できない組</option></select></label><div data-rows></div><button type="button" data-more hidden>さらに表示</button></div><p class="hint" data-detail></p><div class="workspace-actions"><button type="button" data-fit disabled>箇所にズーム</button><button type="button" data-clear disabled>強調を消す</button><button type="button" data-close>閉じる</button></div>';
 const faces=document.createElement('div');faces.dataset.faceGaps='';panel.querySelector('[data-detail]').after(faces);
 host.parentElement.append(panel);draggablePanel(panel,'組み立ての干渉・隙間');
 const style=document.createElement('style');style.textContent='#assembly-audit select{color:#173b50;background:white;padding:5px;max-width:100%}#assembly-audit [data-rows]{max-height:32vh;overflow:auto}#assembly-audit [data-pair]{display:block;width:100%;text-align:left;white-space:normal;margin:4px 0;border-left:5px solid #7293aa}#assembly-audit [data-kind=interference]{border-left-color:#d83c2e}#assembly-audit [data-kind=gap]{border-left-color:#187ac1}#assembly-audit [data-kind=contact]{border-left-color:#078658}#assembly-audit [aria-pressed=true]{outline:2px solid #137b9d;outline-offset:-2px}';document.head.append(style);
 const button=document.createElement('button');button.id='assembly-audit-tool';button.type='button';button.textContent='◇ 干渉・隙間';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const q=name=>panel.querySelector('[data-'+name+']');
 const visible=()=>[...meshes].filter(([,mesh])=>mesh.visible).map(([id])=>id);
 let original=null,visibility='',revision=0,detailRevision=0,busy=false,detailBusy=false,rows=[],selected=null,box=null,count=pageSize;
 function clearHighlight(){
  ++detailRevision;if(detailBusy)detailKernel.reset();detailBusy=false;graphics.clear();selected=null;box=null;
  for(const item of q('rows').children)item.setAttribute('aria-pressed','false');
  q('detail').textContent='';faces.replaceChildren();q('fit').disabled=q('clear').disabled=true;delete host.dataset.assemblyAuditPair;
 }
 function stop(){
  ++revision;if(busy)kernel.reset();busy=false;q('cancel').hidden=true;q('check').disabled=q('scope').disabled=q('gap').disabled=false;
 }
 function reset(){
  stop();clearHighlight();rows=[];q('results').hidden=true;q('rows').replaceChildren();delete host.dataset.assemblyAudit;
 }
 function close(){reset();panel.hidden=true;original=null;button.setAttribute('aria-pressed','false');}
 function open(){
  if(!canOpen())return notify('編集中の操作を終了してから検査してください');
  reset();onOpen?.();original=getFeatures();const ids=visible();visibility=JSON.stringify(ids);
  const picked=selectedIds(ids);
  q('scope').value=picked.length>1?'selected':picked.length===1?'against':'visible';
  q('status').textContent=ids.length+' 個の表示中ボディ。検査範囲を選んで実行してください。';
  panel.hidden=false;button.setAttribute('aria-pressed','true');
 }
 function selectedIds(ids){return [...new Set(getSelectionState().bodyIds)].filter(id=>ids.includes(id));}
 async function focus(row){
  clearHighlight();selected=row;const request=detailRevision,features=original;
  for(const item of q('rows').children)item.setAttribute('aria-pressed',String(item.dataset.pair===pairKey(row)));
  q('clear').disabled=false;
  function showPair(gap,highlight){
   if(gap){
    box=graphics.show({...row,status:'gap',bounds:null,points:gap.points});
    q('detail').textContent='青：向かい合う平面の隙間 '+format(gap.distance)+' mm';
   }else{
    box=graphics.show(row,highlight?[highlight]:[]);
    q('detail').textContent=row.status==='interference'?(highlight?'赤：2つのボディが重なっている形状です。':'赤：共通部分の範囲を表示しています。'):
     row.status==='gap'?'青：最短距離を測った2点を結んでいます。':row.status==='contact'?'緑：接触が確認できた点です。':'枠は検査対象のボディです。';
   }
   q('fit').disabled=box.isEmpty();
   host.dataset.assemblyAuditPair=JSON.stringify({source:row.source,target:row.target,status:gap?'face-gap':row.status,exact:!!gap||!!highlight});
  }
  showPair();const gapLimit=Number(q('gap').value);
  if(row.status==='unknown'||row.status!=='interference'&&gapLimit===0)return;
  faces.textContent=gapLimit>0?'向かい合う平面を確認中…':'干渉部分を表示する準備中…';
  detailBusy=true;
  try{
   const {highlight,faceGaps}=await detailKernel.run(features,{type:'assemblyAuditPair',targets:[row.source,row.target],gapLimit});
   if(request!==detailRevision||features!==getFeatures()||panel.hidden)return;
   showPair(null,highlight);faces.replaceChildren();
   if(faceGaps?.rows.length){
    const title=document.createElement('p');title.textContent='向かい合う平面の隙間';
    const showMain=document.createElement('button');showMain.type='button';showMain.textContent='ボディの測定結果に戻す';showMain.onclick=()=>showPair(null,highlight);
    faces.append(title,showMain);
    for(const gap of faceGaps.rows){
     const button=document.createElement('button');button.type='button';button.dataset.faceGap='';button.textContent=format(gap.distance)+' mm';
     button.onclick=()=>showPair(gap,highlight);faces.append(' ',button);
    }
   }
   if(faceGaps?.partial)faces.append(document.createTextNode(' 平面の確認は一部未完了です。'));
  }catch{if(request===detailRevision)faces.textContent='詳細表示を完了できませんでした。';}
  finally{if(request===detailRevision)detailBusy=false;}
 }
 const pairKey=row=>JSON.stringify([row.source,row.target]);
 function renderRows(){
  const filter=q('filter').value,filtered=filter==='all'?rows:rows.filter(row=>row.status===filter),list=q('rows');
  list.replaceChildren(...filtered.slice(0,count).map(row=>{
   const item=document.createElement('button');item.type='button';item.dataset.pair=pairKey(row);item.dataset.kind=row.status;
   item.setAttribute('aria-pressed',String(row===selected));
   const value=row.status==='interference'?' '+format(row.volume)+' mm³':row.status==='gap'?' '+format(row.distance)+' mm':'';
   item.textContent=labels[row.status]+value+' ／ '+getBodyName(row.source)+' ↔ '+getBodyName(row.target);
   item.onclick=()=>focus(row);return item;
  }));
  if(!filtered.length)list.textContent='この種類の結果はありません。';
  q('more').hidden=filtered.length<=count;
 }
 async function check(){
  if(busy||panel.hidden||!canOpen())return;
  reset();original=getFeatures();const ids=visible(),picked=selectedIds(ids),scope=q('scope').value;
  const targets=scope==='selected'?picked:ids,against=scope==='against'?picked:[];
  const gapLimit=q('gap').value.trim()?Number(q('gap').value):NaN;
  if(targets.length<2||scope==='against'&&(!against.length||against.length===targets.length)){q('status').textContent='表示と選択を確認し、比較できるボディを2個以上用意してください。';return;}
  if(targets.length>250){q('status').textContent='対象を250ボディ以下に絞ってください。';return;}
  if(!Number.isFinite(gapLimit)||gapLimit<0||gapLimit>1000){q('status').textContent='隙間の上限は0〜1000 mmで指定してください。';return;}
  visibility=JSON.stringify(ids);const request=revision,features=original;
  const current=()=>request===revision&&features===getFeatures()&&!panel.hidden&&visibility===JSON.stringify(visible());
  busy=true;q('check').disabled=q('scope').disabled=q('gap').disabled=true;q('cancel').hidden=false;q('status').textContent='検査を準備しています…';
  try{
   const report=await kernel.run(features,{type:'assemblyAudit',targets,against,gapLimit},{onProgress:p=>{
    if(current())q('status').textContent=p.stage+(p.total?' '+p.current+' / '+p.total+' 組':'');
   }});
   if(!current())return;
   rows=report.rows.sort((a,b)=>rank[a.status]-rank[b.status]||
    (a.status==='interference'?b.volume-a.volume:(a.distance??Infinity)-(b.distance??Infinity)));
   const totals=Object.fromEntries(Object.keys(labels).map(kind=>[kind,rows.filter(row=>row.status===kind).length]));
   const incomplete=report.untested+report.errors+report.unavailable;
   q('status').textContent=report.total+' 組 ／ 干渉 '+totals.interference+' ／ 隙間 '+totals.gap+' ／ 接触 '+totals.contact+
    ' ／ 上限外 '+(report.pruned+report.outside)+(incomplete?' ／ 未確認 '+incomplete+' 組':'');
   if(report.unavailableIds.length)q('status').append(document.createTextNode('。CAD形状を確認できない部品 '+report.unavailableIds.map(getBodyName).join('、')));
   q('filter').value='all';count=pageSize;q('results').hidden=false;renderRows();
   host.dataset.assemblyAudit=JSON.stringify({total:report.total,...totals,complete:report.complete,incomplete});
  }catch(error){if(current())q('status').textContent=error.message;}
  finally{if(request===revision)stop();}
 }
 button.onclick=()=>panel.hidden?open():close();
 q('check').onclick=check;q('close').onclick=close;q('clear').onclick=clearHighlight;
 q('fit').onclick=()=>{if(box&&!box.isEmpty())fitModelToolBox?.(box);};
 q('cancel').onclick=()=>{reset();q('status').textContent='検査を中止しました。';};
 for(const name of ['scope','gap'])q(name).oninput=()=>{reset();q('status').textContent='条件を変更しました。一括検査を実行してください。';};
 q('filter').onchange=()=>{clearHighlight();count=pageSize;renderRows();};
 q('more').onclick=()=>{const top=q('rows').scrollTop;count+=pageSize;renderRows();q('rows').scrollTop=top;};
 return {close,sync(){
  const ids=visible(),allowed=ids.length>=2&&canOpen();button.disabled=!allowed;
  if(panel.hidden)return;
  if(!allowed||original!==getFeatures()){close();return;}
  const next=JSON.stringify(ids);
  if(visibility!==next){reset();visibility=next;q('status').textContent='表示するボディが変わりました。一括検査を実行してください。';}
 }};
}
