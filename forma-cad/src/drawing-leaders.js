import {drawingPaperPoint,drawingPointOmitted} from './drawing-break.js';
import {commentLines} from './drawing-comments.js';
import {escapeDrawingText} from './drawing-dimensions.js';

export const maxDrawingLeaders=32;
export const maxDrawingLeaderText=240;
const size=3.2,lineHeight=4.6;
const textWidth=line=>[...line].reduce((width,c)=>width+(c.codePointAt(0)>255?1:.68)*size,0);
export function drawingLeaderLayout(note,view){
 if(note.review||!view||drawingPointOmitted(view,note.anchor))return null;
 const anchor=drawingPaperPoint(view,note.anchor),at=drawingPaperPoint(view,note.at);
 const lines=commentLines(note.text,57,size),side=at[0]>=anchor[0]?1:-1;
 const end=[at[0]-side*2,at[1]-.9],elbow=[end[0]-side*5,end[1]];
 const width=Math.max(...lines.map(textWidth)),label={
  x:side>0?at[0]:at[0]-width,y:at[1]-size,width,height:size*1.4+(lines.length-1)*lineHeight,
 };
 const x=Math.min(label.x,anchor[0]-1,elbow[0]),y=Math.min(label.y,anchor[1]-1,elbow[1]);
 const bounds={x,y,width:Math.max(label.x+label.width,anchor[0]+1,elbow[0])-x,height:Math.max(label.y+label.height,anchor[1]+1,elbow[1])-y};
 return {anchor,at,lines,side,end,elbow,label,bounds};
}
export function drawingLeadersSVG(leaders,views){
 return leaders.map(note=>{
  const layout=drawingLeaderLayout(note,views[note.view]);
  if(!layout)return '';
  const {anchor,at,lines,side,end,elbow}=layout;
  const dx=elbow[0]-anchor[0],dy=elbow[1]-anchor[1],length=Math.hypot(dx,dy)||1;
  const u=[dx/length,dy/length],shaft=[anchor[0]+2.3*u[0],anchor[1]+2.3*u[1]];
  const wing=sign=>[shaft[0]-sign*.7*u[1],shaft[1]+sign*.7*u[0]].join(' ');
  const labels=lines.map((line,i)=>'<text x="'+at[0]+'" y="'+(at[1]+i*lineHeight)+'" font-size="'+size+'" text-anchor="'+(side>0?'start':'end')+'" xml:space="preserve">'+escapeDrawingText(line)+'</text>').join('');
  return '<g data-leader="'+note.id+'" fill="#24455b"><path d="M '+anchor.join(' ')+' L '+elbow.join(' ')+' L '+end.join(' ')+'" stroke="#24455b" stroke-width=".22" fill="none"/>'+
   '<path d="M '+anchor.join(' ')+' L '+wing(1)+' L '+wing(-1)+' Z"/>'+labels+'</g>';
 }).join('');
}
