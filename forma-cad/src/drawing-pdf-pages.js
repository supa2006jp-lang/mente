import {drawingViewVisible} from './drawing-view-preferences.js';
import {withDetails} from './drawing-annotations.js';
import {optimizeDrawingLayout} from './drawing-auto-layout.js';
import {drawingSheet} from './drawing-sheet.js';

export function drawingPDFPages(data,scale,hidden,dimensions,comment,options){
 const names=Object.keys(withDetails(data,options.details).views).filter(name=>drawingViewVisible(name,options));
 const overview=names.filter(name=>!name.startsWith('section-')&&!name.startsWith('detail-'));
 const auxiliary=names.filter(name=>!overview.includes(name));
 const hasTable=!!options.holeTable&&!options.holeTable.review&&overview.includes(options.holeTable.view);
 const pages=[];
 function fit(views,table,notes){
  const pageOptions={...options,pageViews:views,pageHoleTable:table,layout:'compact'};
  const pageDimensions=dimensions.filter(d=>views.includes(d.view));
  const result=optimizeDrawingLayout(data,{scale,dimensions:pageDimensions,comment:notes,options:pageOptions});
  pages.push({options:{...pageOptions,paper:result.paper,positions:result.positions},
   scale:result.scale,dimensions:result.dimensions,comment:notes});
 }
 fit(overview,false,comment);
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
