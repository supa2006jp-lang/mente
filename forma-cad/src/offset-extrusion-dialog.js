const preferenceKey='forma-offset-extrusion-distance-v1';
export function createOffsetExtrusionDialog({getFeatures,onApply,notify}){
 let last=0,target=null,original=null;
 try{const text=localStorage.getItem(preferenceKey),value=text===null?0:Number(text);if(Number.isFinite(value)&&Math.abs(value)<=10000)last=value;}catch{}
 const dialog=document.createElement('dialog');dialog.id='offset-extrusion-dialog';dialog.style.cssText='width:min(360px,calc(100vw - 24px));padding:18px';
 dialog.innerHTML='<form><h2 style="margin:0 0 12px;font-size:18px">OS押出</h2><label>輪郭のオフセット距離 (mm)<input id="offset-extrusion-distance" type="number" step="any" min="-10000" max="10000" style="width:100%;box-sizing:border-box"></label><p style="font-size:12px">−で範囲を狭く、＋で広くします。空欄なら前回値を使います。</p><p id="offset-extrusion-error" role="alert" style="font-size:12px"></p><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" id="offset-extrusion-cancel">キャンセル</button><button class="accent" type="submit">押し出しへ</button></div></form>';
 document.body.append(dialog);const input=dialog.querySelector('input'),error=dialog.querySelector('#offset-extrusion-error');
 function close(){if(dialog.open)dialog.close();target=null;original=null;}
 function remember(value){if(!Number.isFinite(value)||Math.abs(value)>10000)return;last=value;try{localStorage.setItem(preferenceKey,String(last));}catch{}}
 dialog.querySelector('#offset-extrusion-cancel').onclick=close;
 dialog.addEventListener('cancel',()=>{target=null;original=null;});
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();error.textContent='';
  const value=input.value.trim()===''?last:Number(input.value);
  if(!Number.isFinite(value)||Math.abs(value)>10000){error.textContent='−10000〜10000 mmで指定してください';return;}
  if(original!==getFeatures()){error.textContent='モデルが変わりました。対象を選び直してください';return;}
  const selection=target;remember(value);
  close();try{await onApply(selection,value);}catch(cause){notify(cause.message||'OS押出を開始できませんでした');}
 };
 return {open(selection){target=selection;original=getFeatures();input.value=String(last);error.textContent='';dialog.showModal();input.focus();input.select();},close,remember};
}
