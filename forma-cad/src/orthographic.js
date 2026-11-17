import {sectionProjection} from './drawing-section.js';
import {defaultDrawingViewOrder,defaultDrawingViews,drawingProjections} from './drawing-view-preferences.js';
import * as R from 'replicad';
import {Quaternion} from 'three';
import {validateFrame,frameMatrix} from './frames.js';
import {drawingSilhouette} from './drawing-silhouette.js';
// Project the complete assembly so bodies also hide edges of other bodies.
export function orthographicProjection(bodies,ids,sections=[],requested=[...defaultDrawingViews,'iso'],frontFrame,silhouettes=false){
 if(!ids?.length)throw Error('図面にするボディがありません');
 if(ids.some(id=>!bodies.has(id)))throw Error('対象ボディが見つかりません');
 let compound=R.makeCompound(ids.map(id=>bodies.get(id).clone()));
 try{
 if(frontFrame){
  validateFrame(frontFrame);
  const {x,y,z,w}=new Quaternion().setFromRotationMatrix(frameMatrix({frame:frontFrame}).transpose());
  const length=Math.hypot(x,y,z);
  if(length>1e-12)compound=compound.rotate(360/Math.PI*Math.atan2(length,w),[0,0,0],[x/length,y/length,z/length]);
 }
 const box=compound.boundingBox;let bounds;try{bounds=box.bounds;}finally{box.delete();}
 const mesh=silhouettes&&requested.length?compound.mesh({tolerance:.01,angularTolerance:.08}):null;
 const views={};for(const name of [...defaultDrawingViewOrder,'iso']){
 if(!requested.includes(name))continue;
 const {normal,horizontal}=name==='iso'?{normal:[1,-1,1],horizontal:[1,1,0]}:drawingProjections[name];
 const camera=new R.ProjectionCamera([0,0,0],normal,horizontal);try{const p=R.drawProjection(compound,camera);views[name]={visible:p.visible.toSVGPaths().flat(Infinity),hidden:p.hidden.toSVGPaths().flat(Infinity),viewBox:p.visible.toSVGViewBox(0).trim().split(/\s+/).map(Number)};}finally{camera.delete();}
 if(mesh)views[name].silhouette=drawingSilhouette(mesh,normal,horizontal);
 }
 const sectionErrors={};for(const section of sections){try{views[section.id]=sectionProjection(compound,bounds,section,silhouettes);}catch(e){sectionErrors[section.id]=typeof e==='number'?'断面の計算に失敗しました':e.message;}}
 return {bounds,views,bodyCount:ids.length,sectionErrors};
 }finally{compound.delete();}
}
