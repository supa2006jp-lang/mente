import {sectionProjection} from './drawing-section.js';
import * as R from 'replicad';
// Project the complete assembly so bodies also hide edges of other bodies.
export function orthographicProjection(bodies,ids,sections=[]){
 if(!ids?.length)throw Error('図面にするボディがありません');
 if(ids.some(id=>!bodies.has(id)))throw Error('対象ボディが見つかりません');
 const compound=R.makeCompound(ids.map(id=>bodies.get(id).clone()));
 try{const box=compound.boundingBox;let bounds;try{bounds=box.bounds;}finally{box.delete();}
 const views={};for(const [name,dir,x] of [['front',[0,-1,0],[1,0,0]],['top',[0,0,1],[1,0,0]],['right',[1,0,0],[0,1,0]],['iso',[1,-1,1],[1,1,0]]]){
 const camera=new R.ProjectionCamera([0,0,0],dir,x);try{const p=R.drawProjection(compound,camera);views[name]={visible:p.visible.toSVGPaths().flat(Infinity),hidden:p.hidden.toSVGPaths().flat(Infinity),viewBox:p.visible.toSVGViewBox(0).trim().split(/\s+/).map(Number)};}finally{camera.delete();}}
 const sectionErrors={};for(const section of sections){try{views[section.id]=sectionProjection(compound,bounds,section);}catch(e){sectionErrors[section.id]=typeof e==='number'?'断面の計算に失敗しました':e.message;}}
 return {bounds,views,bodyCount:ids.length,sectionErrors};
 }finally{compound.delete();}
}
