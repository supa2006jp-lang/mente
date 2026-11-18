import {drawingViewVisible} from './drawing-view-preferences.js';
import {withDetails} from './drawing-annotations.js';
import {optimizeDrawingLayout} from './drawing-auto-layout.js';
import {drawingSheet} from './drawing-sheet.js';

export function assignedDrawingPDFPages(data,scale,hidden,dimensions,comment,options){
 const assignment=options.pageAssignments??{pageCount:2,views:{},comments:{}};
 const names=Object.keys(withDetails(data,options.details).views).filter(name=>drawingViewVisible(name,options));
 const notes=[{id:'comment',text:comment},...(options.comments||[])].filter(note=>note.text.trim());
 const pageOf=(kind,id)=>Math.min(assignment.pageCount,assignment[kind]?.[id]??(
  kind==='views'&&(id.startsWith('section-')||id.startsWith('detail-'))?2:1));
 const pages=[];
 for(let page=1;page<=assignment.pageCount;page++){
  const views=names.filter(name=>pageOf('views',name)===page);
  const selected=notes.filter(note=>pageOf('comments',note.id)===page);
  const text=selected.some(note=>note.id==='comment')?comment:'';
  const table=!!options.holeTable&&Math.min(assignment.holeTable??1,assignment.pageCount)===page;
  const pageOptions={...options,pageViews:views,pageHoleTable:table,
   comments:(options.comments||[]).filter(note=>selected.some(item=>item.id===note.id)),layout:'compact'};
  try{
   const result=views.length||selected.length||table?optimizeDrawingLayout(data,{scale,dimensions:dimensions.filter(d=>views.includes(d.view)),comment:text,options:pageOptions}):
    {scale,dimensions:[],positions:{},paper:options.paper==='auto'?'A4':options.paper};
   pages.push(drawingSheet(data,result.scale,hidden,result.dimensions,text,{...pageOptions,paper:result.paper,positions:result.positions,
    pageNumber:page,pageCount:assignment.pageCount}));
  }catch(error){throw Error(page+' ページ目を配置できません。'+error.message);}
 }
 return pages;
}

export function drawingPDFPages(data,scale,hidden,dimensions,comment,options){
 if(options.pdfLayout==='manual')return assignedDrawingPDFPages(data,scale,hidden,dimensions,comment,options);
 const names=Object.keys(withDetails(data,options.details).views).filter(name=>drawingViewVisible(name,options));
 const overview=names.filter(name=>!name.startsWith('section-')&&!name.startsWith('detail-'));
 const auxiliary=names.filter(name=>!overview.includes(name));
 const hasTable=!!options.holeTable&&overview.includes(options.holeTable.view);
 const pages=[];
 function fit(views,table,notes,pageComments=false){
  const pageOptions={...options,pageViews:views,pageHoleTable:table,pageComments,layout:'compact'};
  const pageDimensions=dimensions.filter(d=>views.includes(d.view));
  const result=optimizeDrawingLayout(data,{scale,dimensions:pageDimensions,comment:notes,options:pageOptions});
  pages.push({options:{...pageOptions,paper:result.paper,positions:result.positions},
   scale:result.scale,dimensions:result.dimensions,comment:notes});
 }
 fit(overview,false,comment,true);
 const blocks=[...auxiliary,...(hasTable?['holeTable']:[])];
 function fitAuxiliary(items){
  if(!items.length)return;
  try{fit(items.filter(x=>x!=='holeTable'),items.includes('holeTable'),'');}
  catch(error){
   if(items.length===1)throw error;
   const mid=Math.ceil(items.length/2);
   fitAuxiliary(items.slice(0,mid));fitAuxiliary(items.slice(mid));
  }
 }
 fitAuxiliary(blocks);
 return pages.map(({options,scale,dimensions,comment},index)=>
  drawingSheet(data,scale,hidden,dimensions,comment,{...options,pageNumber:index+1,pageCount:pages.length}));
}
