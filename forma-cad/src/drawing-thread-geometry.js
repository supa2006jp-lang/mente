import * as R from 'replicad';
import {Vector3} from 'three';
import {threadCylinderInfo} from './thread-cylinder.js';
import {drawingHoleRims} from './drawing-hole-geometry.js';
import {completeDrawingCircles} from './drawing-auto-dimensions.js';
import {assemblyTargets} from './assembly-state.js';
import {threadMateSource} from './thread-source.js';

const tolerance=1e-4,matchRadius=(a,b)=>Math.abs(a-b)<tolerance;
const coordinateAxes=[[1,0,0],[0,1,0],[0,0,1]].map(p=>new Vector3(...p));
const isModeledThread=spec=>spec?.type==='thread'&&spec.target&&spec.surfacePoint&&spec.profile==='metric60';

function sourceOpenings(base,selected){
 const {origin,normal,height,radius}=selected,other=origin.clone().addScaledVector(normal,height);
 const rims=drawingHoleRims(base);
 const mouths=rims.filter(rim=>rim.opening&&matchRadius(rim.radius,radius)&&
  Math.abs(rim.normal.dot(normal))>1-1e-7&&Math.min(rim.center.distanceTo(origin),rim.center.distanceTo(other))<tolerance);
 return mouths.map(mouth=>{
  const machining=mouth.machining??{radius};
  const outer=machining.counterbore&&rims.find(rim=>rim.machining===machining&&rim.normal.dot(mouth.normal)>1-1e-7&&
   matchRadius(rim.radius,machining.counterbore.radius)&&rim.center.distanceTo(mouth.center)<=machining.counterbore.depth+tolerance);
  return {center:(outer||mouth).center,normal:mouth.normal,radius:machining.radius,machining};
 });
}

function readThread(history,spec,id,bodiesAt){
 const bodies=bodiesAt(history),base=bodies.get(spec.target);
 try{
  const selected=base&&threadCylinderInfo(base,spec.surfacePoint);
  if(!selected?.internal)return null;
  const length=spec.fullLength?selected.height:spec.length;
  if(!(length>0&&spec.pitch>0))return null;
  const offset=spec.fullLength?0:Number(spec.offset||0);
  const low=selected.fromTop?selected.height-offset-length:offset;
  const openings=sourceOpenings(base,selected).map(mouth=>{
   const end=mouth.normal.dot(selected.normal)>0?'high':'low';
   const level=mouth.center.clone().sub(selected.origin).dot(selected.normal);
   const gap=Math.abs(level-(end==='high'?low+length:low));
   return {...mouth,end,offset:gap>tolerance?gap:0};
  });
  const diameter=selected.radius*2,adjustedDiameter=diameter-2*(spec.threadCylinderOffset||0);
  return openings.length?{selected,openings,thread:{id,diameter,pitch:spec.pitch,length,leftHand:!!spec.leftHand,
   ...(adjustedDiameter>0&&Math.abs(adjustedDiameter-diameter)>tolerance?{adjustedDiameter}:{})}}:null;
 }finally{for(const body of bodies.values())body.delete();}
}

// When a later operation changes this body, verify representative points on the
// helical ridge still exist inside the original bore.
function ridgeSamples(brep,cylinder,pitch){
 const shape=R.deserializeShape(brep).asShape3D(),edges=shape.edges,candidates=[];
 try{
  const {origin,normal,radius,height}=cylinder;
  for(const edge of edges){
   if(edge.geomType!=='BSPLINE_CURVE')continue;
   const p=edge.pointAt(.5);
   try{
    const point=new Vector3(...p.toTuple()),offset=point.clone().sub(origin),level=offset.dot(normal);
    const r=offset.addScaledVector(normal,-level).length();
    if(r<radius-pitch*.08&&r>Math.max(0,radius-pitch*.95)&&level>=-tolerance&&level<=height+tolerance)candidates.push({level,point});
   }finally{p.delete();}
  }
  candidates.sort((a,b)=>a.level-b.level);
  return [...new Set([candidates[0],candidates[Math.floor(candidates.length/2)],candidates.at(-1)].filter(Boolean))].map(c=>c.point);
 }finally{edges.forEach(edge=>edge.delete());shape.delete();}
}

function movedPoint(spec,point,direction=false){
 const pivot=new Vector3(...(spec.rotation?(spec.pivot??[0,0,0]):[0,0,0]));
 const result=point.clone();
 if(!direction)result.sub(pivot);
 const angles=spec.rotation??['X','Y','Z'].map(axis=>(spec.axis||'Z')===axis?(spec.angle||0):0);
 angles.forEach((angle,i)=>{if(angle)result.applyAxisAngle(coordinateAxes[i],angle*Math.PI/180);});
 if(!direction)result.add(pivot).add(new Vector3(spec.x,spec.y,spec.z));
 return result;
}

function storedInternalThread(output){
 const source=output.threadSource;
 return source?.spec.threadInternal===true&&isModeledThread(source.spec)?source:null;
}

function internalThreadOwner(features,index,spec){
 const derived=feature=>['pull','move','printLayout'].includes(feature.spec?.type);
 if(!derived(features[index]))return features[index].id;
 const same=other=>isModeledThread(other)&&other.target===spec.target&&
  (other.id&&spec.id?other.id===spec.id:other.surfacePoint.every((value,i)=>value===spec.surfacePoint[i]));
 for(let i=index-1;i>=0;i--){
  const feature=features[i];
  if(derived(feature))continue;
  if(same(feature.spec)|| (feature.cadResult??feature).outputs?.some(output=>same(storedInternalThread(output)?.spec)))return feature.id;
 }
 return features[index].id;
}

export function drawingThreadEntries(features,bodies,targets,bodiesAt){
 if(!features.some(f=>isModeledThread(f.spec)||(f.cadResult??f).outputs?.some(storedInternalThread)))return [];
 const lives=new Set(),moveInputs=new Map(),sources=new Map(),entries=[];
 for(const [index,f] of features.entries()){
  const result=f.cadResult??(f.kind==='cadop'?f:null);
  if(f.spec?.type==='move'&&(f.spec.copy||f.spec.moveMode==='複製して移動')){
   moveInputs.set(index,assemblyTargets(features.slice(0,index),f.spec.targets||[f.spec.target],lives));
  }
  if(result){result.remove.forEach(id=>lives.delete(id));result.outputs.forEach(output=>lives.add(output.id));}
  else if((f.kind==='extrusion'||!f.kind)&&f.operation==='new')lives.add(f.id);
 }
 for(const bodyId of targets){
  const shape=bodies.get(bodyId),moves=[],handled=new Set();
  let id=bodyId,verify=false;
  const position=(point,direction=false)=>moves.reduce((p,spec)=>movedPoint(spec,p,direction),point.clone());
  for(let index=features.length-1;index>=0;index--){
   const f=features[index],spec=f.spec,result=f.cadResult??(f.kind==='cadop'?f:null);
   if(!result){
    if(f.id===id&&f.operation==='new')break;
    if(f.operation!=='new'&&f.target===id)verify=true;
    continue;
   }
   const outputIndex=result.outputs.findIndex(output=>output.id===id),output=result.outputs[outputIndex];
   if(!output){if(result.remove.includes(id))break;continue;}
   if(spec?.type==='move'){
    if(spec.reverseCopy&&moveInputs.has(index))break;
    const input=moveInputs.has(index)?moveInputs.get(index)[outputIndex]:id;
    if(!input)break;
    moves.unshift({...spec,...f.analysis?.contactMove?.transform});id=input;continue;
   }
   const direct=isModeledThread(spec)&&spec.target===id;
   const saved=direct?null:storedInternalThread(output);
   if(direct||saved){
    const sourceId=direct?f.id:internalThreadOwner(features,index,saved.spec);
    if(handled.has(sourceId))continue;
    handled.add(sourceId);
    const key=index+':'+outputIndex;
    if(!sources.has(key))sources.set(key,readThread(saved?.features??features.slice(0,index),saved?.spec??spec,sourceId,bodiesAt));
    const source=sources.get(key);
    if(source){
     const atStep=(point,direction)=> (saved?.transforms??[]).reduce((value,move)=>movedPoint(move,value,direction),point);
     if(verify&&!source.samples){
      const cylinder={...source.selected,origin:atStep(source.selected.origin,false),normal:atStep(source.selected.normal,true)};
      source.samples=output.brep?ridgeSamples(output.brep,cylinder,source.thread.pitch):[];
     }
     const survives=!verify||source.samples.length>0&&source.samples.every(point=>{
      const vertex=R.makeVertex(position(point).toArray());
      try{return R.measureDistanceBetween(vertex,shape)<tolerance;}finally{vertex.delete();}
     });
     if(survives)for(const mouth of source.openings){
      // Only a confirmed original bore supplies axial dimensions. The thread
      // length remains valid if its ridge survived other machining.
      const machining=verify?{radius:mouth.radius,...(mouth.machining.counterbore?{counterbore:{radius:mouth.machining.counterbore.radius}}:{})}:mouth.machining;
      const {end,offset}=mouth;
      entries.push({...mouth,machining,center:position(atStep(mouth.center,false)),normal:position(atStep(mouth.normal,true),true),
       thread:{...source.thread,bodyId,end,...(offset?{offset}:{})}});
     }
    }
   }
   verify=true;
  }
 }
 return entries;
}

export function drawingThreadShaftEntries(features,targets,bodiesAt){
 const entries=[];
 for(const bodyId of targets){
  const source=threadMateSource(features,bodyId);
  if(source?.spec.threadInternal!==false)continue;
  const {spec}=source,original=bodiesAt(source.features);
  try{
   const body=original.get(spec.target),cylinder=body&&threadCylinderInfo(body,spec.surfacePoint);
   if(!cylinder||cylinder.internal)continue;
   const position=(point,direction)=> (source.transforms??[]).reduce((value,move)=>movedPoint(move,value,direction),point);
   const {origin,normal,radius,height}=cylinder;
   for(const end of ['low','high']){
    const high=end==='high',center=origin.clone().addScaledVector(normal,high?height:0);
    entries.push({center:position(center,false),normal:position(normal.clone().multiplyScalar(high?1:-1),true),radius,
     thread:{id:spec.id??spec.target,bodyId,end,diameter:radius*2,pitch:spec.pitch},tipChamfer:spec.tipChamfer??0});
   }
  }finally{for(const body of original.values())body.delete();}
 }
 return entries;
}

function projectThreadEntries(entries,projection,compound,bounds,frontFrame,shown){
 if(!entries.length)return [];
 const normal=new Vector3(...projection.normal);
 const horizontal=new Vector3(...projection.horizontal),vertical=new Vector3(...projection.vertical);
 const axes=frontFrame&&[frontFrame.u,frontFrame.v,frontFrame.n].map(axis=>new Vector3(...axis));
 const mapped=p=>axes?new Vector3(...axes.map(axis=>axis.dot(p))):p;
 const near=Math.max(...bounds.map(p=>normal.dot(new Vector3(...p)))),matches=[];
 for(const entry of entries){
  if(mapped(entry.normal).dot(normal)<1-1e-7)continue;
  const p=mapped(entry.center),center=[p.dot(horizontal),p.dot(vertical)],level=p.dot(normal);
  if(shown&&!shown(entry,center))continue;
  if(near-level>tolerance){
   const ray=R.makeLine(p.clone().addScaledVector(normal,tolerance).toArray(),p.clone().addScaledVector(normal,near-level+1).toArray());
   try{if(R.measureDistanceBetween(ray,compound)<tolerance*.5)continue;}finally{ray.delete();}
  }
  matches.push({entry,center,entryLevel:level});
 }
 return matches.filter(entry=>matches.filter(other=>Math.hypot(entry.center[0]-other.center[0],entry.center[1]-other.center[1])<tolerance).length===1);
}

export function projectDrawingThreads(entries,view,projection,compound,bounds,frontFrame){
 if(!entries.length)return [];
 const circles=completeDrawingCircles(view);
 const hasCircle=(center,radius)=>circles.some(circle=>
  Math.hypot(circle.center[0]-center[0],circle.center[1]-center[1])<tolerance&&matchRadius(circle.radius,radius));
 const boreRadius=(entry,center)=>{
  const adjusted=entry.thread.adjustedDiameter/2;
  return Number.isFinite(adjusted)&&hasCircle(center,adjusted)?adjusted:entry.radius;
 };
 const shown=(entry,center)=>hasCircle(center,entry.machining.counterbore?.radius??boreRadius(entry,center));
 return projectThreadEntries(entries,projection,compound,bounds,frontFrame,shown)
  .map(({entry,center,entryLevel})=>({...entry.machining,radius:boreRadius(entry,center),center,entryLevel,thread:entry.thread}));
}

export function projectDrawingThreadShafts(entries,projection,compound,bounds,frontFrame){
 return projectThreadEntries(entries,projection,compound,bounds,frontFrame)
  .map(({entry,center})=>({center,radius:entry.radius,thread:entry.thread,tipChamfer:entry.tipChamfer}));
}
