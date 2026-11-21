import {sectionProjection} from './drawing-section.js';
import {defaultDrawingViewOrder,defaultDrawingViews,drawingIsometricProjection,drawingProjections,projectDrawingIsometric} from './drawing-view-preferences.js';
import * as R from 'replicad';
import {Quaternion} from 'three';
import {validateFrame,frameMatrix} from './frames.js';
import {drawingSilhouette} from './drawing-silhouette.js';
import {drawingHoleRims,projectDrawingHoles} from './drawing-hole-geometry.js';
import {pathEndpoints} from './drawing-dimensions.js';

function visibleDimensionVertices(shape,visible){
 const tolerance=1e-4,cells=new Map();
 const cell=value=>Math.floor(value/tolerance);
 for(const point of pathEndpoints(visible)){
  const key=cell(point[0])+','+cell(point[1]);
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push(point);
 }
 if(!cells.size)return [];
 const {normal}=drawingIsometricProjection;
 const oc=R.getOC(),kind=oc.TopAbs_ShapeEnum;
 const explorer=new oc.TopExp_Explorer(shape.wrapped,kind.TopAbs_VERTEX,kind.TopAbs_SHAPE),matches=new Map();
 try{
  // Traverse the B-rep vertices in linear time, including repeated occurrences.
  while(explorer.More()){
   const vertex=R.cast(explorer.Current());
   let model;
   try{model=vertex.asTuple();}finally{vertex.delete();}
   explorer.Next();
   const [x,y]=projectDrawingIsometric(model),ix=cell(x),iy=cell(y);
   let endpoint,distance=tolerance;
   for(let i=ix-1;i<=ix+1;i++)for(let j=iy-1;j<=iy+1;j++){
    for(const point of cells.get(i+','+j)??[]){
     const delta=Math.hypot(point[0]-x,point[1]-y);
     if(delta<distance){endpoint=point;distance=delta;}
    }
   }
   if(!endpoint)continue;
   const depth=model[0]*normal[0]+model[1]*normal[1]+model[2]*normal[2],previous=matches.get(endpoint);
   if(!previous||depth>previous.depth)matches.set(endpoint,{point:endpoint,model,depth});
  }
 }finally{explorer.delete();}
 return Array.from(matches.values(),({point,model})=>({point,model}));
}

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
 const {normal,horizontal}=name==='iso'?drawingIsometricProjection:drawingProjections[name];
 const camera=new R.ProjectionCamera([0,0,0],normal,horizontal);try{const p=R.drawProjection(compound,camera);views[name]={visible:p.visible.toSVGPaths().flat(Infinity),hidden:p.hidden.toSVGPaths().flat(Infinity),viewBox:p.visible.toSVGViewBox(0).trim().split(/\s+/).map(Number)};}finally{camera.delete();}
 if(name==='iso')views[name].dimensionVertices=visibleDimensionVertices(compound,views[name].visible);
 if(mesh)views[name].silhouette=drawingSilhouette(mesh,normal,horizontal);
 }
 const roundViews=Object.keys(views).filter(name=>drawingProjections[name]&&views[name].visible.some(path=>path.includes('A')));
 if(roundViews.length){
  const rims=drawingHoleRims(compound);
  for(const name of roundViews)views[name].holeMachining=projectDrawingHoles(rims,drawingProjections[name]);
 }
 const sectionErrors={};for(const section of sections){if(section.review)continue;try{views[section.id]=sectionProjection(compound,bounds,section,silhouettes);}catch(e){sectionErrors[section.id]=typeof e==='number'?'断面の計算に失敗しました':e.message;}}
 return {bounds,views,bodyCount:ids.length,sectionErrors};
 }finally{compound.delete();}
}
