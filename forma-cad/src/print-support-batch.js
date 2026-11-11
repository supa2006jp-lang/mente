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

export function createSupportBatchPanel({anchor,bodyName,onChange,onRetry,onAdjust}){
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
   row.append(check,bodyName(id),note);
   const editor=document.createElement('details');
   editor.innerHTML='<summary>このボディの設定を変更</summary><label>リブの向き<select data-adjust="wallDirection"><option value="">共通設定</option><option value="auto">自動</option><option value="x">横方向（X）</option><option value="y">縦方向（Y）</option></select></label><label>薄壁の間隔 (mm)<input type="number" min="2" max="15" step="any" data-adjust="wallPitch"></label><label>上面の薄皮 (層)<input type="number" min="1" max="6" step="1" data-adjust="roofLayers"></label><label>底面の薄皮 (層)<input type="number" min="1" max="6" step="1" data-adjust="bottomSkinLayers"></label><button type="button">このボディだけ再計算</button>';
   const fields=[...editor.querySelectorAll('[data-adjust]')],apply=editor.querySelector('button');
   apply.onclick=()=>{
    if(fields.some(field=>!field.reportValidity()))return;
    const values=Object.fromEntries(fields.filter(field=>field.value!=='').map(field=>
     [field.dataset.adjust,field.tagName==='SELECT'?field.value:field.valueAsNumber]));
    onAdjust(id,values);
   };
   // Keep the failed-row editor outside the checkbox label.
   const item=document.createElement('div');item.append(row,editor);list.append(item);
   rows.set(id,{check,note,editor,fields,apply,entry:null});
  }
 }
 function sync({available,disabled,entries,calculating,adjustments}){
  panel.hidden=!available;
  for(const [id,row] of rows){
   const {check,note,editor,fields,apply}=row;
   check.disabled=disabled;check.checked=selected.has(id);
   const entry=check.checked?entries.get(id):null;
   const regions=entry?.clearance||[];
   const mm=value=>Number(value.toFixed(3))+' mm';
   const sizes=[...new Set(regions.filter(region=>Number.isFinite(region.available)).map(region=>
    (region.role==='upper'?'上面':'底面')+'は '+mm(region.available)+' 確保、必要な厚さ '+mm(region.thickness)))];
   note.textContent=entry?.error?'要確認：'+entry.error+(sizes.length?' '+sizes.slice(0,3).join(' ／ '):''):entry?.result?(entry.result.supportPreview?.exportStatus?.ok?'配置・3MF準備完了':'配置完了（3MF要確認）'):'';
   const local=adjustments.get(id)||{};
   editor.hidden=!available||!entry||!entry.error&&!Object.keys(local).length;
   if(row.entry!==entry){
    row.entry=entry;
    for(const field of fields){
     const key=field.dataset.adjust;
     field.value=local[key]??'';
     if(field.tagName==='INPUT')field.placeholder=String(entry?.input?.[key]??'');
    }
   }
   for(const control of [...fields,apply])control.disabled=disabled||calculating||editor.hidden;
  }
  const finished=[...selected].filter(id=>entries.get(id)?.result).length,failed=[...selected].filter(id=>entries.get(id)?.error).length;
  status.textContent=selected.size?(calculating?'計算中… ／ ':'')+'選択 '+selected.size+' ／ 作成可能 '+finished+' ／ 要確認 '+failed:'1ボディずつ配置する場合は、上の「対象ボディ」を使います。';
  retry.disabled=disabled||calculating||!failed;
 }
 return {init,sync,selected};
}
