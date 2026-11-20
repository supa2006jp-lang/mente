import {drawingViewport} from './drawing-viewport.js';
import {drawingPrintSVG} from './drawing-print-palette.js';
import {loadDrawingCommentFont} from './drawing-comments.js';
import {drawingScaleSummary} from './drawing-view-preferences.js';

export function installDrawingPDFPreview({download,onIssue,onEdit}){
 const dialog=document.createElement('dialog');
 dialog.id='drawing-pdf-preview';
 dialog.innerHTML='<div class="drawing-heading"><h2>PDFの印刷プレビュー</h2><button id="drawing-pdf-preview-close" type="button" aria-label="閉じる">×</button></div>'+
  '<div class="drawing-controls"><button id="drawing-pdf-preview-prev" type="button">前のページ</button>'+
  '<label>ページ<select id="drawing-pdf-preview-page"></select></label><button id="drawing-pdf-preview-next" type="button">次のページ</button>'+
  '<button id="drawing-pdf-preview-minus" type="button" aria-label="縮小">−</button><output id="drawing-pdf-preview-percent">100%</output>'+
  '<button id="drawing-pdf-preview-plus" type="button" aria-label="拡大">＋</button><button id="drawing-pdf-preview-fit" type="button">用紙全体</button>'+
  '<button id="drawing-pdf-preview-expand" type="button">作業領域を最大化</button>'+
  '<button id="drawing-pdf-preview-edit" type="button" hidden>このページを編集</button></div>'+
  '<details id="drawing-pdf-preview-check"><summary id="drawing-pdf-preview-check-summary"></summary><div id="drawing-pdf-preview-issues"></div></details>'+
  '<div id="drawing-pdf-preview-host"></div><div class="drawing-actions"><span id="drawing-pdf-preview-status" role="status"></span>'+
  '<button id="drawing-pdf-preview-save" type="button">この内容でPDF保存</button></div>';
 document.body.append(dialog);
 const q=id=>dialog.querySelector('#drawing-pdf-preview-'+id);
 let pages=[],palette='screen',index=0,saving=false,blocked=false,revision=0;
 const viewport=drawingViewport({dialog,host:q('host'),minus:q('minus'),plus:q('plus'),fit:q('fit'),
  percent:q('percent'),expand:q('expand'),canNavigate:()=>!saving});
 function show(){
  const page=pages[index];
  q('host').innerHTML=drawingPrintSVG(page.svg,palette);
  viewport.setSheet(page);viewport.reset();
  q('page').value=String(index);
  q('prev').disabled=index===0;q('next').disabled=index===pages.length-1;
  const scales=Object.values(page.layout).map(view=>view.scale);
  const scale=scales.length?' · '+drawingScaleSummary(scales).header.replace(' / mm',''):'';
  q('status').textContent=page.width+' × '+page.height+' mm · '+(index+1)+' / '+pages.length+' ページ'+scale+
   (blocked?' · 図面に戻って配置を調整してください':'');
 }
 q('prev').onclick=()=>{if(index>0){index--;show();}};
 q('next').onclick=()=>{if(index<pages.length-1){index++;show();}};
 q('page').onchange=()=>{index=Number(q('page').value);show();};
 q('edit').onclick=()=>{if(!saving){dialog.close();onEdit(index);}};
 q('close').onclick=()=>{if(!saving)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 dialog.addEventListener('close',()=>{revision++;viewport.cancel();pages=[];q('host').replaceChildren();q('issues').replaceChildren();});
 q('save').onclick=async()=>{
  if(saving||blocked||!pages.length)return;
  saving=true;q('save').disabled=true;
  try{await download(pages,palette);}
  catch(error){q('status').textContent='PDF保存に失敗しました。'+error.message;}
  finally{saving=false;q('save').disabled=blocked;}
 };

 function showIssues(issues){
  const check=q('check'),rows=q('issues');
  check.hidden=!issues.length;check.open=!!issues.length;
  const counts={overlap:0,reference:0,layout:0};
  for(const issue of issues)counts[issue.kind]++;
  const categories=[['overlap','寸法の重なり'],['reference','参照先を要確認'],['layout','配置を要調整']];
  q('check-summary').textContent='出力前チェック　'+categories.filter(([key])=>counts[key])
   .map(([key,label])=>label+' '+counts[key]+' 件').join(' ／ ');
  rows.replaceChildren(...issues.map(issue=>{
   const button=document.createElement('button');
   button.type='button';button.dataset.pdfIssue=issue.kind;
   button.textContent=(issue.pageIndex+1)+' ページ · '+issue.label;
   button.onclick=()=>{
    if(saving)return;
    if(issue.kind==='layout'){index=issue.pageIndex;show();return;}
    dialog.close();onIssue(issue);
   };
   return button;
  }));
  blocked=counts.layout>0;
  q('save').disabled=blocked;
  q('save').title=blocked?'はみ出しや表題欄との重なりを調整してから保存してください':'';
 }
 return {
  async open(next,nextPalette,issues=[]){
   const token=++revision;
   pages=next;palette=nextPalette;index=0;showIssues(issues);
   q('edit').hidden=pages.length<2||!onEdit;
   q('page').replaceChildren(...pages.map((page,i)=>new Option((i+1)+' / '+pages.length,String(i))));
   dialog.showModal();show();
   try{
    await Promise.all([...new Set(pages.flatMap(page=>(page.notes??[page.note]).filter(Boolean).map(note=>note.font)))].map(loadDrawingCommentFont));
    if(dialog.open&&token===revision)show();
   }catch(error){if(token===revision)q('status').textContent='フォントを読み込めませんでした。'+error.message;}
  },
  close(){if(dialog.open)dialog.close();},
 };
}
