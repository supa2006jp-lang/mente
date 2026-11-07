import * as R from 'replicad';
import {Vector3} from 'three';
import {formBasis} from './form-orientation.js';
import {shellBody} from './shell.js';

function transverseLimit(bounds,{u,v}){
 const [lo,hi]=bounds,span=axis=>axis.toArray().reduce((sum,value,i)=>sum+Math.abs(value)*(hi[i]-lo[i]),0);
 return Math.min(span(u),span(v))/2;
}

export function formWallCandidates(thickness,limit){
 const round=value=>Math.round(value*100)/100;
 const center=Math.min(thickness,Math.max(.1,Math.floor(limit*.8*10)/10));
 const step=Math.max(.2,Math.round(center*2)/10);
 const candidates=[...(center!==thickness?[center]:[]),center+step,center-step,
  center+step*2.5,center+step*5,center-step*2.5,center-step*5];
 return [...new Set(candidates.map(round))].filter(value=>value>=.1&&value<=100&&value<limit-1e-6&&
  Math.abs(value-thickness)>1e-6).slice(0,6);
}

export function searchFormWalls(base,form,onProgress){
 const bounds=base.boundingBox;
 let candidates;
 try{candidates=formWallCandidates(form.wall.thickness,transverseLimit(bounds.bounds,formBasis(form.orientation)));}
 finally{bounds.delete();}
 const valid=[],start=performance.now();
 let tried=0;
 for(const thickness of candidates){
  if(tried&&performance.now()-start>27000)break;
  let solid;
  onProgress?.({stage:'壁厚 '+thickness+' mm を検査しています',current:tried,total:candidates.length,wallCandidates:valid.slice()});
  try{
   solid=makeFormWall(base,{...form,wall:{...form.wall,thickness}});
   valid.push(thickness);
  }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
  finally{solid?.delete();}
  tried++;
  onProgress?.({stage:'壁厚の候補を調べています',current:tried,total:candidates.length,wallCandidates:valid.slice()});
  if(valid.length>=3)break;
 }
 return {valid,tried,total:candidates.length};
}

export function makeFormWall(base,form){
 const {wall,rings}=form,axes=formBasis(form.orientation),{n}=axes;
 const bounds=base.boundingBox;
 let originalBounds;
 try{
  originalBounds=bounds.bounds;
  if(wall.thickness>=transverseLimit(originalBounds,axes)-1e-6)
   throw Error('指定した壁厚では、断面の幅に内側の空間が残りません。');
 }finally{bounds.delete();}
 const faces=base.faces,opening=[];
 const ends=[{key:'start',z:rings[0].z,sign:-1},{key:'end',z:rings.at(-1).z,sign:1}]
  .filter(end=>wall.opening==='both'||wall.opening===end.key);
 let result;
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const normal=face.normalAt(),center=face.center;
   try{
    const alignment=new Vector3(...normal.toTuple()).dot(n),z=new Vector3(...center.toTuple()).dot(n);
    if(ends.some(end=>alignment*end.sign>1-1e-6&&Math.abs(z-end.z)<1e-4))opening.push(face);
   }finally{normal.delete();center.delete();}
  }
  if(opening.length!==ends.length)throw Error('フォームの開口面を特定できません。断面を確認してください。');
  result=shellBody(base,{thickness:wall.thickness,direction:'内側'},null,opening);
  const parts=result.solids,resultBounds=result.boundingBox;
  try{
   const outer=originalBounds.flat(),hollow=resultBounds.bounds.flat();
   if(parts.length!==1||outer.some((v,i)=>Math.abs(v-hollow[i])>.02))
    throw Error('外形を保ったまま薄肉化できませんでした。壁厚や開口を変更してください。');
  }finally{parts.forEach(part=>part.delete());resultBounds.delete();}
  const solid=result;result=null;return solid;
 }finally{faces.forEach(face=>face.delete());result?.delete();}
}
