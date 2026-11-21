import {drawingPDFPageItems,maxDrawingPDFPages} from './drawing-pdf-pages.js';
import {drawingPrintSVG} from './drawing-print-palette.js';

export function installDrawingPDFPageList(host,{viewLabel,selectPage,moveItem,changeOrder,canEdit}){
 host.innerHTML='<div class="drawing-controls drawing-pdf-page-tools" role="group" aria-label="ページの編集">'+
  '<button type="button" id="drawing-pdf-preview-add-page">＋ ページを追加</button>'+
  '<button type="button" id="drawing-pdf-preview-page-earlier" hidden>前へ移動</button>'+
  '<button type="button" id="drawing-pdf-preview-page-later" hidden>後ろへ移動</button>'+
  '<button type="button" id="drawing-pdf-preview-remove-page" hidden>空白ページを削除</button></div>'+
  '<div class="drawing-pdf-thumbnails" role="list" aria-label="PDFのページ一覧"></div>'+
  '<small>縮小見本をドラッグするとページ順が変わります。図やコメントは別のページにドラッグできます。</small>'+
  '<div class="drawing-controls drawing-pdf-page-move" hidden><span></span><label>移動先<select></select></label>'+
  '<button type="button">移動</button></div>';
 const [tools,strip,help,actions]=host.children,[add,earlier,later,remove]=tools.children;
 const select=actions.querySelector('select');
 let cards=[],urls=[],chosen=null,dragged=null,current=0,count=0;

 function syncButtons(){
  const editable=canEdit(),multi=count>1;
  add.disabled=!editable||count>=maxDrawingPDFPages;
  add.title=count>=maxDrawingPDFPages?'ページは '+maxDrawingPDFPages+' 枚までです':'';
  earlier.hidden=later.hidden=!multi;
  earlier.disabled=!editable||current===0;
  later.disabled=!editable||current>=count-1;
  remove.hidden=!multi||!cards[current]?.empty;
  remove.disabled=!editable;
 }
 add.onclick=()=>changeOrder('add',current);
 earlier.onclick=()=>changeOrder('reorder',current,current-1);
 later.onclick=()=>changeOrder('reorder',current,current+1);
 remove.onclick=()=>changeOrder('remove',current);

 function clearChoice(){
  chosen?.button.setAttribute('aria-pressed','false');
  chosen=null;
  actions.hidden=true;
 }
 function clearDrag(){
  dragged=null;
  for(const card of cards)delete card.node.dataset.pageDrop;
 }
 function clear(){
  clearChoice();clearDrag();cards=[];count=0;
  strip.replaceChildren();urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
  host.hidden=true;
 }
 function setCurrent(index){
  current=index;syncButtons();
  if(chosen&&chosen.from!==index)clearChoice();
  for(const [i,{button}] of cards.entries()){
   if(i===index)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  }
  cards[index]?.node.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 function choose(button,item,from,label){
  if(!canEdit())return;
  selectPage(from);
  clearChoice();
  chosen={button,item,from};
  button.setAttribute('aria-pressed','true');
  actions.firstElementChild.textContent=label;
  select.replaceChildren(...cards.flatMap((_,i)=>i===from?[]:[new Option((i+1)+' ページ',String(i))]));
  actions.hidden=false;select.focus({preventScroll:true});
 }
 actions.querySelector('button').onclick=()=>{
  if(chosen&&canEdit())moveItem(chosen.item,chosen.from,Number(select.value));
 };
 function startDrag(event,payload){
  if(!canEdit()){event.preventDefault();return;}
  dragged=payload;
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('application/x-forma-pdf-'+(payload.item?'item':'page'),'');
 }

 function render(pages,palette){
  clear();
  host.hidden=false;
  count=pages.length;
  strip.hidden=help.hidden=count<2;
  if(count<2)return;
  cards=pages.map((page,index)=>{
   const node=document.createElement('div'),button=document.createElement('button'),image=document.createElement('img');
   const caption=document.createElement('strong'),items=document.createElement('div');
   node.className='drawing-pdf-page-card';node.dataset.pdfPage=String(index+1);node.setAttribute('role','listitem');
   button.type='button';button.className='drawing-pdf-page-thumb';button.onclick=()=>selectPage(index);
   button.draggable=true;button.title='ドラッグでページ順を変更';
   button.ondragstart=event=>startDrag(event,{from:index});
   button.ondragend=clearDrag;
   image.alt='';image.draggable=false;image.loading='lazy';image.decoding='async';
   const url=URL.createObjectURL(new Blob([drawingPrintSVG(page.svg,palette)],{type:'image/svg+xml'}));
   urls.push(url);image.src=url;
   caption.textContent=(index+1)+' ページ';button.append(image,caption);
   items.className='drawing-pdf-page-contents';
   for(const item of drawingPDFPageItems(page)){
    const control=document.createElement('button');
    const label=item.kind==='views'?viewLabel(item.id):item.kind==='table'?'穴位置表':
     (item.id==='comment'?'共通コメント':'コメント')+' · '+item.text.trim().split(/\r?\n/,1)[0];
    control.type='button';control.draggable=true;control.dataset.pageItem=item.id;
    control.textContent=control.title=label;
    control.setAttribute('aria-pressed','false');
    control.onclick=()=>choose(control,item,index,label);
    control.ondragstart=event=>startDrag(event,{item,from:index});
    control.ondragend=clearDrag;
    items.append(control);
   }
   const empty=!items.childElementCount;
   if(empty)items.textContent='空白ページ';
   node.ondragover=event=>{
    if(!dragged||dragged.from===index||!canEdit())return;
    event.preventDefault();event.dataTransfer.dropEffect='move';node.dataset.pageDrop=dragged.item?'item':'page';
   };
   node.ondragleave=event=>{if(!node.contains(event.relatedTarget))delete node.dataset.pageDrop;};
   node.ondrop=event=>{
    if(!dragged||dragged.from===index||!canEdit())return;
    event.preventDefault();
    const {item,from}=dragged;
    clearDrag();
    if(item)moveItem(item,from,index);
    else changeOrder('reorder',from,index);
   };
   node.append(button,items);
   return {node,button,empty};
  });
  strip.replaceChildren(...cards.map(card=>card.node));
 }
 return {render,setCurrent,syncButtons,clear,focus:index=>(cards[index]?.button??add).focus({preventScroll:true})};
}
