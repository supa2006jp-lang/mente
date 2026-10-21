import * as THREE from 'three';
import {mirrorSketch} from './sketch-mirror.js';
import {selectedSketchParts} from './sketch-selection.js';

export function mirrorSketchWorkflow(features,sources,spec,{move=false,selection=null}={}){
 if(!move){const copies=sources.map(f=>mirrorSketch(f,spec));return {features:[...features,...copies],copies,retained:features,changedIds:[]};}
 if(selection?.size){
  const retained=[],copies=[],next=[];
  for(const f of features){
   if(f.kind!=='sketch'||!selection.has(f.id)){retained.push(f);next.push(f);continue;}
   const kept=selectedSketchParts(f,selection.get(f.id),false),parts=selectedSketchParts(f,selection.get(f.id));
   const moved=parts.map((part,i)=>{const copy=mirrorSketch(part,spec);copy.name=f.name;if(!kept.length&&i===0)copy.id=f.id;return copy;});
   retained.push(...kept);copies.push(...moved);next.push(...kept,...moved);
  }
  return {features:next,copies,retained,changedIds:[...selection.keys()]};
 }
 const replacements=new Map(sources.map(f=>[f.id,{...mirrorSketch(f,spec),id:f.id,name:f.name}]));
 return {features:features.map(f=>replacements.get(f.id)||f),copies:[...replacements.values()],retained:features.filter(f=>!replacements.has(f.id)),changedIds:[...replacements.keys()]};
}

export function mirrorAxisReference({basis,offset},spec,center,{followCopy=false,sourceCenter=null}={}){
 const n=new THREE.Vector3(...spec.mirrorNormal).normalize(),grid=basis.n,projected=n.clone().addScaledVector(grid,-n.dot(grid)),length2=projected.lengthSq();
 if(length2<1e-6)return null;
 const axis=grid.clone().cross(n).normalize(),origin=new THREE.Vector3(...spec.mirrorOrigin),distance=Number(spec.offset||0);
 const base=grid.clone().multiplyScalar(offset).addScaledVector(projected,(origin.dot(n)-offset*n.dot(grid))/length2).addScaledVector(axis,center.dot(axis));
 return {base,direction:projected.divideScalar(length2),axis,distance,snapBasis:[basis.u.clone(),basis.v.clone()],sourceCenter:sourceCenter?.clone(),...(followCopy?{handleBase:center.clone().addScaledVector(n,-2*distance),handleDirection:n.clone().multiplyScalar(2),handleScale:2}:{})};
}

// Signed displacement of a stable source anchor after reflection. Zero is
// the source position, regardless of how far the chosen edge lies from it.
export function mirrorCopyTravel(center,spec,offset=spec.offset||0){
 const normal=new THREE.Vector3(...spec.mirrorNormal).normalize(),origin=new THREE.Vector3(...spec.mirrorOrigin);
 return 2*(origin.sub(center).dot(normal)+offset);
}

export function mirrorCopyOffset(center,spec,travel){return (travel-mirrorCopyTravel(center,spec,0))/2;}

// Snap the control's actual world position to workplane grid lines. A copy
// travels twice as far as its mirror plane, including on offset/tilted frames.
export function mirrorAxisDragSnap(raw,{snap=false,step=10,pixelsPerMm=1,reference=null,handle=false}={}){
 const value=Math.max(-10000,Math.min(10000,raw)),base=handle?(reference?.handleBase||reference?.base):reference?.base,direction=handle?(reference?.handleDirection||reference?.direction):reference?.direction;
 let nearest=null;
 if(snap&&step>0&&base&&direction)for(const axis of reference.snapBasis||[]){
  const speed=direction.dot(axis);if(Math.abs(speed)<1e-7)continue;
  const origin=base.dot(axis),candidate=(Math.round((origin+value*speed)/step)*step-origin)/speed,distance=Math.abs(value-candidate);
  if(candidate>=-10000&&candidate<=10000&&distance<=Math.min(step*.2/Math.abs(speed),6/Math.max(.001,pixelsPerMm))+1e-9&&(!nearest||distance<nearest.distance))nearest={value:candidate,distance};
 }
 return {value:nearest?.value??value,snapped:!!nearest};
}

export function mirrorAxisDragValue(raw,{snap=false,step=10,pixelsPerMm=1}={}){
 let value=Math.max(-10000,Math.min(10000,raw));
 if(snap&&step>0){const nearest=Math.round(value/step)*step;if(Math.abs(value-nearest)<=Math.min(step*.2,6/Math.max(.001,pixelsPerMm)))value=nearest;}
 return Number(value.toFixed(4));
}
