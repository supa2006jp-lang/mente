export const betweenPattern=p=>p.type==='rectangular'&&p.distribution==='between';
const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
export function rectangularOffsets(p,anchor=p.patternAnchor){
 if(betweenPattern(p)){
  if(!Number.isInteger(p.count)||p.count<2||p.count>60)throw Error('2点間の個数は、原型を含めて2〜60個にしてください');
  if(!point(p.startPoint)||!point(p.endPoint)||!point(anchor))throw Error('始点・終点と原型の中心を指定してください');
  if(Math.hypot(...p.endPoint.map((v,i)=>v-p.startPoint[i]))<1e-6)throw Error('始点と終点は異なる位置を指定してください');
  return Array.from({length:p.count},(_,i)=>p.startPoint.map((v,k)=>v+(p.endPoint[k]-v)*i/(p.count-1)-anchor[k]));
 }
 if(!Number.isInteger(p.count)||p.count<1||p.count>20||!Number.isInteger(p.count2)||p.count2<1||p.count2>20||p.count*p.count2>60||![p.spacing,p.spacing2].every(Number.isFinite))throw Error('個数と間隔を確認してください（各方向20個・合計60個まで）');
 return Array.from({length:p.count},(_,i)=>Array.from({length:p.count2},(_,j)=>[i*p.spacing,j*p.spacing2,0])).flat();
}
export function patternDragValue(raw,{step=10,snap=false,pixelsPerMm=1,fine=false}={}){
 let value=Math.max(-10000,Math.min(10000,raw));
 if(snap&&!fine&&step>0){const nearest=Math.round(value/step)*step;if(Math.abs(value-nearest)*pixelsPerMm<=6)value=nearest;}
 return Number(value.toFixed(2));
}
