import * as R from 'replicad';
import {Vector3} from 'three';
import {threadCylinderInfo} from './thread-cylinder.js';
import {drawingHoleRims} from './drawing-hole-geometry.js';
import {completeDrawingCircles} from './drawing-auto-dimensions.js';
import {assemblyTargets} from './assembly-state.js';

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

function readThread(history,feature,bodiesAt){
 const {spec}=feature,bodies=bodiesAt(history),base=bodies.get(spec.target);
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
  return openings.length?{selected,openings,thread:{id:feature.id,diameter:selected.radius*2,pitch:spec.pitch,length,leftHand:!!spec.leftHand}}:null;
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

export function drawingThreadEntries(features,bodies,targets,bodiesAt){
 if(!features.some(f=>isModeledThread(f.spec)))return [];
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
  const shape=bodies.get(bodyId),moves=[];
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
   if(isModeledThread(spec)&&spec.target===id){
    if(!sources.has(index))sources.set(index,readThread(features.slice(0,index),f,bodiesAt));
    const source=sources.get(index);
    if(source){
     if(verify&&!source.samples)source.samples=output.brep?ridgeSamples(output.brep,source.selected,source.thread.pitch):[];
     const survives=!verify||source.samples.length>0&&source.samples.every(point=>{
      const vertex=R.makeVertex(position(point).toArray());
      try{return R.measureDistanceBetween(vertex,shape)<tolerance;}finally{vertex.delete();}
     });
     if(survives)for(const mouth of source.openings){
      // Only a confirmed original bore supplies axial dimensions. The thread
      // length remains valid if its ridge survived other machining.
      const machining=verify?{radius:mouth.radius,...(mouth.machining.counterbore?{counterbore:{radius:mouth.machining.counterbore.radius}}:{})}:mouth.machining;
      const {end,offset}=mouth;
      entries.push({...mouth,machining,center:position(mouth.center),normal:position(mouth.normal,true),
       thread:{...source.thread,bodyId,end,...(offset?{offset}:{})}});
     }
    }
   }
   verify=true;
  }
 }
 return entries;
}

export function projectDrawingThreads(entries,view,projection,compound,bounds,frontFrame){
 if(!entries.length)return [];
 const circles=completeDrawingCircles(view),normal=new Vector3(...projection.normal);
 const horizontal=new Vector3(...projection.horizontal),vertical=new Vector3(...projection.vertical);
 const axes=frontFrame&&[frontFrame.u,frontFrame.v,frontFrame.n].map(axis=>new Vector3(...axis));
 const mapped=p=>axes?new Vector3(...axes.map(axis=>axis.dot(p))):p;
 const near=Math.max(...bounds.map(p=>normal.dot(new Vector3(...p)))),matches=[];
 for(const entry of entries){
  if(mapped(entry.normal).dot(normal)<1-1e-7)continue;
  const p=mapped(entry.center),center=[p.dot(horizontal),p.dot(vertical)],level=p.dot(normal);
  const ring=entry.machining.counterbore?.radius??entry.radius;
  if(!circles.some(circle=>Math.hypot(circle.center[0]-center[0],circle.center[1]-center[1])<tolerance&&matchRadius(circle.radius,ring)))continue;
  if(near-level>tolerance){
   const ray=R.makeLine(p.clone().addScaledVector(normal,tolerance).toArray(),p.clone().addScaledVector(normal,near-level+1).toArray());
   try{if(R.measureDistanceBetween(ray,compound)<tolerance*.5)continue;}finally{ray.delete();}
  }
  matches.push({...entry.machining,center,entryLevel:level,thread:entry.thread});
 }
 return matches.filter(entry=>matches.filter(other=>Math.hypot(entry.center[0]-other.center[0],entry.center[1]-other.center[1])<tolerance).length===1);
}
