import * as R from 'replicad';
import {basisFor} from './frames.js';

const faceArea=wire=>{const face=R.makeFace(wire);try{return Math.abs(R.measureArea(face));}finally{face.delete();}};
function offsetWire(wire,distance,normal,offset){
 const area=faceArea(wire),epsilon=Math.max(1e-7,area*1e-9);
 for(const signed of [distance,-distance]){
  const input=wire.clone();let shifted;
  try{
   shifted=input.offset2D(signed,'intersection');
   if((faceArea(shifted)-area)*Math.sign(distance)<=epsilon)continue;
   const point=shifted.startPoint;let position;
   try{position=point.toTuple().reduce((sum,value,index)=>sum+value*normal[index],0);}finally{point.delete();}
   if(Math.abs(position-offset)>1e-7)shifted=shifted.translate(normal.map(value=>value*(offset-position)));
   const result=shifted;shifted=null;return result;
  }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
  finally{input.delete();shifted?.delete();}
 }
 throw Error('このOS距離では有効な輪郭を作れません。距離を小さくしてください');
}

export function offsetExtrusionSolid(feature,bodies,makeSource){
 const region=feature.region,normal=basisFor(region).n.toArray(),offset=region.offset;
 const source=makeSource({...feature,profileOffset:0,depth:1,symmetric:false,throughAll:false}),faces=source.faces,parts=[];
 const direction=new R.Vector(normal.map(value=>value*feature.depth));
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const center=face.center,n=face.normalAt();let start;
   try{start=Math.abs(center.toTuple().reduce((sum,value,i)=>sum+value*normal[i],0)-offset)<1e-6&&Math.abs(n.toTuple().reduce((sum,value,i)=>sum+value*normal[i],0))>.999999;}
   finally{center.delete();n.delete();}
   if(!start)continue;
   const outer=face.clone().outerWire(),holes=face.clone().innerWires(),shifted=[];let cap;
   try{
    shifted.push(offsetWire(outer,feature.profileOffset,normal,offset));
    for(const hole of holes)shifted.push(offsetWire(hole,-feature.profileOffset,normal,offset));
    const expected=faceArea(shifted[0])-shifted.slice(1).reduce((sum,hole)=>sum+faceArea(hole),0);
    if(expected<=1e-7)throw Error('このOS距離では外周と穴が重なります。距離を小さくしてください');
    for(const reverse of [false,true]){
     const voids=shifted.slice(1).map(hole=>reverse?hole.flipOrientation():hole.clone());let candidate,check;
     try{candidate=R.makeFace(shifted[0],voids);check=new (R.getOC().BRepCheck_Analyzer)(candidate.wrapped,true,false);
      if(check.IsValid()&&Math.abs(R.measureArea(candidate)-expected)<Math.max(1e-5,expected*1e-5)){cap=candidate;candidate=null;break;}
     }finally{candidate?.delete();check?.delete();voids.forEach(hole=>hole.delete());}
    }
    if(!cap)throw Error('OS押出の輪郭が交差しています。距離を小さくしてください');
    const part=R.basicFaceExtrusion(cap,direction);if(R.measureVolume(part)<0)part.wrapped.Reverse();parts.push(part);
   }finally{cap?.delete();shifted.forEach(wire=>wire.delete());outer.delete();holes.forEach(hole=>hole.delete());}
  }
  if(!parts.length)throw Error('OS押出の基準面を確認してください');
  let result=parts[0].clone();
  try{for(const part of parts.slice(1)){const next=result.fuse(part);result.delete();result=next;}const shape=result;result=null;return shape;}
  finally{result?.delete();}
 }finally{direction.delete();parts.forEach(part=>part.delete());faces.forEach(face=>face.delete());source.delete();}
}
