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
 return snapDrawingEdges(delta,[[box.x,box.x+box.width],[box.y,box.y+box.height]],targets,[1.5,1.5]);
}

export function snapDrawingViewTitle(delta,name,sheet,pixelsPerAxis){
 const {x,y}=sheet.viewTitles[name];
 const rows=Object.entries(sheet.viewTitles).filter(([id])=>id!==name).map(([,title])=>title.y);
 return snapDrawingEdges(delta,[[x],[y]],[[sheet.layout[name].x],rows],pixelsPerAxis.map(pixels=>8/pixels));
}

function snapDrawingEdges(delta,edges,targets,tolerance){
 const guides=[];
 const moved=delta.map((offset,axis)=>{
  let nearest=0,limit=tolerance[axis],position;
  for(const edge of edges[axis])for(const target of targets[axis]){
   const correction=target-(edge+offset);
   if(Math.abs(correction)>=limit)continue;
   limit=Math.abs(correction);nearest=correction;position=target;
  }
  if(position!==undefined)guides.push({axis,position});
  return offset+nearest;
 });
 return {delta:moved,guides};
}
