import * as R from 'replicad';
const volume=s=>Math.abs(R.measureVolume(s)),bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}},parts=s=>{const p=s.solids;try{return p.length;}finally{p.forEach(s=>s.delete());}};
// One layer of grooves replaces a solid contact face with parallel landing
// lines. Bottom grooves start on the model, not in air. Bed feet stay solid.
export function supportContactLines(original,regions,p,onProgress){
 const masks=[];let result=null;const analysis={enabled:true,width:p.interfaceLineWidth,spacing:p.interfaceSpacing,depth:p.layerHeight,upper:0,lower:0,bedPreserved:0,slots:0,removedVolume:0};
 try{
  for(const {shape,role,axis}of regions){
   const b=bounds(shape),other=1-axis;if(role==='lower'&&b[0][2]<=p.bedZ+1e-6){analysis.bedPreserved++;continue;}const low=b[0][other],high=b[1][other],pitch=p.interfaceLineWidth+p.interfaceSpacing;
   const z=role==='upper'?Math.max(b[0][2],b[1][2]-p.layerHeight):b[0][2],top=role==='upper'?b[1][2]:Math.min(b[1][2],z+p.layerHeight),stripes=[];let compound,cut;
   try{
    for(let at=low+p.interfaceLineWidth;at<high-p.interfaceLineWidth-1e-6;at+=pitch){if(++analysis.slots>1024)throw Error('接触層の線が多すぎます。線の隙間を広げるか対象面を絞ってください');const a=[...b[0]],c=[...b[1]];a[axis]-=.01;c[axis]+=.01;a[other]=at;c[other]=Math.min(at+p.interfaceSpacing,high-p.interfaceLineWidth);a[2]=z;c[2]=top;if(c[other]-a[other]>1e-6)stripes.push(R.makeBox(a,c));}
    if(!stripes.length)continue;onProgress?.({stage:(role==='upper'?'上面':'底面')+'に線状の接触層を作成しています'});compound=R.makeCompound(stripes);cut=shape.intersect(compound);if(volume(cut)>.0001){masks.push(cut);cut=null;analysis[role]++;}
   }finally{cut?.delete();compound?.delete();stripes.forEach(s=>s.delete());}
  }
  if(masks.length){const tool=R.makeCompound(masks);try{result=original.cut(tool);}finally{tool.delete();}if(parts(result)!==parts(original))throw Error('接触層でサポートが分断されます。薄皮を2層以上にするか、線の隙間を狭くしてください');}else result=original.clone();
  analysis.removedVolume=Math.max(0,volume(original)-volume(result));const shape=result;result=null;return {shape,analysis};
 }finally{result?.delete();masks.forEach(s=>s.delete());}
}
