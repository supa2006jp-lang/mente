import {escapeDrawingText} from './drawing-dimensions.js';
import {drawingProjections,drawingScaleLabel} from './drawing-view-preferences.js';

const fontSize=3.1,accentOffset=3.15,height=5.8,border=.24;

export function drawingViewTitle(name,view,scale,options){
 const section=(options.sections||[]).findIndex(item=>item.id===name);
 const detail=(options.details||[]).findIndex(item=>item.id===name);
 let label=drawingProjections[name]?.label??'ISOMETRIC';
 if(section>=0){
  const letter=String.fromCharCode(65+section);
  label='断面 '+letter+'–'+letter;
 }else if(detail>=0){
  label='詳細 D'+(detail+1)+' / '+drawingScaleLabel(view.scale);
 }
 if(view.break)label+=' / 省略表示';
 if(detail<0&&(options.viewScales?.[name]!==undefined||Math.abs(view.scale-scale)>1e-10))label+=' / SCALE '+drawingScaleLabel(view.scale);
 const x=view.x+1.3,y=view.y-8.1;
 const textWidth=[...label].reduce((width,char)=>width+(/\s/.test(char)?.35:char.codePointAt(0)>255?1:/[MW]/.test(char)?.95:.72)*fontSize,0);
 const width=accentOffset+textWidth+1.7;
 return {label,x,y,width,height,bounds:{x:x-border/2,y:y-border/2,width:width+border,height:height+border}};
}

export function drawingViewTitleSVG({label,x,y,width,height}){
 const right=x+width,bottom=y+height,corner=1.15;
 return '<path data-view-title-frame="true" d="M '+x+' '+y+' H '+(right-corner)+' L '+right+' '+(y+corner)+
  ' V '+bottom+' H '+x+' Z" fill="white" stroke="#486071" stroke-width="'+border+'"/>'+
  '<path d="M '+(x+1.45)+' '+(y+1.2)+' V '+(bottom-1.2)+'" fill="none" stroke="#16879a" stroke-width=".63"/>'+
  '<text x="'+(x+accentOffset)+'" y="'+(y+3.95)+'" font-size="'+fontSize+'" font-weight="bold" fill="#20394c">'+escapeDrawingText(label)+'</text>';
}
