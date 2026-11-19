import {drawingViewVisible} from './drawing-view-preferences.js';
import {withDetails} from './drawing-annotations.js';
import {optimizeDrawingLayout} from './drawing-auto-layout.js';
import {drawingSheet} from './drawing-sheet.js';

function layoutPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet){
 const keep=options.pdfPlacement!=='auto';
 const source=keep?(editorSheet??drawingSheet(data,scale,hidden,dimensions,comment,options)):null;
 const positions=source?Object.fromEntries([
  ...Object.entries(source.layout).map(([id,view])=>[id,[view.x,view.y]]),
  ...(source.holeBox?[['holeTable',[source.holeBox.x,source.holeBox.y]]]:[]),
 ]):null;
 const comments=(options.comments??[]).filter(note=>note.text.trim());
 const names=Object.keys(withDetails(data,options.details).views).filter(name=>drawingViewVisible(name,options));
 const pages=[];

 function add(views,table,text,notes){
  const dimensionIndices=[];
  const selected=new Set(views);
  const pageDimensions=dimensions.filter((d,index)=>{
   if(!selected.has(d.view))return false;
   dimensionIndices.push(index);
   return true;
  });
  const pageOptions={...options,pageViews:views,pageHoleTable:table,comments:notes};
  if(source){
   const noteIds=new Set(notes.map(note=>note.id));
   if(text.trim())noteIds.add('comment');
   pages.push({scale,dimensions:pageDimensions,dimensionIndices,comment:text,options:{...pageOptions,positions,
    pageSize:[source.width,source.height],pageNotes:source.notes.filter(note=>noteIds.has(note.id))}});
   return;
  }
  pageOptions.layout='compact';
  const result=views.length||text.trim()||notes.length||table?
   optimizeDrawingLayout(data,{scale,dimensions:pageDimensions,comment:text,options:pageOptions}):
   {scale,dimensions:[],positions:{},paper:options.paper==='auto'?'A4':options.paper};
  pages.push({scale:result.scale,dimensions:result.dimensions,dimensionIndices,comment:text,
   options:{...pageOptions,paper:result.paper,positions:result.positions}});
 }

 function render(){
  return pages.map((page,index)=>({
   ...drawingSheet(data,page.scale,hidden,page.dimensions,page.comment,{...page.options,pageNumber:index+1,pageCount:pages.length}),
   dimensionIndices:page.dimensionIndices,
  }));
 }

 return {names,comments,add,render};
}

export function assignedDrawingPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet){
 const assignment=options.pageAssignments??{pageCount:2,views:{},comments:{}};
 const {names,comments,add,render}=layoutPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet);
 const pageOf=(kind,id)=>Math.min(assignment.pageCount,assignment[kind]?.[id]??(
  kind==='views'&&(id.startsWith('section-')||id.startsWith('detail-'))?2:1));
 for(let page=1;page<=assignment.pageCount;page++){
  const views=names.filter(name=>pageOf('views',name)===page);
  const notes=comments.filter(note=>pageOf('comments',note.id)===page);
  const text=pageOf('comments','comment')===page?comment:'';
  const table=!!options.holeTable&&Math.min(assignment.holeTable??1,assignment.pageCount)===page;
  try{add(views,table,text,notes);}
  catch(error){throw Error(page+' ページ目を配置できません。'+error.message);}
 }
 return render();
}

export function drawingPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet){
 if(options.pdfLayout==='manual')return assignedDrawingPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet);
 const {names,comments,add,render}=layoutPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet);
 const overview=names.filter(name=>!name.startsWith('section-')&&!name.startsWith('detail-'));
 const auxiliary=names.filter(name=>!overview.includes(name));
 const hasTable=!!options.holeTable&&overview.includes(options.holeTable.view);
 add(overview,false,comment,comments);
 function fitAuxiliary(items){
  if(!items.length)return;
  try{add(items.filter(item=>item!=='holeTable'),items.includes('holeTable'),'',[]);}
  catch(error){
   if(items.length===1)throw error;
   const mid=Math.ceil(items.length/2);
   fitAuxiliary(items.slice(0,mid));fitAuxiliary(items.slice(mid));
  }
 }
 fitAuxiliary([...auxiliary,...(hasTable?['holeTable']:[])]);
 return render();
}
