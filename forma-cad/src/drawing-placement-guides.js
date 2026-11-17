export function snapDrawingPlacement(delta,box,sheet,{view,comment=false}={}){
 const bottom=comment&&sheet.titleBlock?sheet.height-5:sheet.contentBottom;
 const targets=[[5,sheet.width-5],[17,bottom]];
 const neighbors=Object.entries(sheet.layout).filter(([name])=>name!==view).map(([,other])=>other);
 if(comment&&sheet.titleBlock)neighbors.push(sheet.titleBlock);
 for(const {x,y,width,height} of neighbors){
  targets[0].push(x,x+width);
  targets[1].push(y,y+height);
 }
 for(const [name,title] of Object.entries(sheet.viewTitles||{}))if(name!==view)targets[1].push(title.y);
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
