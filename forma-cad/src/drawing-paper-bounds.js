export const drawingFrameInset=5;
export const drawingTitleBlock=(width,height)=>({x:Math.max(10,width-165),y:height-32,width:160,height:27});

export function drawingBoxPlacementIssue(box,{width,height,contentBottom,titleBlock}){
 const inset=drawingFrameInset-.01;
 const right=box.x+box.width,lower=box.y+box.height;
 const bottom=titleBlock?height-drawingFrameInset:contentBottom;
 if(box.x<inset||box.y<inset||right>width-inset||lower>bottom+.01)return 'paper';
 if(titleBlock&&box.x<titleBlock.x+titleBlock.width&&right>titleBlock.x&&
  box.y<titleBlock.y+titleBlock.height&&lower>titleBlock.y)return 'titleBlock';
 return null;
}
