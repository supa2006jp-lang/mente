import {drawingViewport} from './drawing-viewport.js';
import {drawingPrintSVG} from './drawing-print-palette.js';
import {loadDrawingCommentFont} from './drawing-comments.js';
import {drawingScaleSummary} from './drawing-view-preferences.js';
import {drawingOverflowOutline,drawingSheetItems,markDrawingViewOverlap} from './drawing-sheet-check.js';
import {installDrawingPDFPageList} from './drawing-pdf-page-list.js';

export function installDrawingPDFPreview({download,onIssue,onEdit,onMove,onPageOrder,onFit,viewLabel}){
 const dialog=document.createElement('dialog');
 dialog.id='drawing-pdf-preview';
 dialog.innerHTML='<div class="drawing-heading"><h2>PDFの印刷プレビュー</h2><button id="drawing-pdf-preview-close" type="button" aria-label="閉じる">×</button></div>'+
  '<div class="drawing-controls"><button id="drawing-pdf-preview-prev" type="button">前のページ</button>'+
  '<label>ページ<select id="drawing-pdf-preview-page"></select></label><button id="drawing-pdf-preview-next" type="button">次のページ</button>'+
  '<button id="drawing-pdf-preview-minus" type="button" aria-label="縮小">−</button><output id="drawing-pdf-preview-percent">100%</output>'+
  '<button id="drawing-pdf-preview-plus" type="button" aria-label="拡大">＋</button><button id="drawing-pdf-preview-fit" type="button">用紙全体</button>'+
  '<button id="drawing-pdf-preview-expand" type="button">作業領域を最大化</button>'+
  '<button id="drawing-pdf-preview-edit" type="button" hidden>このページを編集</button>'+
  '<button id="drawing-pdf-preview-fit-page" class="accent" type="button" hidden>このページを用紙に収める</button></div>'+
  '<section id="drawing-pdf-preview-pages" hidden></section>'+
  '<details id="drawing-pdf-preview-check"><summary id="drawing-pdf-preview-check-summary"></summary><div id="drawing-pdf-preview-issues"></div></details>'+
  '<div id="drawing-pdf-preview-host" tabindex="-1"></div><div class="drawing-actions"><span id="drawing-pdf-preview-status" role="status"></span>'+
  '<button id="drawing-pdf-preview-save" type="button">この内容でPDF保存</button></div>';
 document.body.append(dialog);
 const q=id=>dialog.querySelector('#drawing-pdf-preview-'+id);
 let pages=[],issues=[],palette='screen',index=0,saving=false,blocked=false,revision=0,highlight=null,notice='';
 const viewport=drawingViewport({dialog,host:q('host'),minus:q('minus'),plus:q('plus'),fit:q('fit'),
  percent:q('percent'),expand:q('expand'),canNavigate:()=>!saving});
 const pageList=installDrawingPDFPageList(q('pages'),{viewLabel,selectPage,moveItem,changeOrder,canEdit:()=>!saving});
 function showStatus(){
  const page=pages[index];
  const scales=Object.values(page.layout).map(view=>view.scale);
  const scale=scales.length?' · '+drawingScaleSummary(scales).header.replace(' / mm',''):'';
  q('status').textContent=page.width+' × '+page.height+' mm · '+(index+1)+' / '+pages.length+' ページ'+scale+
   (notice?' · '+notice:blocked?' · はみ出しを調整するとPDFを保存できます':'');
 }
 function show({reset=true}={}){
  const page=pages[index];
  const host=q('host');
  host.innerHTML=drawingPrintSVG(page.svg,palette);
  viewport.setSheet(page);
  if(reset)viewport.reset();
  if(highlight?.kind==='view-overlap'){
   markDrawingViewOverlap(host.firstElementChild,highlight.regions,true);
   viewport.focus(highlight.box);
  }else if(highlight?.box){
   const item=host.querySelectorAll(drawingSheetItems)[highlight.itemIndex];
   // A comment can be hidden behind the title block in the printed layer order.
   if(item)item.parentElement.append(item);
   const outline=drawingOverflowOutline(host.firstElementChild,highlight.box);
   outline.setAttribute('pointer-events','none');
   viewport.focus(highlight.box);
  }
  q('page').value=String(index);
  q('prev').disabled=index===0;q('next').disabled=index===pages.length-1;
  q('fit-page').hidden=!onFit||!issues.some(issue=>issue.kind==='layout'&&issue.pageIndex===index);
  pageList.setCurrent(index);showStatus();
 }
 function selectPage(next,issue=null){
  if(saving)return;
  const changed=next!==index||!!highlight||!!issue;
  index=next;highlight=issue;notice='';
  for(const button of q('issues').querySelectorAll('[aria-current]'))button.removeAttribute('aria-current');
  if(changed)show();else showStatus();
 }
 function update(next,to){
  ({pages,issues}=next);
  revision++;
  index=to;highlight=null;notice=next.notice??'';
  showIssues();
  q('edit').hidden=pages.length<2||!onEdit;
  q('page').replaceChildren(...pages.map((page,i)=>new Option((i+1)+' / '+pages.length,String(i))));
  pageList.render(pages,palette);
  show();
 }
 function moveItem(item,from,to){
  if(saving||!onMove||from===to)return;
  try{
   update(onMove(item,to,pages),to);
   pageList.focus(to);
  }catch(error){notice=error.message;showStatus();}
 }
 function changeOrder(kind,from,to){
  if(saving)return;
  try{
   const next=onPageOrder(kind,from,to,pages);
   update(next,next.index);
   pageList.focus(next.index);
  }catch(error){notice=error.message;showStatus();}
 }
 q('prev').onclick=()=>{if(index>0)selectPage(index-1);};
 q('next').onclick=()=>{if(index<pages.length-1)selectPage(index+1);};
 q('page').onchange=()=>selectPage(Number(q('page').value));
 q('fit-page').onclick=()=>{
  if(saving)return;
  try{
   update(onFit(index,pages),index);
   q('host').focus({preventScroll:true});
  }catch(error){notice=error.message;showStatus();}
 };
 q('edit').onclick=()=>{
  if(saving)return;
  const issue=highlight;
  dialog.close();
  if(issue?.kind==='view-overlap')onIssue(issue);
  else onEdit(index);
 };
 q('close').onclick=()=>{if(!saving)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 dialog.addEventListener('close',()=>{
  revision++;viewport.cancel();pages=[];issues=[];highlight=null;notice='';pageList.clear();
  q('host').replaceChildren();q('issues').replaceChildren();
 });
 q('save').onclick=async()=>{
  if(saving||blocked||!pages.length)return;
  saving=true;q('save').disabled=true;pageList.syncButtons();
  try{await download(pages,palette);}
  catch(error){q('status').textContent='PDF保存に失敗しました。'+error.message;}
  finally{saving=false;q('save').disabled=blocked;pageList.syncButtons();}
 };

 function showIssues(){
  const check=q('check'),rows=q('issues');
  check.hidden=!issues.length;check.open=!!issues.length;
  const counts={overlap:0,'view-overlap':0,reference:0,layout:0};
  for(const issue of issues)counts[issue.kind]++;
  const categories=[['overlap','寸法の重なり'],['view-overlap','図の重なり'],['reference','参照先を要確認'],['layout','配置を要調整']];
  q('check-summary').textContent='出力前チェック　'+categories.filter(([key])=>counts[key])
   .map(([key,label])=>label+' '+counts[key]+' 件').join(' ／ ');
  rows.replaceChildren(...issues.map(issue=>{
   const button=document.createElement('button');
   button.type='button';button.dataset.pdfIssue=issue.kind;
   button.textContent=(issue.pageIndex+1)+' ページ · '+issue.label;
   button.onclick=()=>{
    if(saving)return;
    if(issue.kind==='layout'||issue.kind==='view-overlap'){
     selectPage(issue.pageIndex,issue);
     button.setAttribute('aria-current','true');
     return;
    }
    dialog.close();onIssue(issue);
   };
   return button;
  }));
  blocked=counts.layout>0;
  q('save').disabled=blocked;
  q('save').title=blocked?'はみ出しや表題欄との重なりを調整してから保存してください':'';
 }
 return {
  async open(next,nextPalette,nextIssues=[]){
   palette=nextPalette;
   dialog.showModal();update({pages:next,issues:nextIssues},0);
   const token=revision;
   try{
    await Promise.all([...new Set(pages.flatMap(page=>(page.notes??[page.note]).filter(Boolean).map(note=>note.font)))].map(loadDrawingCommentFont));
    if(dialog.open&&token===revision)show({reset:false});
   }catch(error){if(token===revision)q('status').textContent='フォントを読み込めませんでした。'+error.message;}
  },
  close(){if(dialog.open)dialog.close();},
 };
}
