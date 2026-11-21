import {zipSync} from 'three/addons/libs/fflate.module.js';

export function drawingPrintSetName(value,fallback='FORMA CAD'){
 const clean=input=>String(input??'').trim().replace(/(?:\.(?:pdf|3mf|zip))+$/gi,'')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'');
 let name=clean(value)||clean(fallback)||'FORMA CAD';
 name=Array.from(name).slice(0,100).join('').replace(/[. ]+$/g,'');
 if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;
 return name;
}

export function packDrawingPrintSet(name,pdf,model){
 const stem=drawingPrintSetName(name),drawing=new Uint8Array(pdf);
 if(!drawing.length||!(model instanceof Uint8Array)||!model.length)throw Error('PDFと3MFの両方を用意してください');
 return {data:zipSync({[stem+'.pdf']:drawing,[stem+'.3mf']:model},{level:0}),fileName:stem+'.zip'};
}

export function drawingPrintSetControls(owner,{fileName,onName,issues}){
 const doc=owner.ownerDocument,label=doc.createElement('label'),input=doc.createElement('input');
 input.type='text';input.maxLength=140;input.value=fileName;
 input.oninput=()=>onName(input.value);
 label.append('PDF・3MFの共通ファイル名',input);
 owner.append(label);
 if(!issues.length)return;
 const details=doc.createElement('details'),heading=doc.createElement('summary'),items=doc.createElement('ul');
 details.open=true;
 heading.textContent='PDFの出力前チェック '+issues.length+' 件';
 items.style.cssText='max-height:10rem;overflow:auto;margin:.4rem 0;padding-left:1.5rem';
 for(const issue of issues){
  const row=doc.createElement('li');
  row.textContent=(issue.pageIndex+1)+'ページ '+issue.label;
  items.append(row);
 }
 details.append(heading,items);
 owner.append(details);
}
