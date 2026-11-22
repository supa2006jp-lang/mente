import {drawingFrameInset} from './drawing-paper-bounds.js';

export function snapDrawingDragAxis(delta,pixelsPerAxis,previousAxis){
 const distance=delta.map((value,axis)=>Math.abs(value*pixelsPerAxis[axis]));
 const travel=distance[0]>=distance[1]?0:1,axis=1-travel;
 const margin=axis===previousAxis?12:8;
 if(distance[axis]>margin||distance[axis]>distance[travel]/2)return {delta,axis:null};
 const snapped=[...delta];snapped[axis]=0;
 return {delta:snapped,axis};
}

export function snapDrawingPlacement(delta,box,sheet,{view,movingViews=[]}={}){
 const inset=drawingFrameInset;
 const bottom=sheet.titleBlock?sheet.height-inset:sheet.contentBottom;
 const targets=[[inset,sheet.width-inset],[inset,bottom]];
 const stationary=name=>name!==view&&!movingViews.includes(name);
 const neighbors=Object.entries(sheet.layout).filter(([name])=>stationary(name)).map(([,other])=>other);
 if(sheet.titleBlock)neighbors.push(sheet.titleBlock);
 for(const {x,y,width,height} of neighbors){
  targets[0].push(x,x+width);
  targets[1].push(y,y+height);
 }
 const guides=[];
 const moved=delta.map((offset,axis)=>{
  const start=axis?box.y:box.x,span=axis?box.height:box.width;
  let nearest=0,limit=1.5,position;
  for(const edge of [start,start+span])for(const target of targets[axis]){
   const correction=target-(edge+offset);
   if(Math.abs(correction)>=limit)continue;
   limit=Math.abs(correction);nearest=correction;position=target;
  }
  if(position!==undefined)guides.push({axis,position});
  return offset+nearest;
 });
 return {delta:moved,guides};
}
