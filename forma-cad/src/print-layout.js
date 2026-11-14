// Pack conservative XY footprints; Z-axis quarter turns preserve print orientation.
import {Matrix4,Vector3} from 'three';
export const PRINT_PLATE_SIZE=180;
const EPS=1e-6;
const overlaps=(a,b)=>a.x<b.x+b.w-EPS&&b.x<a.x+a.w-EPS&&a.y<b.y+b.h-EPS&&b.y<a.y+a.h-EPS;
function subtractFree(free,used){
 const next=[];
 for(const f of free){
  if(!overlaps(f,used)){next.push(f);continue;}
  const right=used.x+used.w,top=used.y+used.h;
  if(used.x>f.x+EPS)next.push({...f,w:used.x-f.x});
  if(right<f.x+f.w-EPS)next.push({...f,x:right,w:f.x+f.w-right});
  if(used.y>f.y+EPS)next.push({...f,h:used.y-f.y});
  if(top<f.y+f.h-EPS)next.push({...f,y:top,h:f.y+f.h-top});
 }
 const contains=(a,b)=>a.x<=b.x+EPS&&a.y<=b.y+EPS&&a.x+a.w>=b.x+b.w-EPS&&a.y+a.h>=b.y+b.h-EPS;
 return next.filter((a,i)=>!next.some((b,j)=>i!==j&&contains(b,a)&&(!contains(a,b)||j<i)));
}
const placementExtent=placements=>({
 width:placements.length?Math.max(...placements.map(p=>p.max[0]))-Math.min(...placements.map(p=>p.min[0])):0,
 height:placements.length?Math.max(...placements.map(p=>p.max[1]))-Math.min(...placements.map(p=>p.min[1])):0,
});
export function movePrintPlacement(plate,id,dx,dy){
 const original=plate.placements.find(p=>p.id===id);
 if(!original||original.locked||![dx,dy].every(Number.isFinite))return null;
 const shift=point=>[point[0]+dx,point[1]+dy,point[2]],moved={...original,min:shift(original.min),max:shift(original.max),translation:shift(original.translation)};
 const limit=plate.size/2-plate.margin;
 if([0,1].some(i=>moved.min[i]<-limit-EPS||moved.max[i]>limit+EPS))return null;
 const padded=p=>({x:p.min[0],y:p.min[1],w:p.max[0]-p.min[0]+plate.gap,h:p.max[1]-p.min[1]+plate.gap});
 if(plate.placements.some(p=>p!==original&&overlaps(padded(p),padded(moved))))return null;
 const placements=plate.placements.map(p=>p===original?moved:p);
 return {...plate,placements,used:placementExtent(placements)};
}
export function centerPrintPlacements(plate){
 if(!plate.placements.length||plate.placements.some(p=>p.locked))return plate;
 const offset=[0,1].map(i=>-(Math.min(...plate.placements.map(p=>p.min[i]))+Math.max(...plate.placements.map(p=>p.max[i])))/2);
 if(offset.every(value=>Math.abs(value)<=EPS))return plate;
 const shift=([x,y,z])=>[x+offset[0],y+offset[1],z];
 return {...plate,placements:plate.placements.map(p=>({...p,min:shift(p.min),max:shift(p.max),translation:shift(p.translation)}))};
}
export function planPrintLayout(items,{margin=2,gap=3,allowRotation=true,fixed=[]}={}){
 if(!Number.isFinite(margin)||margin<0||margin>20||!Number.isFinite(gap)||gap<0||gap>30||typeof allowRotation!=='boolean')throw Error('端の余白は0〜20 mm、部品の間隔は0〜30 mmで指定してください');
 if(!Array.isArray(items)||!items.length||items.length>100||new Set(items.map(b=>b.id)).size!==items.length)throw Error('配置するボディを1〜100個指定してください');
 const usable=PRINT_PLATE_SIZE-2*margin;
 const rectangles=items.map((b,index)=>{if(typeof b.id!=='string'||!b.id||![b.min,b.max].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||b.min.some((v,i)=>b.max[i]-v<=0))throw Error('ボディの寸法を取得できません');const width=b.max[0]-b.min[0],height=b.max[1]-b.min[1];if(width>usable+EPS||height>usable+EPS)throw Error((b.name||'ボディ')+'（'+width.toFixed(2)+' × '+height.toFixed(2)+' mm）が、余白を除いた'+usable.toFixed(2)+' mm四方を超えています。余白を減らすかモデルを分割してください');return {...b,index,width:Math.min(width,usable),height:Math.min(height,usable)};});
 if(rectangles.reduce((sum,b)=>sum+b.width*b.height,0)>usable*usable+EPS)throw Error('部品の占有面積がプレートを超えています。印刷するボディを減らしてください');
 let initialFree=[{x:0,y:0,w:usable+gap,h:usable+gap}];
 const reserved=[],fixedById=new Map(fixed.map(row=>[row.id,row]));
 for(const b of rectangles){
  const row=fixedById.get(b.id);if(!row)continue;
  const rotation=row.rotation,width=rotation?b.height:b.width,height=rotation?b.width:b.height;
  const p={b,rotation,width,height,x:row.x+(usable-width)/2,y:row.y+(usable-height)/2,w:width+gap,h:height+gap,locked:row.locked};
  if(p.x< -EPS||p.y< -EPS||p.x+width>usable+EPS||p.y+height>usable+EPS||reserved.some(r=>overlaps(r,p)))
   throw Error((b.name||b.id)+' の保存位置が余白または部品間隔と合いません。固定を解除して自動で並べ直してください');
  reserved.push(p);initialFree=subtractFree(initialFree,p);
 }
 const unplaced=rectangles.filter(b=>!fixedById.has(b.id));
 function attempt(order,heuristic){
  let free=initialFree;const placed=[...reserved];
  for(const b of order){let best=null;
   for(const f of free)for(const rotation of allowRotation?[0,90]:[0]){const w=(rotation?b.height:b.width)+gap,h=(rotation?b.width:b.height)+gap;if(w>f.w+EPS||h>f.h+EPS)continue;const short=Math.min(f.w-w,f.h-h),long=Math.max(f.w-w,f.h-h),score=heuristic===0?[short,long,f.y,f.x,rotation]:heuristic===1?[f.w*f.h-w*h,short,f.y,f.x,rotation]:[f.y+h,f.x,short,long,rotation];if(!best||score.some((v,i)=>Math.abs(v-best.score[i])>EPS&&score.slice(0,i).every((x,j)=>Math.abs(x-best.score[j])<=EPS)&&v<best.score[i]))best={x:f.x,y:f.y,w,h,rotation,score};}
   if(!best)return null;
   free=subtractFree(free,best);
   placed.push({b,...best,width:best.w-gap,height:best.h-gap});
  }
  const width=Math.max(...placed.map(p=>p.x+p.width)),height=Math.max(...placed.map(p=>p.y+p.height));return {placed,width,height};
 }
 const sorts=[b=>b.width*b.height,b=>Math.max(b.width,b.height),b=>b.height,b=>b.width];let best=null;
 for(const sort of sorts){const order=[...unplaced].sort((a,b)=>sort(b)-sort(a)||a.index-b.index);for(let h=0;h<3;h++){const result=attempt(order,h);if(result&&(!best||result.width*result.height<best.width*best.height-EPS))best=result;}}

 // Try alternate free-rectangle corners for small, tightly packed sets.
 // The bounded search handles arrangements such as four interlocking rectangles.
 if(!best&&unplaced.length<=8){let budget=4000;const order=[...unplaced].sort((a,b)=>b.width*b.height-a.width*a.height||a.index-b.index);
  function search(index,free,placed){if(--budget<0)return null;if(index===order.length)return {placed,width:Math.max(...placed.map(p=>p.x+p.width)),height:Math.max(...placed.map(p=>p.y+p.height))};const b=order[index],seen=new Set();
   for(const f of free)for(const rotation of allowRotation?[0,90]:[0]){const w=(rotation?b.height:b.width)+gap,h=(rotation?b.width:b.height)+gap;if(w>f.w+EPS||h>f.h+EPS)continue;
    for(const x of [f.x,f.x+f.w-w])for(const y of [f.y,f.y+f.h-h]){const key=[x,y,rotation].map(v=>v.toFixed(6)).join(':');if(seen.has(key))continue;seen.add(key);const used={x,y,w,h};
     const result=search(index+1,subtractFree(free,used),[...placed,{b,...used,rotation,width:w-gap,height:h-gap}]);if(result)return result;if(budget<0)return null;
    }
   }return null;
  }
  best=search(0,initialFree,reserved);
  if(best&&!reserved.length){const minX=Math.min(...best.placed.map(p=>p.x)),minY=Math.min(...best.placed.map(p=>p.y));best.placed.forEach(p=>{p.x-=minX;p.y-=minY;});best.width-=minX;best.height-=minY;}
 }
 if(!best)throw Error('この配置方法では全てを180 mm四方に収められません。部品の間隔・端の余白を減らすか、印刷するボディを減らしてください');
 const placements=best.placed.map(p=>{const {b,rotation}=p,pivot=b.min.map((v,i)=>(v+b.max[i])/2),x=p.x-(reserved.length?usable:best.width)/2,y=p.y-(reserved.length?usable:best.height)/2;return {id:b.id,name:b.name,rotation,pivot,translation:[x-(pivot[0]-p.width/2),y-(pivot[1]-p.height/2),-b.min[2]],min:[x,y,0],max:[x+p.width,y+p.height,b.max[2]-b.min[2]],sourceMin:b.min,sourceMax:b.max,...(p.locked?{locked:true}:{})};}).sort((a,b)=>items.findIndex(x=>x.id===a.id)-items.findIndex(x=>x.id===b.id));
 return {size:PRINT_PLATE_SIZE,margin,gap,allowRotation,used:placementExtent(placements),placements};
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
 const {targets,orientations={},placementOverrides=[]}=spec;
 if(!Array.isArray(targets)||!targets.length||targets.length>100||new Set(targets).size!==targets.length||
  targets.some(id=>typeof id!=='string'||!id)||!orientations||Array.isArray(orientations)||typeof orientations!=='object'||
  Object.entries(orientations).some(([id,value])=>!targets.includes(id)||!Object.hasOwn(printRotations,value)))
  throw Error('印刷するボディと向きを確認してください');
 if(!Array.isArray(placementOverrides)||placementOverrides.length>targets.length||
  placementOverrides.some(row=>!row||!targets.includes(row.id)||!Number.isInteger(row.plate)||row.plate<0||row.plate>=100||
   ![row.x,row.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=PRINT_PLATE_SIZE/2)||![0,90].includes(row.rotation)||typeof row.locked!=='boolean')||
  new Set(placementOverrides.map(row=>row.id)).size!==placementOverrides.length)
  throw Error('保存した印刷位置が不正です');
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
 const saved=spec.placementOverrides||[];
 if(!saved.length)try{return {plates:[place(planPrintLayout(oriented,spec))]};}catch{}
 {
  const area=item=>(item.max[0]-item.min[0])*(item.max[1]-item.min[1]);
  const plates=Array.from({length:Math.max(0,...saved.map(row=>row.plate+1))},(_,index)=>{
   const fixed=saved.filter(row=>row.plate===index),items=fixed.map(row=>byId.get(row.id));
   return {fixed,items,plan:items.length?planPrintLayout(items,{...spec,fixed}):null};
  });
  const fixedIds=new Set(saved.map(row=>row.id));
  for(const item of oriented.filter(item=>!fixedIds.has(item.id)).sort((a,b)=>area(b)-area(a))){
   const single=planPrintLayout([item],spec);
   let placed=false;
   for(const plate of plates){
    try{plate.plan=planPrintLayout([...plate.items,item],{...spec,fixed:plate.fixed});}
    catch{continue;}
    plate.items.push(item);placed=true;break;
   }
   if(!placed)plates.push({items:[item],plan:single});
  }
  const empty={size:PRINT_PLATE_SIZE,margin:spec.margin??2,gap:spec.gap??3,placements:[],used:placementExtent([])};
  return {plates:plates.map(plate=>plate.plan?place(plate.plan):empty)};
 }
}
