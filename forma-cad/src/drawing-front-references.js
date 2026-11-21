import {drawingProjectionNames,drawingProjections,drawingSectionPlane} from './drawing-view-preferences.js';
import {dimensionValue} from './drawing-dimensions.js';
import {followIsometricDimension} from './drawing-dimension-references.js';
import {reprojectDetailDimensionPlacements} from './drawing-detail-dimensions.js';
import {reconcileHoleTable} from './drawing-hole-references.js';

const identity={u:[1,0,0],v:[0,1,0],n:[0,0,1]};
const axisTolerance=1e-7;
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const axes=frame=>[frame.u,frame.v,frame.n];
const toWorld=(frame,local)=>local.map((_,i)=>axes(frame).reduce((sum,axis,j)=>sum+local[j]*axis[i],0));
const fromWorld=(frame,world)=>axes(frame).map(axis=>dot(world,axis));
const sameDirection=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]))<axisTolerance;
const review=item=>({...item,review:true});
const unplaced=item=>({...review(item),unplaced:true});

function projectedAxes(frame,{horizontal,vertical}){
 return [toWorld(frame,horizontal),toWorld(frame,vertical)];
}

function axisMatch(vector){
 const index=vector.findIndex(value=>Math.abs(value)>1-axisTolerance);
 return index>=0&&vector.every((value,i)=>i===index||Math.abs(value)<axisTolerance)?
  {index,sign:Math.sign(vector[index])}:null;
}

function projectionMove(before,after,view){
 const matrix=after.map(axis=>before.map(from=>{
  const n=dot(axis,from);
  return Math.abs(n)<1e-12?0:Math.abs(Math.abs(n)-1)<1e-12?Math.sign(n):n;
 }));
 return {view,project:point=>matrix.map(row=>dot(point,row)),axis:index=>axisMatch(matrix.map(row=>row[index]))};
}

function baseMoves(before,after){
 const next=drawingProjectionNames.map(view=>({view,normal:toWorld(after,drawingProjections[view].normal)}));
 const moves=new Map();
 for(const [name,projection] of Object.entries(drawingProjections)){
  const normal=toWorld(before,projection.normal);
  const match=next.find(candidate=>sameDirection(normal,candidate.normal));
  // The same sight direction preserves visibility and all projected geometry.
  // A coincident-looking outline on the opposite side is a different reference.
  if(match)moves.set(name,projectionMove(projectedAxes(before,projection),
   projectedAxes(after,drawingProjections[match.view]),match.view));
 }
 return moves;
}

function moveSection(section,before,after,moves,views){
 if(section.review)return section;
 const source=drawingProjections[section.view];
 const normal=toWorld(before,section.orientation==='vertical'?source.horizontal:source.vertical);
 const choices=new Set([moves.get(section.view)?.view,...views,...drawingProjectionNames]);
 for(const view of choices){
  if(!view)continue;
  const target=projectedAxes(after,drawingProjections[view]);
  const axis=axisMatch(target.map(axis=>dot(normal,axis)));
  if(!axis||!sameDirection(normal,target[axis.index].map(value=>value*axis.sign)))continue;
  const next={...section,view,orientation:axis.index===0?'vertical':'horizontal',
   coordinate:section.coordinate*axis.sign,reverse:axis.sign<0?!section.reverse:section.reverse};
  moves.set(section.id,projectionMove(projectedAxes(before,drawingSectionPlane(section)),
   projectedAxes(after,drawingSectionPlane(next)),section.id));
  return next;
 }
 return review(section);
}

export function planDrawingFrontChange(previous,next,state){
 const before=previous??identity,after=next??identity,moves=baseMoves(before,after);
 const sections=state.sections.map(section=>moveSection(section,before,after,moves,state.viewSelection));
 const details=state.details.map(detail=>{
  const move=moves.get(detail.view);
  if(detail.review||!move)return review(detail);
  moves.set(detail.id,{...move,view:detail.id});
  return {...detail,view:move.view,center:move.project(detail.center)};
 });
 const viewSelection=new Set(state.viewSelection);
 const include=(oldView,newView)=>{
  if(state.viewSelection.includes(oldView)&&drawingProjectionNames.includes(newView))viewSelection.add(newView);
 };
 for(const item of [...state.dimensions,...state.leaders,...state.markers,...state.dimensionPoints,state.holeTable]){
  if(item&&!item.review&&!item.hidden&&!item.originReview)include(item.view,moves.get(item.view)?.view);
 }
 for(const [oldItems,newItems] of [[state.sections,sections],[state.details,details]]){
  newItems.forEach((item,index)=>{if(!item.review)include(oldItems[index].view,item.view);});
 }
 return {moves,sections,details,viewSelection:[...viewSelection],
  transformModel:point=>fromWorld(after,toWorld(before,point))};
}

export function remapDrawingViewSettings(settings,moves){
 const result={};
 for(const [id,value] of Object.entries(settings)){
  if(!moves.has(id))result[id]=value;
 }
 for(const [id,value] of Object.entries(settings)){
  const move=moves.get(id);
  if(move)result[move.view]=value;
 }
 return result;
}

function moveAnnotation(item,move){
 const next={...item,view:move.view};
 for(const key of ['a','b','at','center','vertex','arcPoint','anchor','point']){
  if(item[key])next[key]=move.project(item[key]);
 }
 if(item.centers)next.centers=item.centers.map(move.project);
 if(item.pdfPlacement)next.pdfPlacement={...item.pdfPlacement,at:move.project(item.pdfPlacement.at)};
 return next;
}

function moveDimension(d,moves,iso,transformModel){
 if(d.review)return unplaced(d);
 if(d.view==='iso'){
  const modelA=transformModel(d.modelA),modelB=transformModel(d.modelB);
  const result=followIsometricDimension({...d,modelA,modelB},iso);
  if(!result)return unplaced(d);
  if(d.pdfPlacement)result.pdfPlacement={...d.pdfPlacement,
   at:d.pdfPlacement.at.map((value,i)=>value+result.at[i]-d.at[i])};
  // The slots for overall dimensions on ISO refer to the drawing's X/Y/Z.
  // Recompute that association using the same physical measurement.
  if(d.overall?.startsWith('iso')){
   const vector=modelB.map((value,i)=>value-modelA[i]),length=Math.hypot(...vector);
   const axis=axisMatch(vector.map(value=>value/length));
   if(axis)result.overall='iso-'+['x','y','z'][axis.index];
   else delete result.overall;
  }
  return result;
 }
 const move=moves.get(d.view);
 if(!move)return unplaced(d);
 const next=moveAnnotation(d,move);
 if(d.kind==='horizontal'||d.kind==='vertical'){
  const axis=move.axis(d.kind==='horizontal'?0:1);
  if(axis){
   next.kind=axis.index===0?'horizontal':'vertical';
   if(d.overall===d.view+d.kind)next.overall=next.view+next.kind;
  }else if(!d.overall&&(!d.automatic||d.feature==='profile-edge')){
   // A dimension parallel to its own projection can become a true edge
   // length. Never silently replace a component measurement with a diagonal.
   next.kind='aligned';
  }else return unplaced(d);
 }
 const value=dimensionValue(d);
 return Math.abs(dimensionValue(next)-value)<=1e-6*Math.max(1,value)?next:unplaced(d);
}

function moveHoleTable(table,moves,data,candidates){
 if(!table||table.originReview)return table;
 const move=moves.get(table.view);
 if(!move)return {...table,originReview:true,holes:table.holes.map(review)};
 const next=moveAnnotation(table,move);
 next.origin=move.project(table.origin);
 next.holes=table.holes.map(hole=>({...hole,center:move.project(hole.center)}));
 if(table.references)next.references=table.references.map(hole=>({...hole,center:move.project(hole.center)}));
 return reconcileHoleTable(next,candidates(move.view),data.views[move.view]?.viewBox,{exactOnly:true});
}

export function followDrawingFrontChange(state,plan,data,candidates){
 const moves=new Map(plan.moves);
 const sections=plan.sections.map(section=>{
  if(section.review)return section;
  if(data.views[section.id])return section;
  moves.delete(section.id);
  return review(section);
 });
 const dimensions=state.dimensions.map(d=>moveDimension(d,moves,data.views.iso,plan.transformModel));
 const details=plan.details.map((detail,index)=>{
  if(detail.review||!moves.has(state.details[index].view)){
   moves.delete(detail.id);
   return review(state.details[index]);
  }
  const dimensionPlacements=reprojectDetailDimensionPlacements(
   state.details[index],state.dimensions,dimensions,detail.view,moves.get(detail.id).project);
  return {...detail,dimensionPlacements};
 });
 // Some dimensions live on a detail whose parent section could not be rebuilt.
 // Preserve their original coordinates until the detail is placed again.
 const finalDimensions=dimensions.map((d,index)=>moves.has(d.view)||d.view==='iso'||d.review?d:unplaced(state.dimensions[index]));
 const mapItems=items=>items.map(item=>{
  const move=moves.get(item.view);
  return item.review||!move?review(item):moveAnnotation(item,move);
 });
 return {sections,details,dimensions:finalDimensions,leaders:mapItems(state.leaders),markers:mapItems(state.markers),
  dimensionPoints:mapItems(state.dimensionPoints),holeTable:moveHoleTable(state.holeTable,moves,data,candidates)};
}
