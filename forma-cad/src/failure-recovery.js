import {subscribeKernelActivity} from './kernel-client.js';
import {createFailureRecoveryStore,failureRecord,failureDocument} from './failure-recovery-store.js';
const commands=new Set(['exactExtrusionPreview','extrusionToolPreview','extrusionJoinInspect','extrusionBatch','extrusion','barrierPreparedPreview','join','fillet','chamfer','shell','move','pull','mirror','replay','pipe','loft','revolve','resize','split','thread','coil','enclose','svgWrap','geometryGapRepair','ballJoint','bossJoint','simpleBoss','snapLid','slideLid','cylinderHinge']);
const operationNames={exactExtrusionPreview:'押し出しのプレビュー',extrusionToolPreview:'押し出しのプレビュー',extrusionJoinInspect:'結合の確認',extrusionBatch:'押し出し',extrusion:'押し出し',barrierPreparedPreview:'バリア押し出し',join:'結合・切り取り',fillet:'フィレット',chamfer:'面取り',shell:'シェル',move:'移動',pull:'プレス・プル',mirror:'ミラー',replay:'履歴の再計算',pipe:'パイプ',loft:'ロフト',revolve:'回転体',resize:'サイズ変更',split:'分離',thread:'ねじ',coil:'コイル',enclose:'囲み形成',svgWrap:'巻き付け',geometryGapRepair:'隙間の修正',ballJoint:'ボールジョイント',bossJoint:'ボス接合',simpleBoss:'ボス接合',snapLid:'被せ蓋',slideLid:'スライド蓋',cylinderHinge:'円柱ヒンジ蓋'};
export function installFailureRecovery({getFeatures,getEditing,getDrawing,onRestore,notify,store=createFailureRecoveryStore()}){
 const button=document.createElement('button');button.id='failure-recovery-open';button.type='button';button.textContent='失敗時の記録';button.title='自動保存した失敗直前のモデルと入力条件';document.getElementById('load-images').after(button);
 const dialog=document.createElement('dialog');dialog.id='failure-recovery-dialog';dialog.style.cssText='width:min(650px,90vw);max-height:80vh;overflow:auto;padding:20px';dialog.innerHTML='<h3>失敗直前の自動記録</h3><p>直近の最大3件をこのブラウザー内に保存します。記録には元モデル・選択面・入力条件・エラーを含みます。容量により保存件数が少なくなる場合があります。</p><p data-status role="status"></p><div data-list></div><button type="button" data-close>閉じる</button>';document.body.append(dialog);
 const list=dialog.querySelector('[data-list]'),status=dialog.querySelector('[data-status]'),jobs=new Map(),clients=new WeakMap();let nextClient=0,last=null,rows=[],queue=Promise.resolve();
 const jobKey=event=>{if(!clients.has(event.client))clients.set(event.client,++nextClient);return clients.get(event.client)+':'+event.id;};
 function download(record){const data=failureDocument(record),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='failure-before-'+record.createdAt+'.forma.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function render(){
  button.textContent='失敗時の記録'+(rows.length?'（'+rows.length+'）':'');list.replaceChildren();
  for(const {record}of rows){const article=document.createElement('article');article.style.cssText='padding:12px 0;border-bottom:1px solid #7895a5';const title=document.createElement('strong');title.textContent=new Date(record.createdAt).toLocaleString('ja-JP');const message=document.createElement('p');message.textContent=record.error.message;const detail=document.createElement('p'),f=record.editing?.feature,id=f?.region?.bodyId||f?.target;detail.textContent=record.editing?.support?'操作：連結リブサポート（'+({preview:'プレビュー',export3mf:'3MF出力',apply:'確定',preflight:'3MF事前検査'}[record.editing.support.phase]||'設定')+'）':f?.kind==='extrusion'?(f.operation==='cut'?'切り取り':'押し出し')+'・距離 '+f.depth+' mm・'+(f.operation==='new'?'新規':record.editing.bodyNames?.[id]||'対象ソリッド'):'操作：'+(operationNames[record.request.spec.operation?.type||record.request.spec.type]||'CAD加工');article.append(title,message,detail);
   const restore=document.createElement('button');restore.type='button';restore.textContent=record.editing?.support?'モデルとサポート設定を復元':record.editing?.feature?.kind==='extrusion'?'モデルと入力条件を復元':'元モデルを復元';restore.onclick=async()=>{restore.disabled=true;try{await onRestore(structuredClone(record));dialog.close();notify('失敗直前の状態を復元しました。現在のモデルは「元に戻す」で戻せます');}catch(error){status.textContent=error.message;}finally{restore.disabled=false;}};
   const save=document.createElement('button');save.type='button';save.textContent='モデルと条件をファイル保存';save.onclick=()=>download(record);const remove=document.createElement('button');remove.type='button';remove.textContent='削除';remove.onclick=async()=>{try{await store.remove(record.id);if(last?.id===record.id)last=null;await refresh();}catch(error){status.textContent=error.message;}};article.append(restore,save,remove);list.append(article);
  }
  if(!rows.length){const empty=document.createElement('p');empty.textContent='記録はまだありません。';list.append(empty);}
 }
 async function refresh(){try{rows=await store.list();if(last&&!rows.some(row=>row.id===last.id))rows.unshift({record:last});rows=rows.slice(0,3);render();}catch(error){rows=last?[{record:last}]:[];status.textContent='自動保存を使用できません：'+error.message;render();}}
 function capture(job,error){
  const record=failureRecord({...job,error});last=record;
  queue=queue.catch(()=>{}).then(async()=>{try{await store.write(record);status.textContent='端末内に自動保存しました。復元後も計算は自動実行しません。';}catch(error){status.textContent='自動保存できませんでした：'+error.message+'。この画面からファイル保存できます。';}await refresh();});return record;
 }
 subscribeKernelActivity(event=>{
  const operation=event.spec?.type==='preview'?event.spec.operation:event.spec;if(!commands.has(operation?.type))return;const key=jobKey(event);
  if(event.state==='queued'){jobs.set(key,{features:getFeatures(),spec:event.spec,requestFeatures:event.features,editing:structuredClone(getEditing()),drawing:structuredClone(getDrawing?.()||null)});}
  else if(['completed','cancelled','error'].includes(event.state)){const job=jobs.get(key);jobs.delete(key);if(event.state==='error'&&event.error?.code!=='cancelled'&&job)capture(job,event.error);}
 });
 button.onclick=async()=>{await queue.catch(()=>{});await refresh();dialog.showModal();};dialog.querySelector('[data-close]').onclick=()=>dialog.close();refresh();
 return {refresh,capture(job,error){if(error?.code==='cancelled'||error?.name==='AbortError')return null;return capture({...job,drawing:job.drawing??getDrawing?.()??null},error);},get pending(){return queue;}};
}
