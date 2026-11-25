import {escapeDrawingText} from './drawing-dimensions.js';
import {drawingPaperPoint,drawingPointOmitted} from './drawing-break.js';
import {drawingFrameInset} from './drawing-paper-bounds.js';
import {drawingProjections,drawingScaleLabel} from './drawing-view-preferences.js';

const fontSize=3.1,accentOffset=3.15,titleHeight=5.8,border=.24;

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
 // At the top edge, the paper margin can hold a smaller caption above the drawing.
 const useTopMargin=paper&&view.y<drawingFrameInset+titleHeight+border+.3;
 const factor=useTopMargin?.75:1;
 const width=(accentOffset+textWidth+1.7)*factor,height=titleHeight*factor,stroke=border*factor;
 const inset=drawingFrameInset+border/2,maxX=paper?paper.width-inset-width:Infinity;
 const x=paper?Math.max(inset,Math.min(view.x+1.3,maxX)):view.x+1.3;
 const overSectionLetter=(options.sections??[]).some(cut=>{
  if(cut.view!==name||cut.orientation!=='vertical')return false;
  const point=[cut.coordinate,view.by];
  if(drawingPointOmitted(view,point))return false;
  const [cutX]=drawingPaperPoint(view,point);
  return cutX+5.5>x&&cutX+2<x+width;
 });
 let y=view.y-(overSectionLetter?14.5:8.1);
 if(useTopMargin){
  y=(drawingFrameInset-height)/2;
 }else if(paper){
  const table=paper.titleBlock;
  const bottom=table?(x+width+border/2<=table.x?paper.height-drawingFrameInset:table.y):paper.contentBottom;
  const maxY=bottom-height-border/2;
  y=Math.max(inset,Math.min(y,maxY));
 }
 return {label,x,y,width,height,factor,stroke,bounds:{x:x-stroke/2,y:y-stroke/2,width:width+stroke,height:height+stroke}};
}

export function drawingViewTitleSVG({label,x,y,width,height,factor,stroke}){
 const right=x+width,bottom=y+height,corner=1.15*factor;
 return '<path data-view-title-frame="true" d="M '+x+' '+y+' H '+(right-corner)+' L '+right+' '+(y+corner)+
  ' V '+bottom+' H '+x+' Z" fill="white" stroke="#486071" stroke-width="'+stroke+'"/>'+
  '<path d="M '+(x+1.45*factor)+' '+(y+1.2*factor)+' V '+(bottom-1.2*factor)+'" fill="none" stroke="#16879a" stroke-width="'+(.63*factor)+'"/>'+
  '<text x="'+(x+accentOffset*factor)+'" y="'+(y+3.95*factor)+'" font-size="'+(fontSize*factor)+'" font-weight="bold" fill="#20394c">'+escapeDrawingText(label)+'</text>';
}
