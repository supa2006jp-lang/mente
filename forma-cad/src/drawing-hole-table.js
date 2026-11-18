import {drawingDimensionVisible,drawingPaperPoint,drawingPointOmitted} from './drawing-break.js';
import {drawingProjections} from './drawing-view-preferences.js';
import {completeDrawingCircles} from './drawing-auto-dimensions.js';

export const maxDrawingTableHoles=48;
// Keep the original 74 mm block width so saved sheet placements still fit.
const rowsPerBlock=24,columnWidths=[7,11.5,11.5,9,10,11.5,13.5],rowHeight=4.6;
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
  const print=(values,row)=>values.map((value,i)=>{
   const ems=Array.from(String(value)).reduce((width,ch)=>width+(ch.codePointAt(0)>255?1:.65),0);
   const size=Math.min(row?2.8:2.5,(columnWidths[i]-1)/ems);
   return text(value,left+widths[i]+columnWidths[i]/2,top+row*rowHeight+3.25,'middle',size);
  }).join('');
  labels+=print(['ID','X','Y','穴径 Ø','穴深さ','座ぐり径','座ぐり深さ'],0);
  for(let index=start;index<end;index++){
   const {center,radius,machining}=table.holes[index],recess=machining?.counterbore;
   const depth=machining?.through?'貫通':machining?rounded(machining.depth):'—';
   labels+=print(['H'+(index+1),rounded(center[0]-table.origin[0]),rounded(table.origin[1]-center[1]),
    rounded(radius*2),depth,recess?rounded(recess.radius*2):'—',recess?rounded(recess.depth):'—'],index-start+1);
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
function sameCircle(a,b,radius=b.radius){
 return Math.hypot(a.center[0]-b.center[0],a.center[1]-b.center[1])<1e-4&&Math.abs(a.radius-radius)<1e-4;
}
function resolveHoles(circles,view){
 const seen=new Set(),holes=[];
 for(const {center,radius} of circles){
  const circle={center,radius};
  const machining=view?.holeMachining?.find(bore=>sameCircle(circle,bore)||bore.counterbore&&sameCircle(circle,bore,bore.counterbore.radius));
  if(!machining){holes.push(circle);continue;}
  if(seen.has(machining))continue;
  seen.add(machining);
  holes.push({center,radius:machining.radius,machining});
 }
 return holes;
}
export function resolveDrawingHoleTable(table,views){
 return table&&!table.review?{...table,holes:resolveHoles(table.holes,views[table.view])}:table;
}
export function drawingTableHoles(view){
 const circles=completeDrawingCircles(view).sort((a,b)=>a.center[1]-b.center[1]||a.center[0]-b.center[0]||b.radius-a.radius);
 return resolveHoles(circles,view);
}
export function drawingHoleTableMatches(table,view){
 if(!view)return false;
 const current=completeDrawingCircles(view);
 return table.holes.every(hole=>current.some(c=>sameCircle(hole,c)));
}
