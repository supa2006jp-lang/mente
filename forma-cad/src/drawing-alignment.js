export const drawingAlignmentActions=[
 ['left','左端'],['center-x','左右中央'],['right','右端'],
 ['top','上端'],['center-y','上下中央'],['bottom','下端'],
 ['space-x','左右に等間隔'],['space-y','上下に等間隔'],
];

export function alignDrawingItems(items,action){
 if(items.length<2)return [];
 const vertical=['top','center-y','bottom','space-y'].includes(action);
 const coordinate=vertical?'y':'x',span=vertical?'height':'width';
 const start=Math.min(...items.map(item=>item.box[coordinate]));
 const end=Math.max(...items.map(item=>item.box[coordinate]+item.box[span]));
 const target=(start+end)/2;
 const offsets=new Map();
 if(action.startsWith('space-')){
  if(items.length<3)return [];
  const sorted=[...items].sort((a,b)=>a.box[coordinate]-b.box[coordinate]);
  const gap=(end-start-items.reduce((sum,item)=>sum+item.box[span],0))/(items.length-1);
  if(gap<0)throw Error('等間隔に並べる余地がありません。両端の項目を離してください');
  let position=start;
  for(const item of sorted){offsets.set(item.id,position-item.box[coordinate]);position+=item.box[span]+gap;}
 }else for(const item of items){
  const box=item.box;
  const offset=['left','top'].includes(action)?start-box[coordinate]:
   ['right','bottom'].includes(action)?end-box[coordinate]-box[span]:target-box[coordinate]-box[span]/2;
  offsets.set(item.id,offset);
 }
 return items.map(item=>({id:item.id,dx:vertical?0:offsets.get(item.id),dy:vertical?offsets.get(item.id):0}));
}
