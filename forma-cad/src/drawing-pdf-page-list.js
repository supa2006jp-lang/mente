import {drawingPDFPageItems} from './drawing-pdf-pages.js';
import {drawingPrintSVG} from './drawing-print-palette.js';

export function installDrawingPDFPageList(host,{viewLabel,selectPage,moveItem,canEdit}){
 host.innerHTML='<div class="drawing-pdf-thumbnails" role="list" aria-label="PDFのページ一覧"></div>'+
  '<small>項目を別のページへドラッグするか、項目を選んで移動先を指定します。</small>'+
  '<div class="drawing-controls drawing-pdf-page-move" hidden><span></span><label>移動先<select></select></label>'+
  '<button type="button">移動</button></div>';
 const strip=host.firstElementChild,actions=host.lastElementChild,select=actions.querySelector('select');
 let cards=[],urls=[],chosen=null,dragged=null;

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
  clearChoice();clearDrag();cards=[];
  strip.replaceChildren();urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
  host.hidden=true;
 }
 function setCurrent(index){
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

 function render(pages,palette){
  clear();
  if(pages.length<2)return;
  host.hidden=false;
  cards=pages.map((page,index)=>{
   const node=document.createElement('div'),button=document.createElement('button'),image=document.createElement('img');
   const caption=document.createElement('strong'),items=document.createElement('div');
   node.className='drawing-pdf-page-card';node.dataset.pdfPage=String(index+1);node.setAttribute('role','listitem');
   button.type='button';button.className='drawing-pdf-page-thumb';button.onclick=()=>selectPage(index);
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
    control.ondragstart=event=>{
     if(!canEdit()){event.preventDefault();return;}
     dragged={item,from:index};
     event.dataTransfer.effectAllowed='move';
     event.dataTransfer.setData('application/x-forma-pdf-page-item','');
    };
    control.ondragend=clearDrag;
    items.append(control);
   }
   if(!items.childElementCount)items.textContent='空白ページ';
   node.ondragover=event=>{
    if(!dragged||dragged.from===index||!canEdit())return;
    event.preventDefault();event.dataTransfer.dropEffect='move';node.dataset.pageDrop='true';
   };
   node.ondragleave=event=>{if(!node.contains(event.relatedTarget))delete node.dataset.pageDrop;};
   node.ondrop=event=>{
    if(!dragged||dragged.from===index||!canEdit())return;
    event.preventDefault();
    const {item,from}=dragged;
    clearDrag();moveItem(item,from,index);
   };
   node.append(button,items);
   return {node,button};
  });
  strip.replaceChildren(...cards.map(card=>card.node));
 }
 return {render,setCurrent,clear,focus:index=>cards[index]?.button.focus({preventScroll:true})};
}
