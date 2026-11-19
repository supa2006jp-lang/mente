const pixelsPerMillimeter=4,tileSize=160,tileStride=tileSize+1;
const lineworkSelector=[
 '[data-view] [data-curve]',
 '[data-view] [data-hatch]',
 '[data-view] > g[transform] > circle',
 '[data-break-marks] [data-break-edge]:not([stroke="transparent"])',
].join(',');

function strokeShape(element){
 if(element.localName==='path')return new Path2D(element.getAttribute('d'));
 const path=new Path2D(),n=name=>Number(element.getAttribute(name));
 if(element.localName==='circle')path.arc(n('cx'),n('cy'),n('r'),0,2*Math.PI);
 else path.rect(n('x'),n('y'),n('width'),n('height'));
 return path;
}

// Use the rendered SVG paths so that curves, dashes and clipped views match the sheet.
function drawingStrokes(svg,layout){
 const toPaper=svg.getScreenCTM().inverse(),groups=new Map();
 const transform=node=>toPaper.multiply(node.getScreenCTM());
 for(const element of svg.querySelectorAll(lineworkSelector)){
  const owner=element.hasAttribute('stroke-width')?element:element.parentElement;
  let group=groups.get(owner);
  if(!group){
   const clipped=owner.closest('[clip-path]'),clipId=clipped?.getAttribute('clip-path').slice(5,-1);
   const shape=clipId&&svg.getElementById(clipId)?.firstElementChild;
   const dash=owner.getAttribute('stroke-dasharray');
   group={
    path:new Path2D(),matrix:transform(owner),
    view:layout[owner.closest('[data-view]').dataset.view],
    width:Number(owner.getAttribute('stroke-width')),
    dash:dash?dash.trim().split(/\s+/).map(Number):[],
    clip:shape?{path:strokeShape(shape),matrix:transform(clipped)}:null,
   };
   groups.set(owner,group);
  }
  group.path.addPath(strokeShape(element));
 }
 return [...groups.values()];
}

export function drawingLineworkTest(svg,sheet){
 const strokes=drawingStrokes(svg,sheet.layout),tiles=new Map();
 const canvas=svg.ownerDocument.createElement('canvas');
 canvas.width=canvas.height=tileSize;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const scale=pixelsPerMillimeter;
 const right=Math.ceil(sheet.width*scale),bottom=Math.ceil(sheet.height*scale);
 function rasterize(x,y){
  const left=x/scale,top=y/scale,size=tileSize/scale;
  const visible=strokes.filter(({view:v})=>left<v.x+v.width+2&&left+size>v.x-2&&
   top<v.y+v.height+2&&top+size>v.y-2);
  if(!visible.length)return null;
  const transform=({a,b,c,d,e,f})=>ctx.setTransform(a*scale,b*scale,c*scale,d*scale,e*scale-x,f*scale-y);
  ctx.resetTransform();ctx.clearRect(0,0,tileSize,tileSize);
  ctx.lineCap=ctx.lineJoin='round';
  for(const {path,matrix,width,dash,clip} of visible){
   ctx.save();
   if(clip){transform(clip.matrix);ctx.clip(clip.path);}
   transform(matrix);ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke(path);
   ctx.restore();
  }
  // Summed areas let every candidate label check a rectangle without rereading pixels.
  const {data}=ctx.getImageData(0,0,tileSize,tileSize),sum=new Uint32Array(tileStride*tileStride);
  for(let row=1;row<=tileSize;row++){
   let count=0;
   for(let col=1;col<=tileSize;col++){
    if(data[4*((row-1)*tileSize+col-1)+3])count++;
    sum[row*tileStride+col]=sum[(row-1)*tileStride+col]+count;
   }
  }
  return sum;
 }
 function tile(x,y){
  const key=x+','+y;
  if(tiles.has(key))return tiles.get(key);
  const pixels=rasterize(x,y);
  if(tiles.size>=32)tiles.delete(tiles.keys().next().value);
  tiles.set(key,pixels);
  return pixels;
 }
 return box=>{
  const clearance=.15;
  const x0=Math.max(0,Math.floor((box.x-clearance)*scale)),x1=Math.min(right,Math.ceil((box.x+box.width+clearance)*scale));
  const y0=Math.max(0,Math.floor((box.y-clearance)*scale)),y1=Math.min(bottom,Math.ceil((box.y+box.height+clearance)*scale));
  if(x0>=x1||y0>=y1)return false;
  for(let y=Math.floor(y0/tileSize)*tileSize;y<y1;y+=tileSize){
   const a=Math.max(0,y0-y)*tileStride,b=Math.min(tileSize,y1-y)*tileStride;
   for(let x=Math.floor(x0/tileSize)*tileSize;x<x1;x+=tileSize){
    const sum=tile(x,y);
    if(!sum)continue;
    const l=Math.max(0,x0-x),r=Math.min(tileSize,x1-x);
    if(sum[b+r]-sum[a+r]-sum[b+l]+sum[a+l]>0)return true;
   }
  }
  return false;
 };
}
