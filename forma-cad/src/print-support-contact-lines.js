import {contactRoleSettings} from './print-support-contact-settings.js';
import {bottomContactInsetMask} from './print-support-contact-inset.js';
import {cadMesh} from './cad-mesh.js';
import * as R from 'replicad';
const volume=s=>Math.abs(R.measureVolume(s)),bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}},parts=s=>{const p=s.solids;try{return p.length;}finally{p.forEach(s=>s.delete());}};
// One layer of grooves replaces a solid contact face with parallel landing
// lines. Bottom grooves start on the model, not in air. Bed feet stay solid.
export function supportContactLines(original,regions,p,onProgress){
 const masks=[],landings=[],preview=[];let result=null;const analysis={enabled:true,width:p.interfaceLineWidth,spacing:p.interfaceSpacing,depth:p.layerHeight,upper:0,lower:0,bedPreserved:0,slots:0,removedVolume:0};
 try{
  for(const {shape,role,axis}of regions){
   const settings=contactRoleSettings(p,role);if(!settings.enabled)continue;const b=bounds(shape),other=1-axis;if(role==='lower'&&b[0][2]<=p.bedZ+1e-6){analysis.bedPreserved++;continue;}const low=b[0][other],high=b[1][other],pitch=settings.width+settings.spacing;
   const z=role==='upper'?Math.max(b[0][2],b[1][2]-p.layerHeight):b[0][2],top=role==='upper'?b[1][2]:Math.min(b[1][2],z+p.layerHeight),stripes=[];let compound,cut;
   try{
    for(let at=low+settings.width;at<high-settings.width-1e-6;at+=pitch){if(++analysis.slots>1024)throw Error('接触層の線が多すぎます。線の隙間を広げるか対象面を絞ってください');const a=[...b[0]],c=[...b[1]];a[axis]-=.01;c[axis]+=.01;a[other]=at;c[other]=Math.min(at+settings.spacing,high-settings.width);a[2]=z;c[2]=top;if(c[other]-a[other]>1e-6)stripes.push(R.makeBox(a,c));}
    if(role==='lower'&&p.bottomContactInset>0){if(b[1][axis]-b[0][axis]<2*p.bottomContactInset+p.lineWidth||high-low<2*p.bottomContactInset+pitch+settings.width)throw Error('底面の端の逃げが大きすぎて十分な接触線を残せません。値を小さくするか0にしてください');const rim=bottomContactInsetMask(shape,z,top,p.bottomContactInset);masks.push(rim);landings.push({shape,b,z,top,width:settings.width});analysis.bottomEndRelief={distance:p.bottomContactInset,count:(analysis.bottomEndRelief?.count||0)+1};}
    if(!stripes.length)continue;onProgress?.({stage:(role==='upper'?'上面':'底面')+'に線状の接触層を作成しています'});compound=R.makeCompound(stripes);cut=shape.intersect(compound);if(volume(cut)>.0001){masks.push(cut);cut=null;analysis[role]++;}
   }finally{cut?.delete();compound?.delete();stripes.forEach(s=>s.delete());}
  }
  result=original.clone();for(const mask of masks){const next=result.cut(mask);result.delete();result=next;}if(parts(result)!==parts(original))throw Error('接触層でサポートが分断されます。薄皮を2層以上にするか、線の隙間を狭くしてください');
  for(const {shape,b,z,top,width}of landings){const box=R.makeBox([b[0][0],b[0][1],z],[b[1][0],b[1][1],top]);let layer,remaining;try{layer=shape.intersect(box);remaining=result.intersect(layer);if(volume(remaining)<p.lineWidth*width*(top-z))throw Error('底面の端の逃げが大きすぎて十分な接触線を残せません。値を小さくするか0にしてください');}finally{remaining?.delete();layer?.delete();box.delete();}}
  analysis.settings={upper:contactRoleSettings(p,'upper'),lower:contactRoleSettings(p,'lower')};if(p.preview)for(const {shape,role,axis}of regions){if(!contactRoleSettings(p,role).enabled)continue;const b=bounds(shape);if(role==='lower'&&b[0][2]<=p.bedZ+1e-6)continue;const a=[...b[0]],c=[...b[1]];if(role==='upper')a[2]=Math.max(a[2],c[2]-p.layerHeight);else c[2]=Math.min(c[2],a[2]+p.layerHeight);const box=R.makeBox(a,c);let mask,display;try{mask=shape.intersect(box);display=result.intersect(mask);if(volume(display)>.0001)preview.push({id:role+'-'+preview.length,role,axis,bounds:bounds(display),...cadMesh(display)});}finally{display?.delete();mask?.delete();box.delete();}}
  analysis.removedVolume=Math.max(0,volume(original)-volume(result));const shape=result;result=null;return {shape,analysis,preview};
 }finally{result?.delete();masks.forEach(s=>s.delete());}
}
