export function supportHistoryFeature(input,result){
 const {supportPreview,supportPackage,...stored}=result;
 return {kind:'cadop',id:input.id,name:'連結リブサポート',spec:input,...stored};
}

export function supportBatchPackage(entries){
 const packages=entries.filter(({result})=>result.supportPackage?.complete&&result.supportPreview?.exportStatus?.ok)
  .map(({result})=>result.supportPackage);
 if(!packages.length)return null;
 const layerHeight=packages[0].layerHeight;
 if(packages.some(pkg=>pkg.layerHeight!==layerHeight))throw Error('一括出力する積層ピッチを揃えてください');
 const bodies=new Map();
 for(const pkg of packages)for(const body of pkg.bodies)if(!bodies.has(body.id))bodies.set(body.id,body);
 return {complete:true,layerHeight,bodies:[...bodies.values()],blockers:packages.flatMap(pkg=>pkg.blockers)};
}

export function createSupportBatchPanel({anchor,bodyName,onChange,onRetry}){
 const panel=document.createElement('details');panel.dataset.id='support-batch';
 panel.innerHTML='<summary>複数ボディに一括配置</summary><small>選んだボディの下面を、共通の設定で順に計算します。作成できたサポートはボディごとの工程になります。</small><div data-batch="targets" style="max-height:175px;overflow:auto"></div><small data-batch="status" aria-live="polite"></small><button type="button" data-batch="retry">失敗した対象だけ再計算</button>';
 anchor.after(panel);
 const list=panel.querySelector('[data-batch=targets]'),status=panel.querySelector('[data-batch=status]'),retry=panel.querySelector('[data-batch=retry]');
 const rows=new Map(),selected=new Set();
 retry.onclick=onRetry;
 function init(ids,initial){
  panel.open=initial.length>1;rows.clear();selected.clear();list.replaceChildren();
  initial.forEach(id=>selected.add(id));
  for(const id of ids){
   const row=document.createElement('label'),check=document.createElement('input'),note=document.createElement('small');
   check.type='checkbox';check.dataset.supportBatchTarget=id;
   check.onchange=()=>{
    if(check.checked&&selected.size>=12){check.checked=false;status.textContent='一度に選択できる対象は12ボディまでです。';return;}
    if(check.checked)selected.add(id);else selected.delete(id);onChange();
   };
   row.append(check,bodyName(id),note);list.append(row);rows.set(id,{check,note});
  }
 }
 function sync({available,disabled,entries,calculating}){
  panel.hidden=!available;
  for(const [id,{check,note}] of rows){
   check.disabled=disabled;check.checked=selected.has(id);
   const entry=check.checked?entries.get(id):null;
   note.textContent=entry?.error?'要確認：'+entry.error:entry?.result?(entry.result.supportPreview?.exportStatus?.ok?'配置・3MF準備完了':'配置完了（3MF要確認）'):'';
  }
  const finished=[...selected].filter(id=>entries.get(id)?.result).length,failed=[...selected].filter(id=>entries.get(id)?.error).length;
  status.textContent=selected.size?(calculating?'計算中… ／ ':'')+'選択 '+selected.size+' ／ 作成可能 '+finished+' ／ 要確認 '+failed:'1ボディずつ配置する場合は、上の「対象ボディ」を使います。';
  retry.disabled=disabled||calculating||!failed;
 }
 return {init,sync,selected};
}
