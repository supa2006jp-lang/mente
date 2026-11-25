import {escapeDrawingText} from './drawing-dimensions.js';
import {drawingPaperPoint,drawingPointOmitted} from './drawing-break.js';
import {drawingFrameInset} from './drawing-paper-bounds.js';
import {drawingProjections,drawingScaleLabel} from './drawing-view-preferences.js';

const fontSize=3.1,accentOffset=3.15,titleHeight=5.8,border=.24;
const clearance=.35,sideGap=1.5;
export const compactDrawingViewTitleScale=.7;

export function drawingViewTitle(name,view,options,showScale,factor=1){
 const section=(options.sections||[]).findIndex(item=>item.id===name);
 const detail=(options.details||[]).findIndex(item=>item.id===name);
 let label=drawingProjections[name]?.label??'ISOMETRIC';
 if(section>=0){
  const letter=String.fromCharCode(65+section);
  label='断面 '+letter+'–'+letter;
 }else if(detail>=0){
  label='詳細 D'+(detail+1);
 }
 if(view.break)label+=' / 省略表示';
 if(showScale)label+=(detail>=0?' / ':' / SCALE ')+drawingScaleLabel(view.scale);
 const manual=options.viewTitlePositions?.[name];
 if(manual)factor=manual.compact?compactDrawingViewTitleScale:1;
 const textWidth=[...label].reduce((width,char)=>width+(/\s/.test(char)?.35:char.codePointAt(0)>255?1:/[MW]/.test(char)?.95:.72)*fontSize,0);
 const width=(accentOffset+textWidth+1.7)*factor,height=titleHeight*factor,stroke=border*factor;
 const x=view.x+1.3;
 const overSectionLetter=(options.sections??[]).some(cut=>{
  if(cut.view!==name||cut.review||cut.orientation!=='vertical')return false;
  const point=[cut.coordinate,view.by];
  if(drawingPointOmitted(view,point))return false;
  const [cutX]=drawingPaperPoint(view,point);
  return cutX+5.5>x&&cutX+2<x+width;
 });
 const gap=overSectionLetter?8.7:factor<1?.7:2.3;
 const y=view.y-height-gap;
 const title={label,x,y,width,height,factor,stroke,bounds:{x:x-stroke/2,y:y-stroke/2,width:width+stroke,height:height+stroke}};
 return manual?moveTitle(title,view.x+manual.offset[0],view.y+manual.offset[1]):title;
}

const clamp=(value,low,high)=>Math.max(low,Math.min(value,high));
const inset=drawingFrameInset+clearance;
const rightEdge=(paper,title)=>paper.width-inset-title.bounds.width;
const bottomEdge=(paper,title)=>(paper.titleBlock?paper.height-inset:paper.contentBottom-clearance)-title.bounds.height;
function moveTitle(title,x,y){
 return {...title,x:x+title.stroke/2,y:y+title.stroke/2,bounds:{...title.bounds,x,y}};
}

// Check the nearest positions at a free interval's endpoints in each available row.
function titleInBand(title,paper,obstacles,{left,right,top,bottom}){
 const {width,height}=title.bounds;
 const minX=Math.max(inset,left),maxX=Math.min(right,rightEdge(paper,title));
 const minY=Math.max(inset,top),maxY=Math.min(bottom,bottomEdge(paper,title));
 if(minX>maxX||minY>maxY)return null;
 const nearest=(values,origin,lo,hi)=>[...new Set(values.map(v=>clamp(v,lo,hi)))]
  .sort((a,b)=>Math.abs(a-origin)-Math.abs(b-origin));
 const ys=nearest([title.bounds.y,minY,maxY,...obstacles.flatMap(b=>[b.y-height-clearance,b.y+b.height+clearance])],
  title.bounds.y,minY,maxY);
 for(const y of ys){
  const blocked=obstacles.filter(b=>y<b.y+b.height+clearance-1e-8&&y+height>b.y-clearance+1e-8);
  const xs=nearest([title.bounds.x,minX,maxX,...blocked.flatMap(b=>[b.x-width-clearance,b.x+b.width+clearance])],
   title.bounds.x,minX,maxX);
  for(const x of xs){
   if(!blocked.some(b=>x<b.x+b.width+clearance-1e-8&&x+width>b.x-clearance+1e-8))return moveTitle(title,x,y);
  }
 }
 return null;
}

export function layoutDrawingViewTitles(layout,options,showScale,paper,annotations=[]){
 const titles={},views=Object.entries(layout).sort(([,a],[,b])=>a.y-b.y||a.x-b.x);
 const drawings=views.map(([,view])=>view),occupied=[paper.titleBlock,...annotations].filter(Boolean);
 for(const cut of options.sections??[]){
  const view=layout[cut.view];
  if(!view||cut.review||cut.orientation!=='vertical')continue;
  const point=[cut.coordinate,view.by];
  if(drawingPointOmitted(view,point))continue;
  const [x]=drawingPaperPoint(view,point);
  occupied.push({x:x+2,y:view.y-7.5,width:3.5,height:4});
 }
 for(const [name,view] of views){
  if(!options.viewTitlePositions?.[name])continue;
  const title=drawingViewTitle(name,view,options,showScale);
  const x=clamp(title.bounds.x,inset,rightEdge(paper,title));
  const table=paper.titleBlock,maxY=table&&x+title.bounds.width+clearance>table.x?
   table.y-clearance-title.bounds.height:bottomEdge(paper,title);
  titles[name]=moveTitle(title,x,clamp(title.bounds.y,inset,maxY));
  occupied.push(titles[name].bounds);
 }
 for(const [name,view] of views){
  if(titles[name])continue;
  const choices=[1,compactDrawingViewTitleScale].map(factor=>drawingViewTitle(name,view,options,showScale,factor));
  const obstacles=[...drawings,...occupied],right=view.x+view.width;
  const alignedX=title=>clamp(title.bounds.x,inset,rightEdge(paper,title));
  let placed=null;
  for(const title of choices){
   const left=alignedX(title);
   placed=titleInBand(title,paper,obstacles,{
    left,right:Math.max(left,right-6),top:title.bounds.y-3,bottom:view.y-title.bounds.height-clearance,
   });
   if(placed)break;
  }
  if(!placed)for(const title of choices){
   const top=view.y-2.3,bottom=view.y+8,left=view.x-title.bounds.width-sideGap;
   placed=titleInBand(title,paper,obstacles,{left:right+sideGap,right:right+10,top,bottom})??
    titleInBand(title,paper,obstacles,{left:left-8,right:left,top,bottom});
   if(placed)break;
  }
  if(!placed){
   // A view can fill the frame. In that case keep its compact caption inside its upper edge.
   const compact=choices[1],left=alignedX(compact);
   const inside={left,right:Math.max(left,right-compact.bounds.width-sideGap),top:view.y+sideGap,bottom:view.y+9};
   placed=titleInBand(compact,paper,[...drawings.filter(other=>other!==view),...occupied],inside);
   if(!placed){
    const top=paper.titleBlock&&left+compact.bounds.width+clearance>paper.titleBlock.x?paper.titleBlock.y-clearance-compact.bounds.height:bottomEdge(paper,compact);
    placed=moveTitle(compact,left,clamp(view.y+sideGap,inset,top));
   }
  }
  titles[name]=placed;occupied.push(placed.bounds);
 }
 return titles;
}

export function drawingViewTitleSVG({label,x,y,width,height,factor,stroke}){
 const right=x+width,bottom=y+height,corner=1.15*factor;
 return '<path data-view-title-frame="true"'+(factor<1?' data-view-title-compact="true"':'')+' d="M '+x+' '+y+' H '+(right-corner)+' L '+right+' '+(y+corner)+
  ' V '+bottom+' H '+x+' Z" fill="white" stroke="#486071" stroke-width="'+stroke+'"/>'+
  '<path d="M '+(x+1.45*factor)+' '+(y+1.2*factor)+' V '+(bottom-1.2*factor)+'" fill="none" stroke="#16879a" stroke-width="'+(.63*factor)+'" pointer-events="none"/>'+
  '<text data-view-title-label="true" x="'+(x+accentOffset*factor)+'" y="'+(y+3.95*factor)+'" font-size="'+(fontSize*factor)+'" font-weight="bold" fill="#20394c">'+escapeDrawingText(label)+'</text>';
}
