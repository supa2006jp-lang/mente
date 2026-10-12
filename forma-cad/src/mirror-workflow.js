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

export function mirrorAxisReference({basis,offset},spec,center){
 const n=new THREE.Vector3(...spec.mirrorNormal).normalize(),grid=basis.n,projected=n.clone().addScaledVector(grid,-n.dot(grid)),length2=projected.lengthSq();
 if(length2<1e-6)return null;
 const axis=grid.clone().cross(n).normalize(),origin=new THREE.Vector3(...spec.mirrorOrigin),distance=Number(spec.offset||0);
 const base=grid.clone().multiplyScalar(offset).addScaledVector(projected,(origin.dot(n)-offset*n.dot(grid))/length2).addScaledVector(axis,center.dot(axis));
 return {base,direction:projected.divideScalar(length2),axis,distance};
}

export function mirrorAxisDragValue(raw,{snap=false,step=10,pixelsPerMm=1}={}){
 let value=Math.max(-10000,Math.min(10000,raw));
 if(snap&&step>0){const nearest=Math.round(value/step)*step;if(Math.abs(value-nearest)<=Math.min(step*.2,6/Math.max(.001,pixelsPerMm)))value=nearest;}
 return Number(value.toFixed(4));
}
