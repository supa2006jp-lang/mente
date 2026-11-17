import {drawingDimensionVisible,drawingPaperPoint,drawingPointOmitted} from './drawing-break.js';
import {drawingProjections} from './drawing-view-preferences.js';
import {completeDrawingCircles} from './drawing-auto-dimensions.js';

export const maxDrawingTableHoles=48;
const rowsPerBlock=24,columnWidths=[11,21,21,21],rowHeight=4.6;
const blockWidth=columnWidths.reduce((a,b)=>a+b,0);
const rounded=n=>Number(n.toFixed(3));
const text=(s,x,y,anchor='start',size=2.8)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-size="'+size+'">'+s+'</text>';
const line=(x,y,endX,endY)=>'<path d="M '+x+' '+y+' L '+endX+' '+endY+'"/>';
export function drawingHoleTableSize(table,views){
 if(!table||table.review||!views[table.view])return null;
 return {width:blockWidth*Math.ceil(table.holes.length/rowsPerBlock),height:6+(1+Math.min(table.holes.length,rowsPerBlock))*rowHeight};
}
export function drawingHoleTableSVG(table,box){
 if(!box)return '';
 const {x,y,width,height}=box;
 let grid='<rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" fill="white"/>';
 let labels=text('穴位置表 / '+drawingProjections[table.view].label+' / mm',x+2,y+4);
 for(let start=0;start<table.holes.length;start+=rowsPerBlock){
  const left=x+start/rowsPerBlock*blockWidth,top=y+6,end=Math.min(start+rowsPerBlock,table.holes.length),rows=end-start;
  const widths=columnWidths.map((_,i)=>columnWidths.slice(0,i).reduce((a,b)=>a+b,0));
  for(const offset of [...widths,blockWidth])grid+=line(left+offset,top,left+offset,top+(rows+1)*rowHeight);
  for(let index=0;index<=rows+1;index++)grid+=line(left,top+rowHeight*index,left+blockWidth,top+rowHeight*index);
  const print=(values,row)=>values.map((value,i)=>text(value,left+widths[i]+columnWidths[i]/2,top+row*rowHeight+3.25,'middle')).join('');
  labels+=print(['ID','X','Y','Ø'],0);
  for(let index=start;index<end;index++){
   const {center,radius}=table.holes[index];
   labels+=print(['H'+(index+1),rounded(center[0]-table.origin[0]),rounded(table.origin[1]-center[1]),rounded(radius*2)],index-start+1);
  }
 }
 return '<g data-hole-table="true"><g stroke="#24455b" stroke-width=".2" fill="none">'+grid+'</g>'+labels+'</g>';
}
export function drawingHoleMarkers(table,view){
 if(!view||!table||table.review)return [];
 const marks=[];
 if(!drawingPointOmitted(view,table.origin))marks.push({label:'O',point:drawingPaperPoint(view,table.origin),origin:true});
 table.holes.forEach((hole,index)=>{
  if(drawingDimensionVisible(hole,view))marks.push({label:'H'+(index+1),point:drawingPaperPoint(view,hole.center)});
 });
 return marks;
}
export function drawingHoleMarkersSVG(table,view){
 const markers=drawingHoleMarkers(table,view);
 if(!markers.length)return '';
 const ids=markers.map(({label,point:[x,y],origin})=>{
  const cross='<g fill="none" stroke="#24455b" stroke-width=".24">'+line(x-1.4,y,x+1.4,y)+line(x,y-1.4,x,y+1.4)+
   (origin?line(x,y,x+6,y)+line(x,y,x,y-6):'')+'</g>';
  return cross+text(label,x+1.6,y-1.5)+(origin?text('X',x+6.4,y+.8)+text('Y',x-1,y-6.6):'');
 }).join('');
 return '<g data-hole-labels="'+table.view+'" fill="#24455b">'+ids+'</g>';
}
export function drawingTableHoles(view){
 return completeDrawingCircles(view).sort((a,b)=>a.center[1]-b.center[1]||a.center[0]-b.center[0]||b.radius-a.radius);
}
export function drawingHoleTableMatches(table,view){
 if(!view)return false;
 const current=drawingTableHoles(view);
 return table.holes.every(hole=>current.some(c=>Math.hypot(c.center[0]-hole.center[0],c.center[1]-hole.center[1])<1e-4&&Math.abs(c.radius-hole.radius)<1e-4));
}
