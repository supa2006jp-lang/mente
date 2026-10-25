import * as R from 'replicad';
const volume=s=>Math.abs(R.measureVolume(s));
function anchored(shape,records){const parts=shape.solids;try{return parts.length>0&&parts.every(part=>records.some(({shape:rib})=>{const common=part.intersect(rib);try{return volume(common)>.0001;}finally{common.delete();}}));}finally{parts.forEach(s=>s.delete());}}
// Remove only skin. The final union retains the fins and transverse ties.
export function splitSupportBottomSkin(original,records,p,onProgress,budget=128){
 let shape=original.clone(),count=0,skipped=0;
 try{
  const box=shape.boundingBox;let b;try{b=box.bounds;}finally{box.delete();}
  const axis=1-records[0].axis,span=b[1][axis]-b[0][axis],sections=Math.max(1,Math.ceil(span/p.bottomSectionLength));
  if(sections>24||sections-1>budget)throw Error('底面薄皮の分割数が多すぎます。分割の間隔を広げてください');
  for(let i=1;i<sections;i++){
   onProgress?.({stage:'底面薄皮の分割線を作成しています'});const at=b[0][axis]+span*i/sections,low=b[0].map(v=>v-.01),high=b[1].map(v=>v+.01);low[axis]=at-p.bottomSeamWidth/2;high[axis]=at+p.bottomSeamWidth/2;
   const tool=R.makeBox(low,high);let cut;
   try{cut=shape.cut(tool);if(volume(shape)-volume(cut)<.0001||!anchored(cut,records)){skipped++;continue;}shape.delete();shape=cut;cut=null;count++;}finally{cut?.delete();tool.delete();}
  }
  const parts=shape.solids;let actual;try{actual=parts.length;}finally{parts.forEach(s=>s.delete());}
  const result={shape,count,skipped,sections:actual};shape=null;return result;
 }finally{shape?.delete();}
}
