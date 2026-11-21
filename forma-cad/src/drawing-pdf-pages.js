import {drawingViewVisible} from './drawing-view-preferences.js';
import {withDetails} from './drawing-annotations.js';
import {drawingViewFrames,optimizeDrawingLayout,rescaleDrawingAnnotations} from './drawing-auto-layout.js';
import {drawingSheet} from './drawing-sheet.js';

const isAuxiliaryView=name=>name.startsWith('section-')||name.startsWith('detail-');

function auxiliaryPDFItems(views,holeTable){
 const items=views.filter(isAuxiliaryView);
 if(holeTable&&views.includes(holeTable.view)&&!isAuxiliaryView(holeTable.view))items.push('holeTable');
 return items;
}

export function drawingPDFHasMultiplePages(views,{pdfLayout,pageAssignments,holeTable}){
 if(pdfLayout==='manual')return (pageAssignments?.pageCount??2)>1;
 return pdfLayout==='multi'&&auxiliaryPDFItems(views,holeTable).length>0;
}

function layoutPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet,layouts){
 const keep=options.pdfPlacement!=='auto';
 const overrides=options.pdfPositions??{};
 const source=keep?(editorSheet??drawingSheet(data,scale,hidden,dimensions,comment,options)):null;
 const positions=source?Object.fromEntries([
  ...Object.entries(source.layout).map(([id,view])=>[id,[view.x,view.y]]),
  ...(source.holeBox?[['holeTable',[source.holeBox.x,source.holeBox.y]]]:[]),
 ]):null;
 const comments=(options.comments??[]).filter(note=>note.text.trim());
 const names=Object.keys(withDetails(data,options.details).views).filter(name=>drawingViewVisible(name,options));
 const pages=[];
 let originalFrames;

 function add(views,table,text,notes){
  const dimensionIndices=[];
  const selected=new Set(views);
  let pageDimensions=dimensions.filter((d,index)=>{
   if(!selected.has(d.view))return false;
   dimensionIndices.push(index);
   return true;
  });
  const pageOptions={...options,pageViews:views,pageHoleTable:table,comments:notes,detailDimensionSources:dimensions};
  const specified=options.pdfPageScales?.[pages.length+1];
  const pageScale=specified??scale;
  const resized=views.filter(id=>options.pdfViewScales?.[id]!==undefined);
  if(resized.length)pageOptions.viewScales={...options.viewScales,...Object.fromEntries(resized.map(id=>[id,options.pdfViewScales[id]]))};
  if(pageScale!==scale||resized.length){
   originalFrames??=drawingViewFrames(data,options,scale);
   pageDimensions=rescaleDrawingAnnotations(pageDimensions,drawingViewFrames(data,pageOptions,pageScale),scale,pageScale,originalFrames);
  }
  const noteIds=notes.map(note=>note.id).concat(text.trim()?['comment']:[]);
  if(source){
   const pageNotes=source.notes.filter(note=>noteIds.includes(note.id)).map(note=>{
    const at=overrides[note.id];
    return at?{...note,x:at[0],y:at[1]}:note;
   });
   pages.push({scale:pageScale,dimensions:pageDimensions,dimensionIndices,comment:text,options:{...pageOptions,positions:{...positions,...overrides},
    pageSize:[source.width,source.height],pageNotes}});
   return;
  }
  pageOptions.layout='compact';
  const fixedScale=specified!==undefined;
  const items=[...views,...noteIds,...(table?['holeTable']:[])];
  const positioned=fixedScale&&items.every(id=>overrides[id]);
  const key=layouts&&!positioned&&JSON.stringify([views,table,text,noteIds,pageScale,resized.map(id=>options.pdfViewScales[id]),fixedScale]);
  let result=layouts?.get(key);
  if(!result){
   result=!positioned&&items.length?optimizeDrawingLayout(data,{scale:pageScale,dimensions:pageDimensions,comment:text,options:pageOptions,fixedScale}):null;
   result??={scale:pageScale,dimensions:pageDimensions,positions:{},paper:options.paper==='auto'?'A4':options.paper};
   if(key)layouts.set(key,result);
  }
  pages.push({scale:result.scale,dimensions:result.dimensions,dimensionIndices,comment:text,
   options:{...pageOptions,paper:result.paper,positions:{...result.positions,...overrides}}});
 }

 function render(){
  return pages.map((page,index)=>({
   ...drawingSheet(data,page.scale,hidden,page.dimensions.map((d,i)=>{
    const placed=dimensions[page.dimensionIndices[i]].pdfPlacement;
    return placed?{...d,at:placed.at,alongOffset:placed.alongOffset}:d;
   }),page.comment,{...page.options,pageNumber:index+1,pageCount:pages.length}),
   dimensionIndices:page.dimensionIndices,
   pageScale:page.scale,
  }));
 }

 return {names,comments,add,render};
}

export function assignedDrawingPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet,layouts){
 const assignment=options.pageAssignments??{pageCount:2,views:{},comments:{}};
 const {names,comments,add,render}=layoutPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet,layouts);
 const pageOf=(kind,id)=>Math.min(assignment.pageCount,assignment[kind]?.[id]??(
  kind==='views'&&isAuxiliaryView(id)?2:1));
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

export function drawingPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet,layouts){
 if(options.pdfLayout==='manual')return assignedDrawingPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet,layouts);
 const {names,comments,add,render}=layoutPDFPages(data,scale,hidden,dimensions,comment,options,editorSheet,layouts);
 const overview=names.filter(name=>!isAuxiliaryView(name));
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
 fitAuxiliary(auxiliaryPDFItems(names,options.holeTable));
 return render();
}
