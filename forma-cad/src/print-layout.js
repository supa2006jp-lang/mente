// Pack conservative XY footprints; Z-axis quarter turns preserve print orientation.
import {Matrix4,Vector3} from 'three';
export const PRINT_PLATE_SIZE=180;
const EPS=1e-6;
export function planPrintLayout(items,{margin=2,gap=3,allowRotation=true}={}){
 if(!Number.isFinite(margin)||margin<0||margin>20||!Number.isFinite(gap)||gap<0||gap>30||typeof allowRotation!=='boolean')throw Error('端の余白は0〜20 mm、部品の間隔は0〜30 mmで指定してください');
 if(!Array.isArray(items)||!items.length||items.length>100||new Set(items.map(b=>b.id)).size!==items.length)throw Error('配置するボディを1〜100個指定してください');
 const usable=PRINT_PLATE_SIZE-2*margin;
 const rectangles=items.map((b,index)=>{if(typeof b.id!=='string'||!b.id||![b.min,b.max].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||b.min.some((v,i)=>b.max[i]-v<=0))throw Error('ボディの寸法を取得できません');const width=b.max[0]-b.min[0],height=b.max[1]-b.min[1];if(width>usable+EPS||height>usable+EPS)throw Error((b.name||'ボディ')+'（'+width.toFixed(2)+' × '+height.toFixed(2)+' mm）が、余白を除いた'+usable.toFixed(2)+' mm四方を超えています。余白を減らすかモデルを分割してください');return {...b,index,width:Math.min(width,usable),height:Math.min(height,usable)};});
 if(rectangles.reduce((sum,b)=>sum+b.width*b.height,0)>usable*usable+EPS)throw Error('部品の占有面積がプレートを超えています。印刷するボディを減らしてください');
 function attempt(order,heuristic){
  let free=[{x:0,y:0,w:usable+gap,h:usable+gap}];const placed=[];
  for(const b of order){let best=null;
   for(const f of free)for(const rotation of allowRotation?[0,90]:[0]){const w=(rotation?b.height:b.width)+gap,h=(rotation?b.width:b.height)+gap;if(w>f.w+EPS||h>f.h+EPS)continue;const short=Math.min(f.w-w,f.h-h),long=Math.max(f.w-w,f.h-h),score=heuristic===0?[short,long,f.y,f.x,rotation]:heuristic===1?[f.w*f.h-w*h,short,f.y,f.x,rotation]:[f.y+h,f.x,short,long,rotation];if(!best||score.some((v,i)=>Math.abs(v-best.score[i])>EPS&&score.slice(0,i).every((x,j)=>Math.abs(x-best.score[j])<=EPS)&&v<best.score[i]))best={x:f.x,y:f.y,w,h,rotation,score};}
   if(!best)return null;
   const next=[];
   for(const f of free){if(best.x>=f.x+f.w-EPS||best.x+best.w<=f.x+EPS||best.y>=f.y+f.h-EPS||best.y+best.h<=f.y+EPS){next.push(f);continue;}
    if(best.x>f.x+EPS)next.push({...f,w:best.x-f.x});
    if(best.x+best.w<f.x+f.w-EPS)next.push({...f,x:best.x+best.w,w:f.x+f.w-best.x-best.w});
    if(best.y>f.y+EPS)next.push({...f,h:best.y-f.y});
    if(best.y+best.h<f.y+f.h-EPS)next.push({...f,y:best.y+best.h,h:f.y+f.h-best.y-best.h});
   }
   const contains=(a,b)=>a.x<=b.x+EPS&&a.y<=b.y+EPS&&a.x+a.w>=b.x+b.w-EPS&&a.y+a.h>=b.y+b.h-EPS;
   free=next.filter((a,i)=>!next.some((b,j)=>i!==j&&contains(b,a)&&(!contains(a,b)||j<i)));
   placed.push({b,...best,width:best.w-gap,height:best.h-gap});
  }
  const width=Math.max(...placed.map(p=>p.x+p.width)),height=Math.max(...placed.map(p=>p.y+p.height));return {placed,width,height};
 }
 const sorts=[b=>b.width*b.height,b=>Math.max(b.width,b.height),b=>b.height,b=>b.width];let best=null;
 for(const sort of sorts){const order=[...rectangles].sort((a,b)=>sort(b)-sort(a)||a.index-b.index);for(let h=0;h<3;h++){const result=attempt(order,h);if(result&&(!best||result.width*result.height<best.width*best.height-EPS))best=result;}}

 // Try alternate free-rectangle corners for small, tightly packed sets.
 // The bounded search handles arrangements such as four interlocking rectangles.
 if(!best&&rectangles.length<=8){let budget=4000;const order=[...rectangles].sort((a,b)=>b.width*b.height-a.width*a.height||a.index-b.index);
  function search(index,free,placed){if(--budget<0)return null;if(index===order.length)return {placed,width:Math.max(...placed.map(p=>p.x+p.width)),height:Math.max(...placed.map(p=>p.y+p.height))};const b=order[index],seen=new Set();
   for(const f of free)for(const rotation of allowRotation?[0,90]:[0]){const w=(rotation?b.height:b.width)+gap,h=(rotation?b.width:b.height)+gap;if(w>f.w+EPS||h>f.h+EPS)continue;
    for(const x of [f.x,f.x+f.w-w])for(const y of [f.y,f.y+f.h-h]){const key=[x,y,rotation].map(v=>v.toFixed(6)).join(':');if(seen.has(key))continue;seen.add(key);const used={x,y,w,h},next=[];
     for(const r of free){if(x>=r.x+r.w-EPS||x+w<=r.x+EPS||y>=r.y+r.h-EPS||y+h<=r.y+EPS){next.push(r);continue;}if(x>r.x+EPS)next.push({...r,w:x-r.x});if(x+w<r.x+r.w-EPS)next.push({...r,x:x+w,w:r.x+r.w-x-w});if(y>r.y+EPS)next.push({...r,h:y-r.y});if(y+h<r.y+r.h-EPS)next.push({...r,y:y+h,h:r.y+r.h-y-h});}
     const contains=(a,b)=>a.x<=b.x+EPS&&a.y<=b.y+EPS&&a.x+a.w>=b.x+b.w-EPS&&a.y+a.h>=b.y+b.h-EPS,pruned=next.filter((a,i)=>!next.some((r,j)=>i!==j&&contains(r,a)&&(!contains(a,r)||j<i)));
     const result=search(index+1,pruned,[...placed,{b,...used,rotation,width:w-gap,height:h-gap}]);if(result)return result;if(budget<0)return null;
    }
   }return null;
  }
  best=search(0,[{x:0,y:0,w:usable+gap,h:usable+gap}],[]);
  if(best){const minX=Math.min(...best.placed.map(p=>p.x)),minY=Math.min(...best.placed.map(p=>p.y));best.placed.forEach(p=>{p.x-=minX;p.y-=minY;});best.width-=minX;best.height-=minY;}
 }
 if(!best)throw Error('この配置方法では全てを180 mm四方に収められません。部品の間隔・端の余白を減らすか、印刷するボディを減らしてください');
 const placements=best.placed.map(p=>{const {b,rotation}=p,pivot=b.min.map((v,i)=>(v+b.max[i])/2),x=p.x-best.width/2,y=p.y-best.height/2;return {id:b.id,name:b.name,rotation,pivot,translation:[x-(pivot[0]-p.width/2),y-(pivot[1]-p.height/2),-b.min[2]],min:[x,y,0],max:[x+p.width,y+p.height,b.max[2]-b.min[2]],sourceMin:b.min,sourceMax:b.max};}).sort((a,b)=>items.findIndex(x=>x.id===a.id)-items.findIndex(x=>x.id===b.id));
 return {size:PRINT_PLATE_SIZE,margin,gap,allowRotation,used:{width:best.width,height:best.height},placements};
}
export function printLayoutBounds(bodies,targets){
 if(!Array.isArray(targets)||!targets.length||targets.length>100||new Set(targets).size!==targets.length||targets.some(id=>typeof id!=='string'||!bodies.has(id)))throw Error('配置するボディが見つかりません');
 return targets.map(id=>{const box=bodies.get(id).boundingBox;try{const [min,max]=box.bounds;return {id,min,max};}finally{box.delete();}});
}

export const printOrientations=[
 ['z+','現在の上向き'],['z-','上下反転'],['x+','X＋を上に'],['x-','X−を上に'],['y+','Y＋を上に'],['y-','Y−を上に'],
];
const printRotations={
 'z+':new Matrix4(),'z-':new Matrix4().makeRotationX(Math.PI),
 'x+':new Matrix4().makeRotationY(-Math.PI/2),'x-':new Matrix4().makeRotationY(Math.PI/2),
 'y+':new Matrix4().makeRotationX(Math.PI/2),'y-':new Matrix4().makeRotationX(-Math.PI/2),
};
for(const matrix of Object.values(printRotations))matrix.elements=matrix.elements.map(Math.round);
const plateQuarterTurn=new Matrix4().set(0,-1,0,0,1,0,0,0,0,0,1,0,0,0,0,1);
const noRotation=new Matrix4();
export function printPlacementMatrix({translation,pivot,rotation,orientation='z+'},{plateCoordinates=false}={}){
 const [x,y,z]=translation,[px,py,pz]=pivot,offset=plateCoordinates?PRINT_PLATE_SIZE/2:0;
 return new Matrix4().makeTranslation(x+offset,y+offset,z)
  .multiply(new Matrix4().makeTranslation(px,py,pz))
  .multiply(rotation===90?plateQuarterTurn:noRotation)
  .multiply(new Matrix4().makeTranslation(-px,-py,-pz)).multiply(printRotations[orientation]);
}

export function validatePrintPlan(spec){
 const {targets,orientations={}}=spec;
 if(!Array.isArray(targets)||!targets.length||targets.length>100||new Set(targets).size!==targets.length||
  targets.some(id=>typeof id!=='string'||!id)||!orientations||Array.isArray(orientations)||typeof orientations!=='object'||
  Object.entries(orientations).some(([id,value])=>!targets.includes(id)||!Object.hasOwn(printRotations,value)))
  throw Error('印刷するボディと向きを確認してください');
 return orientations;
}

export function planPrintPlates(items,spec){
 const orientations=validatePrintPlan({...spec,targets:items.map(item=>item.id)});
 const oriented=items.map(item=>{
  const orientation=Object.hasOwn(orientations,item.id)?orientations[item.id]:'z+';
  if(orientation==='z+')return {...item,orientation};
  const matrix=printRotations[orientation],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const x of [item.min[0],item.max[0]])for(const y of [item.min[1],item.max[1]])for(const z of [item.min[2],item.max[2]]){
   const point=new Vector3(x,y,z).applyMatrix4(matrix).toArray();
   point.forEach((value,i)=>{min[i]=Math.min(min[i],value);max[i]=Math.max(max[i],value);});
  }
  return {...item,min,max,orientation};
 });
 const byId=new Map(oriented.map(item=>[item.id,item]));
 for(const item of oriented)if(item.max[2]-item.min[2]>PRINT_PLATE_SIZE+EPS)
  throw Error((item.name||item.id)+' はこの印刷向きで高さ180 mmを超えています');
 const place=plate=>({...plate,placements:plate.placements.map(p=>({...p,orientation:byId.get(p.id).orientation}))});
 // First try the existing full-plate packing. For multiple plates, add larger
 // parts first and keep each plate's last valid arrangement.
 try{return {plates:[place(planPrintLayout(oriented,spec))]};}catch{
  const area=item=>(item.max[0]-item.min[0])*(item.max[1]-item.min[1]);
  const plates=[];
  for(const item of [...oriented].sort((a,b)=>area(b)-area(a))){
   const single=planPrintLayout([item],spec);
   let placed=false;
   for(const plate of plates){
    try{plate.plan=planPrintLayout([...plate.items,item],spec);}
    catch{continue;}
    plate.items.push(item);placed=true;break;
   }
   if(!placed)plates.push({items:[item],plan:single});
  }
  return {plates:plates.map(plate=>place(plate.plan))};
 }
}
