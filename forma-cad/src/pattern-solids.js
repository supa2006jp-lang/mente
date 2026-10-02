import {fuseSolid} from './solid-fuse.js';
// Old saved operations without `operation` retain the separate-body behavior.
export function patternSolids(base,p,axis,emit){
 const copies=[];let joined;
 try{
  if(p.type==='circular'){for(let i=1;i<p.count;i++)copies.push([p.id+'-'+i,base.clone().rotate(p.angle*i/p.count,p.origin||[0,0,0],p.axisVector||axis)]);}
  else for(let i=0;i<p.count;i++)for(let j=0;j<p.count2;j++)if(i||j)copies.push([p.id+'-'+i+'-'+j,base.clone().translate([i*p.spacing,j*p.spacing2,0])]);
  if(p.operation!=='結合'){for(const [id,shape] of copies)emit(id,shape);return;}
  joined=base.clone();for(const [,shape] of copies){const next=fuseSolid(joined,shape);joined.delete();joined=next;}
  const solids=joined.solids;let count;try{count=solids.length;}finally{for(const solid of solids)solid.delete();}
  if(count!==1)throw Error('離れている形があるため、元のボディと一体化できません。間隔・個数・回転中心を調整するか、操作を「新規ボディ」に変更してください');
  emit(p.target,joined);
 }finally{joined?.delete();for(const [,shape] of copies)shape.delete();}
}
