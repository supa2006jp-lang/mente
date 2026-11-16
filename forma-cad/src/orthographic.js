import {sectionProjection} from './drawing-section.js';
import {defaultDrawingViewOrder,defaultDrawingViews,drawingProjections} from './drawing-view-preferences.js';
import * as R from 'replicad';
// Project the complete assembly so bodies also hide edges of other bodies.
export function orthographicProjection(bodies,ids,sections=[],requested=[...defaultDrawingViews,'iso']){
 if(!ids?.length)throw Error('図面にするボディがありません');
 if(ids.some(id=>!bodies.has(id)))throw Error('対象ボディが見つかりません');
 const compound=R.makeCompound(ids.map(id=>bodies.get(id).clone()));
 try{const box=compound.boundingBox;let bounds;try{bounds=box.bounds;}finally{box.delete();}
 const views={};for(const name of [...defaultDrawingViewOrder,'iso']){
 if(!requested.includes(name))continue;
 const {normal,horizontal}=name==='iso'?{normal:[1,-1,1],horizontal:[1,1,0]}:drawingProjections[name];
 const camera=new R.ProjectionCamera([0,0,0],normal,horizontal);try{const p=R.drawProjection(compound,camera);views[name]={visible:p.visible.toSVGPaths().flat(Infinity),hidden:p.hidden.toSVGPaths().flat(Infinity),viewBox:p.visible.toSVGViewBox(0).trim().split(/\s+/).map(Number)};}finally{camera.delete();}}
 const sectionErrors={};for(const section of sections){try{views[section.id]=sectionProjection(compound,bounds,section);}catch(e){sectionErrors[section.id]=typeof e==='number'?'断面の計算に失敗しました':e.message;}}
 return {bounds,views,bodyCount:ids.length,sectionErrors};
 }finally{compound.delete();}
}
