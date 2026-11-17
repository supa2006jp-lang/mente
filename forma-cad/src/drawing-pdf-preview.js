import {drawingViewport} from './drawing-viewport.js';
import {drawingPrintSVG} from './drawing-print-palette.js';
import {loadDrawingCommentFont} from './drawing-comments.js';

export function installDrawingPDFPreview({download}){
 const dialog=document.createElement('dialog');
 dialog.id='drawing-pdf-preview';
 dialog.innerHTML='<div class="drawing-heading"><h2>PDFの印刷プレビュー</h2><button id="drawing-pdf-preview-close" type="button" aria-label="閉じる">×</button></div>'+
  '<div class="drawing-controls"><button id="drawing-pdf-preview-prev" type="button">前のページ</button>'+
  '<label>ページ<select id="drawing-pdf-preview-page"></select></label><button id="drawing-pdf-preview-next" type="button">次のページ</button>'+
  '<button id="drawing-pdf-preview-minus" type="button" aria-label="縮小">−</button><output id="drawing-pdf-preview-percent">100%</output>'+
  '<button id="drawing-pdf-preview-plus" type="button" aria-label="拡大">＋</button><button id="drawing-pdf-preview-fit" type="button">用紙全体</button>'+
  '<button id="drawing-pdf-preview-expand" type="button">作業領域を最大化</button></div>'+
  '<div id="drawing-pdf-preview-host"></div><div class="drawing-actions"><span id="drawing-pdf-preview-status" role="status"></span>'+
  '<button id="drawing-pdf-preview-save" type="button">この内容でPDF保存</button></div>';
 document.body.append(dialog);
 const q=id=>dialog.querySelector('#drawing-pdf-preview-'+id);
 let pages=[],palette='screen',index=0,saving=false,revision=0;
 const viewport=drawingViewport({dialog,host:q('host'),minus:q('minus'),plus:q('plus'),fit:q('fit'),
  percent:q('percent'),expand:q('expand'),canNavigate:()=>!saving});
 function show(){
  const page=pages[index];
  q('host').innerHTML=drawingPrintSVG(page.svg,palette);
  viewport.setSheet(page);viewport.reset();
  q('page').value=String(index);
  q('prev').disabled=index===0;q('next').disabled=index===pages.length-1;
  q('status').textContent=page.width+' × '+page.height+' mm · '+(index+1)+' / '+pages.length+' ページ';
 }
 q('prev').onclick=()=>{if(index>0){index--;show();}};
 q('next').onclick=()=>{if(index<pages.length-1){index++;show();}};
 q('page').onchange=()=>{index=Number(q('page').value);show();};
 q('close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{revision++;viewport.cancel();pages=[];q('host').replaceChildren();});
 q('save').onclick=async()=>{
  if(saving||!pages.length)return;
  saving=true;q('save').disabled=true;
  try{await download(pages,palette);}
  catch(error){q('status').textContent='PDF保存に失敗しました。'+error.message;}
  finally{saving=false;q('save').disabled=false;}
 };
 return {
  async open(next,nextPalette){
   const token=++revision;
   pages=next;palette=nextPalette;index=0;q('save').disabled=false;
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
