import {drawingCommentPlacementIssue} from './drawing-comments.js';
import {dimensionPlacement,drawingDimensionConflicts} from './drawing-dimension-layout.js';
import {dimensionLabel} from './drawing-dimensions.js';
import {drawingProjections} from './drawing-view-preferences.js';

export const drawingSheetItems='[data-view],[data-dimension],[data-detail-dimension],[data-comment],[data-marker],[data-section],[data-detail],[data-hole-table],[data-hole-labels],[data-leader]';

export function drawingSheetOverflow(svg,sheet){
 const issues=[];
 for(const [itemIndex,element] of svg.querySelectorAll(drawingSheetItems).entries()){
  const view=sheet.layout[element.dataset.view];
  let box;
  if(view){
   const title=sheet.viewTitles[element.dataset.view];
   const x=Math.min(view.x,title.x),y=Math.min(view.y,title.y);
   box={x,y,width:Math.max(view.x+view.width,title.x+title.width)-x,
    height:Math.max(view.y+view.height,title.y+title.height)-y};
  }else box=element.getBBox();
  const reason=element.dataset.comment?drawingCommentPlacementIssue(box,sheet):
   box.x<4.99||box.y<16.99||box.x+box.width>sheet.width-4.99||box.y+box.height>sheet.contentBottom+.01?'paper':null;
  if(reason)issues.push({element,itemIndex,box,reason});
 }
 return issues;
}

export function drawingOverflowOutline(svg,box){
 const outline=document.createElementNS(svg.namespaceURI,'rect');
 const attributes={x:box.x-.65,y:box.y-.65,width:box.width+1.3,height:box.height+1.3,
  'data-overflow-outline':'true',fill:'none','aria-hidden':'true'};
 for(const [key,value] of Object.entries(attributes))outline.setAttribute(key,value);
 svg.append(outline);
 return outline;
}

function overlapRegion(a,b){
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
 const width=Math.min(a.x+a.width,b.x+b.width)-x,height=Math.min(a.y+a.height,b.y+b.height)-y;
 return width>1e-6&&height>1e-6?{x,y,width,height}:null;
}

export function drawingViewOverlaps(sheet){
 const views=Object.entries(sheet.layout).map(([name,view])=>({name,areas:[view,sheet.viewTitles?.[name]].filter(Boolean)}));
 const issues=[];
 for(const [index,a] of views.entries())for(const b of views.slice(index+1)){
  const regions=a.areas.flatMap(area=>b.areas.map(other=>overlapRegion(area,other)).filter(Boolean));
  if(!regions.length)continue;
  const x=Math.min(...regions.map(region=>region.x)),y=Math.min(...regions.map(region=>region.y));
  const width=Math.max(...regions.map(region=>region.x+region.width))-x;
  const height=Math.max(...regions.map(region=>region.y+region.height))-y;
  issues.push({views:[a.name,b.name],regions,box:{x,y,width,height}});
 }
 return issues;
}

export function markDrawingViewOverlap(svg,regions,focused=false){
 for(const region of regions){
  const outline=svg.ownerDocument.createElementNS(svg.namespaceURI,'rect');
  for(const [key,value] of Object.entries({...region,'data-view-overlap-outline':focused?'focused':'true',
   'pointer-events':'none','aria-hidden':'true'}))outline.setAttribute(key,value);
  svg.append(outline);
 }
}

function viewName(view){
 if(drawingProjections[view])return drawingProjections[view].title+'図';
 return view?.startsWith('section-')?'断面図':view?.startsWith('detail-')?'詳細図':'俯瞰図';
}

function pageItemName(element,indices){
 const {view,dimension,detailDimension,comment,marker,section,detail,holeTable,holeLabels}=element.dataset;
 if(view)return viewName(view);
 if(dimension!==undefined)return '寸法 '+((indices?.[Number(dimension)]??Number(dimension))+1);
 if(detailDimension)return '詳細図の寸法';
 if(comment)return 'コメント';
 if(marker)return '中心表示';
 if(section)return '切断線';
 if(detail)return '詳細範囲';
 if(holeTable)return '穴位置表';
 if(holeLabels)return '穴の番号・基準点';
 return '矢印付き注記';
}

export function drawingPDFIssues(pages,{checkBounds=false,labelView=viewName}={}){
 const issues=[];
 let measurement;
 if(checkBounds){
  measurement=document.createElement('div');
  Object.assign(measurement.style,{position:'fixed',left:'-10000px',top:'0',visibility:'hidden',pointerEvents:'none'});
  document.body.append(measurement);
 }
 try{
  for(const [pageIndex,page] of pages.entries()){
   const dimensions=page.dimensions??[],indices=page.dimensionIndices;
   const addDimension=(kind,index,reason)=>{
    const d=dimensions[index],dimension=indices?.[index]??index;
    issues.push({kind,pageIndex,dimension,label:viewName(d.view)+' 寸法 '+(dimension+1)+'（'+reason+'）'});
   };
   for(const {index,reason} of drawingDimensionConflicts(dimensions,page)){
    addDimension('overlap',index,dimensionLabel(dimensions[index])+' · '+reason);
   }
   for(const issue of drawingViewOverlaps(page)){
    issues.push({kind:'view-overlap',pageIndex,...issue,label:issue.views.map(labelView).join(' と ')+' の重なり'});
   }
   for(const [index,d] of dimensions.entries()){
    if(d.review&&dimensionPlacement(d,page))addDimension('reference',index,'参照先を要確認');
   }
   if(page.holeBox)for(const [index,hole] of page.holeTable.holes.entries()){
    if(!hole.review)continue;
    const id='H'+(hole.number??index+1);
    issues.push({kind:'reference',pageIndex,hole:id,label:'穴位置表 '+id+'（参照先を要確認）'});
   }
   if(measurement){
    measurement.innerHTML=page.svg;
    for(const {element,itemIndex,box,reason} of drawingSheetOverflow(measurement.firstElementChild,page)){
     const label=pageItemName(element,indices)+(reason==='titleBlock'?'（表題欄と重なり）':'（用紙からはみ出し）');
     issues.push({kind:'layout',pageIndex,label,itemIndex,box});
    }
   }
  }
 }finally{measurement?.remove();}
 return issues;
}
