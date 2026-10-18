import {fuseSolid} from './solid-fuse.js';
import {betweenPattern,rectangularOffsets} from './rectangular-pattern.js';
import {solidPatternExtent} from './pattern-bounds.js';
// Old saved operations without `operation` retain the separate-body behavior.
export function patternSolids(base,p,axis,emit){
 const copies=[];let joined,moved;
 try{
  if(p.type==='circular'){for(let i=1;i<p.count;i++)copies.push([p.id+'-'+i,base.clone().rotate(p.angle*i/p.count,p.origin||[0,0,0],p.axisVector||axis)]);}
  else{
   const box=base.boundingBox;let offsets;try{const current=betweenPattern(p)&&p.betweenAlignment==='inside'?{...p,patternExtent:solidPatternExtent(base,p.startPoint,p.endPoint,box.center)}:p;offsets=rectangularOffsets(current,box.center);}finally{box.delete();}
   if(betweenPattern(p))moved=base.clone().translate(offsets[0]);
   for(let i=1;i<offsets.length;i++){const row=Math.floor(i/(p.count2||1)),column=i%(p.count2||1);copies.push([p.id+'-'+row+'-'+column,base.clone().translate(offsets[i])]);}
  }
  if(p.operation!=='結合'){if(moved)emit(p.target,moved);for(const [id,shape] of copies)emit(id,shape);return;}
  joined=(moved||base).clone();for(const [,shape] of copies){const next=fuseSolid(joined,shape);joined.delete();joined=next;}
  const solids=joined.solids;let count;try{count=solids.length;}finally{for(const solid of solids)solid.delete();}
  if(count!==1)throw Error('離れている形があるため、元のボディと一体化できません。間隔・個数・回転中心を調整するか、操作を「新規ボディ」に変更してください');
  emit(p.target,joined);
 }finally{joined?.delete();moved?.delete();for(const [,shape] of copies)shape.delete();}
}
