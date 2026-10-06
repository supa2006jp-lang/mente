// Layout is shared by the geometry engine and the dimension editor.
export function slideDividerLayout(p,length,width){
 const compartments=p.dividerCompartments??2,direction=p.dividerDirection??'short',thickness=p.dividerThickness??2.4,sizing=p.dividerSizing??'offset';
 if(!Number.isInteger(compartments)||compartments<2||compartments>4)throw Error('収納部分は2〜4分割で指定してください');
 if(!['short','long'].includes(direction))throw Error('仕切りの向きを選択してください');
 if(!Number.isFinite(thickness)||thickness<1.2||thickness>1000)throw Error('仕切りの厚さは1.2〜1000 mmで指定してください');
 if(!['offset','width'].includes(sizing))throw Error('仕切りの指定方法を選択してください');
 if(![length,width].every(v=>Number.isFinite(v)&&v>0))throw Error('対象ボディの寸法を確認してください');
 const index=direction==='short'?0:1,span=index===0?length:width,available=span-(compartments-1)*thickness,equal=available/compartments;
 const equalPositions=Array.from({length:compartments-1},(_,i)=>-span/2+(i+1)*equal+(i+.5)*thickness);
 let positions,offsets,requestedWidths=null;
 if(sizing==='width'){
  requestedWidths=p.dividerWidths??Array(compartments-1).fill(equal);
  if(!Array.isArray(requestedWidths)||requestedWidths.length!==compartments-1||!requestedWidths.every(v=>Number.isFinite(v)&&v>=6))throw Error('指定する部屋の幅はそれぞれ6 mm以上にしてください');
  let cursor=-span/2;positions=requestedWidths.map(v=>{cursor+=v+thickness;return cursor-thickness/2;});offsets=positions.map((v,i)=>v-equalPositions[i]);
 }else{
  offsets=p.dividerOffsets??Array(compartments-1).fill(0);
  if(!Array.isArray(offsets)||offsets.length!==compartments-1||!offsets.every(Number.isFinite))throw Error('各仕切りの位置を正しい数値で指定してください');
  positions=offsets.map((v,i)=>equalPositions[i]+v);
 }
 const compartmentWidths=Array.from({length:compartments},(_,i)=>(i===compartments-1?span/2:positions[i]-thickness/2)-(i===0?-span/2:positions[i-1]+thickness/2));
 if(Math.min(...compartmentWidths)<6-1e-6)throw Error(sizing==='width'?'最後の部屋に6 mm以上を残してください。入力した部屋の幅か仕切りの厚さを小さくしてください':'仕切りを入れる空間が足りません。各部屋に6 mm以上を残してください。位置を戻すか仕切りを薄くしてください');
 return {compartments,direction,thickness,sizing,index,span,available,equal,positions,offsets:[...offsets],requestedWidths:requestedWidths?[...requestedWidths]:null,compartmentWidths};
}
