import {escapeDrawingText} from './drawing-dimensions.js';
import {drawingPaperPoint,drawingPointOmitted} from './drawing-break.js';
import {drawingFrameInset} from './drawing-paper-bounds.js';
import {drawingProjections,drawingScaleLabel} from './drawing-view-preferences.js';

const fontSize=3.1,accentOffset=3.15,height=5.8,border=.24;

export function drawingViewTitle(name,view,options,showScale,paper){
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
 const textWidth=[...label].reduce((width,char)=>width+(/\s/.test(char)?.35:char.codePointAt(0)>255?1:/[MW]/.test(char)?.95:.72)*fontSize,0);
 const width=accentOffset+textWidth+1.7;
 const inset=drawingFrameInset+border/2,maxX=paper?paper.width-inset-width:Infinity;
 let x=paper?Math.max(inset,Math.min(view.x+1.3,maxX)):view.x+1.3;
 const overSectionLetter=(options.sections??[]).some(cut=>{
  if(cut.view!==name||cut.orientation!=='vertical')return false;
  const point=[cut.coordinate,view.by];
  if(drawingPointOmitted(view,point))return false;
  const [cutX]=drawingPaperPoint(view,point);
  return cutX+5.5>x&&cutX+2<x+width;
 });
 let y=view.y-(overSectionLetter?14.5:8.1);
 if(paper){
  const table=paper.titleBlock;
  const bottom=table?(x+width+border/2<=table.x?paper.height-drawingFrameInset:table.y):paper.contentBottom;
  const maxY=bottom-height-border/2,below=view.y+view.height+2.3;
  if(y<inset){
   const right=view.x+view.width+2.3,left=view.x-width-2.3;
   if(below<=maxY)y=below;
   else if(right<=maxX)x=right;
   else if(left>=inset)x=left;
  }
  y=Math.max(inset,Math.min(y,maxY));
 }
 return {label,x,y,width,height,bounds:{x:x-border/2,y:y-border/2,width:width+border,height:height+border}};
}

export function drawingViewTitleSVG({label,x,y,width,height}){
 const right=x+width,bottom=y+height,corner=1.15;
 return '<path data-view-title-frame="true" d="M '+x+' '+y+' H '+(right-corner)+' L '+right+' '+(y+corner)+
  ' V '+bottom+' H '+x+' Z" fill="white" stroke="#486071" stroke-width="'+border+'"/>'+
  '<path d="M '+(x+1.45)+' '+(y+1.2)+' V '+(bottom-1.2)+'" fill="none" stroke="#16879a" stroke-width=".63"/>'+
  '<text x="'+(x+accentOffset)+'" y="'+(y+3.95)+'" font-size="'+fontSize+'" font-weight="bold" fill="#20394c">'+escapeDrawingText(label)+'</text>';
}
