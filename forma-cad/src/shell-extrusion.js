import * as R from 'replicad';
import {selectedCadFaces} from './face-pull.js';
import {shellBody} from './shell.js';

function commonArea(a,b){
 const check=new (R.getOC().BRepAlgoAPI_Common)(a.wrapped,b.wrapped);
 let intersection;
 try{
  check.SetNonDestructive(true);
  check.Build();
  if(check.HasErrors())return NaN;
  intersection=R.cast(check.Shape());
  return R.measureArea(intersection);
 }finally{intersection?.delete();check.delete();}
}

export function shellJoinedExtrusion(base,extrusion,previousBodies,direction,p,onRemoved){
 const openingError='直前に結合した押し出しの先端面を開口に選択してください';
 if(p.direction!=='内側'||p.faces?.length!==1)throw Error(openingError);
 const faces=selectedCadFaces(base,p.faces);
 let toolFaces=[],hollow,cavity,result;
 try{
  try{toolFaces=selectedCadFaces(extrusion,p.faces);}catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;throw Error(openingError);}
  const [opening]=faces,[toolOpening]=toolFaces;
  if(opening.geomType!=='PLANE'||toolOpening.geomType!=='PLANE')throw Error(openingError);
  const normal=toolOpening.normalAt();
  try{if(normal.toTuple().reduce((dot,value,index)=>dot+value*direction[index],0)<1-1e-7)throw Error(openingError);}
  finally{normal.delete();}
  const area=R.measureArea(opening),overlap=commonArea(opening,toolOpening),areaTolerance=Math.max(1e-7,area*1e-8);
  if(!Number.isFinite(overlap)||Math.abs(overlap-area)>areaTolerance||Math.abs(R.measureArea(toolOpening)-area)>areaTolerance)throw Error(openingError);

  hollow=shellBody(extrusion,p,null,toolFaces);
  cavity=extrusion.cut(hollow);
  const volume=R.measureVolume(cavity),volumeTolerance=Math.max(1e-7,volume*1e-8);
  if(!(volume>1e-7))throw Error('押し出し部分の内側に空間を作れませんでした');
  for(const previous of previousBodies){
   const overlap=previous.intersect(cavity);
   try{if(!(Math.abs(R.measureVolume(overlap))<=volumeTolerance))throw Error('中空にする範囲が結合前のボディに重なります');}
   finally{overlap.delete();}
  }
  result=base.cut(cavity);
  const removedVolume=R.measureVolume(base)-R.measureVolume(result);
  if(!(Math.abs(removedVolume-volume)<=volumeTolerance))throw Error('結合後の形状から押し出し部分の空間を正確に取り除けませんでした');
  onRemoved?.(cavity);
  const shape=result;result=null;
  return shape;
 }finally{
  faces.forEach(face=>face.delete());
  toolFaces.forEach(face=>face.delete());
  hollow?.delete();cavity?.delete();result?.delete();
 }
}
