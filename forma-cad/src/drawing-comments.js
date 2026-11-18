import {TEXT_FONTS} from './text-fonts.js';

const graphemes=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
let measureContext;
export const drawingCommentMargin=7;

function wrapText(text,limit,advance){
 const lines=[];
 let width=0;
 for(const paragraph of String(text).replace(/\r\n?/g,'\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').split('\n')){
  let line='',used=0;
  for(const part of graphemes?.segment(paragraph)??paragraph){
   const glyph=part.segment??part,step=advance(glyph);
   if(line&&used+step>limit+1e-7){
    lines.push(line);width=Math.max(width,used);line='';used=0;
   }
   line+=glyph;used+=step;
  }
  lines.push(line);width=Math.max(width,used);
 }
 return {lines,width};
}

const estimatedAdvance=(glyph,size,font)=>(glyph.codePointAt(0)>255||font&&/[MW@%]/.test(glyph)?1:.65)*size;
export function commentLines(text,width=60,size=3.5,font){
 return wrapText(text,width,glyph=>estimatedAdvance(glyph,size,font)).lines;
}

function commentAdvances(size,font){
 if(typeof document==='undefined')return glyph=>estimatedAdvance(glyph,size,font);
 measureContext??=document.createElement('canvas').getContext('2d');
 measureContext.font='100px '+drawingCommentFamily(font);
 const widths=new Map();
 return glyph=>{
  if(!widths.has(glyph))widths.set(glyph,measureContext.measureText(glyph).width*size/100);
  return widths.get(glyph);
 };
}

export function drawingCommentLayout(text,fontSize,font,maxWidth=Infinity){
 if(!text.trim())return null;
 fontSize??=3.5;
 const {width,lines}=wrapText(text,maxWidth,commentAdvances(fontSize,font));
 const baseline=fontSize*1.2,lineHeight=fontSize*10/7;
 return {width,lines,font,fontSize,baseline,lineHeight,height:fontSize*1.8+(lines.length-1)*lineHeight};
}

export function drawingCommentEntries(text,options={},maxWidth){
 return [
  {id:'comment',text,size:options.commentSize,font:options.commentFont,color:options.commentColor},
  ...(options.pageComments===false?[]:options.comments||[]),
 ].filter(note=>note.text.trim()).map(note=>({...note,...drawingCommentLayout(note.text,note.size,note.font,maxWidth)}));
}

export function drawingCommentPlacementIssue(box,{width,height,contentBottom,titleBlock}){
 const bottom=titleBlock?height-5:contentBottom;
 const right=box.x+box.width,lower=box.y+box.height;
 if(box.x<4.99||box.y<16.99||right>width-4.99||lower>bottom+.01)return 'paper';
 if(titleBlock&&box.x<titleBlock.x+titleBlock.width&&right>titleBlock.x&&
  box.y<titleBlock.y+titleBlock.height&&lower>titleBlock.y)return 'titleBlock';
 return null;
}

const fonts=new Map(TEXT_FONTS.map(font=>[font.id,font]));
const loaded=new Map();
export const defaultDrawingCommentColor='#111111';
export const hasDrawingCommentFont=id=>fonts.has(id);
export function drawingCommentFamily(id){
 const font=fonts.get(id);
 return font?'"Forma comment '+font.id+'", sans-serif':'sans-serif';
}
export function loadDrawingCommentFont(id){
 const font=fonts.get(id);
 if(!font)return Promise.resolve();
 if(!loaded.has(id)){
  const face=new FontFace('Forma comment '+id,'url("fonts/'+font.file+'")');
  const pending=face.load().then(result=>{document.fonts.add(result);}).catch(error=>{loaded.delete(id);throw error;});
  loaded.set(id,pending);
 }
 return loaded.get(id);
}
