export const betweenPattern=p=>p.type==='rectangular'&&p.distribution==='between';
const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
export function betweenPatternLayout(p,anchor=p.patternAnchor,extent=p.patternExtent){
 if(!Number.isInteger(p.count)||p.count<2||p.count>60)throw Error('2点間の個数は、原型を含めて2〜60個にしてください');
 if(!point(p.startPoint)||!point(p.endPoint)||!point(anchor))throw Error('始点・終点と原型の中心を指定してください');
 const delta=p.endPoint.map((v,i)=>v-p.startPoint[i]),distance=Math.hypot(...delta);if(distance<1e-6)throw Error('始点と終点は異なる位置を指定してください');
 const inside=p.betweenAlignment==='inside',direction=delta.map(v=>v/distance);let first=0,spacing=distance/(p.count-1),width=null,gap=null;
 if(inside){
  if(!extent||![extent.min,extent.max].every(Number.isFinite)||extent.max<=extent.min)throw Error('配置方向のソリッドの寸法を取得できません');
  width=extent.max-extent.min;const free=distance-p.count*width;
  if(free< -1e-6)throw Error('この2点間には収まりません。'+p.count+'個を配置するには '+(p.count*width).toFixed(2)+' mm以上必要です（現在 '+distance.toFixed(2)+' mm）');
  gap=Math.max(0,free)/(p.count+1);first=gap-extent.min;spacing=width+gap;
 }
 return {distance,width,gap,spacing,offsets:Array.from({length:p.count},(_,i)=>p.startPoint.map((v,k)=>v+direction[k]*(first+spacing*i)-anchor[k]))};
}
export function rectangularOffsets(p,anchor=p.patternAnchor){
 if(betweenPattern(p)){
  return betweenPatternLayout(p,anchor).offsets;
 }
 if(!Number.isInteger(p.count)||p.count<1||p.count>20||!Number.isInteger(p.count2)||p.count2<1||p.count2>20||p.count*p.count2>60||![p.spacing,p.spacing2].every(Number.isFinite))throw Error('個数と間隔を確認してください（各方向20個・合計60個まで）');
 return Array.from({length:p.count},(_,i)=>Array.from({length:p.count2},(_,j)=>[i*p.spacing,j*p.spacing2,0])).flat();
}
export function patternDragValue(raw,{step=10,snap=false,pixelsPerMm=1,fine=false}={}){
 let value=Math.max(-10000,Math.min(10000,raw));
 if(snap&&!fine&&step>0){const nearest=Math.round(value/step)*step;if(Math.abs(value-nearest)*pixelsPerMm<=6)value=nearest;}
 return Number(value.toFixed(2));
}
