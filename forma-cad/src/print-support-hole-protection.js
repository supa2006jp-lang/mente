import * as R from 'replicad';
import {roundOpenings,supportWireCircle} from './print-support-bores.js';
import {supportShapeBounds} from './print-support-solid-groups.js';

const tolerance=1e-4;
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const subtract=(a,b)=>a.map((value,index)=>value-b[index]);
const distance=(a,b)=>Math.hypot(...subtract(a,b));
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export const maxSupportHoleProtections=32;
export const supportHoleProtectionLimits={depth:[.05,10000],outside:[0,10000],margin:[0,20]};

export function sameSupportHole(a,b){
 return distance(a.center,b.center)<=tolerance&&Math.abs(a.radius-b.radius)<=tolerance&&dot(a.axis,b.axis)>1-1e-8;
}

export function validateSupportHoleProtections(input){
 const error=()=>Error('穴の保護範囲の指定が不正です。深さ・入口の外側・穴の縁からの余白を確認してください');
 if(!Array.isArray(input)||input.length>maxSupportHoleProtections)throw error();
 const result=[];
 for(const row of input){
  if(!vector(row?.center)||!vector(row.axis)||!Number.isFinite(row.radius)||row.radius<=tolerance)throw error();
  const length=Math.hypot(...row.axis);
  if(Math.abs(length-1)>1e-4)throw error();
  const {radius,depth,outside,margin}=row;
  for(const [key,[min,max]] of Object.entries(supportHoleProtectionLimits)){
   if(!Number.isFinite(row[key])||row[key]<min||row[key]>max)throw error();
  }
  const hole={center:[...row.center],axis:row.axis.map(value=>value/length),radius,depth,outside,margin};
  if(result.some(saved=>sameSupportHole(saved,hole)))throw error();
  result.push(hole);
 }
 return result;
}

export function listSupportHoleOpenings(shape,{suggestDepth=true}={}){
 const openings=[],floors=[],faces=shape.faces;
 let solids,distanceToModel;
 function openAt(values){
  solids??=shape.solids.map(solid=>({solid,bounds:supportShapeBounds(solid)}));
  distanceToModel??=new R.DistanceTool();
  const point=R.makeVertex(values);
  try{
   return solids.every(({solid,bounds:[low,high]})=>values.some((value,index)=>value<low[index]||value>high[index])||
    distanceToModel.distanceBetween(solid,point)>1e-6);
  }finally{point.delete();}
 }
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const circles=roundOpenings(face);
   if(!circles.length&&!suggestDepth)continue;
   const normal=face.normalAt();
   let axis;
   try{axis=normal.toTuple();}finally{normal.delete();}
   if(circles.length){
    for(const circle of circles){
     const hole={...circle,axis};
     if(circle.radius<=tolerance||openings.some(other=>sameSupportHole(hole,other)))continue;
     // The ring at the base of a round boss is also an inner wire. Check
     // the bore centre and the open side of its rim to exclude solid and hollow bosses.
     const tangent=Math.abs(axis[0])<.8?[0,axis[2],-axis[1]]:[-axis[2],0,axis[0]];
     const rim=(circle.radius-Math.min(.02,circle.radius*.1))/Math.hypot(...tangent);
     if(openAt(circle.center.map((value,index)=>value-axis[index]*.0005))&&
      openAt(circle.center.map((value,index)=>value+axis[index]*.0005+tangent[index]*rim)))openings.push(hole);
    }
   }else{
    const wire=face.clone().outerWire();
    try{
     const circle=supportWireCircle(wire);
     if(circle&&Math.abs(R.measureArea(face)-Math.PI*circle.radius**2)<tolerance)floors.push({...circle,axis});
    }finally{wire.delete();}
   }
  }
 }finally{distanceToModel?.delete();solids?.forEach(({solid})=>solid.delete());faces.forEach(face=>face.delete());}
 if(!suggestDepth)return openings;
 // Through holes have an opposite mouth. Flat-bottom holes expose a disk
 // that faces the mouth. For other profiles suggest a depth the user can edit.
 return openings.map(hole=>{
  const ends=[...openings.filter(end=>dot(hole.axis,end.axis)<-1+1e-8),
   ...floors.filter(end=>dot(hole.axis,end.axis)>1-1e-8)];
  let depth=Infinity;
  for(const end of ends){
   if(end.radius>hole.radius+tolerance||end.radius<hole.radius*.5)continue;
   const delta=subtract(hole.center,end.center),along=dot(delta,hole.axis);
   if(along<=tolerance||along>=depth)continue;
   if(distance(delta,hole.axis.map(value=>value*along))<=tolerance)depth=along;
  }
  const [min,max]=supportHoleProtectionLimits.depth;
  return {...hole,depth:Math.max(min,Math.min(max,Number((Number.isFinite(depth)?depth:2*hole.radius).toFixed(3))))};
 });
}

export function supportHoleProtectionTools(model,settings,hold){
 if(!settings?.length)return [];
 const openings=listSupportHoleOpenings(model,{suggestDepth:false});
 return settings.map(hole=>{
  const matches=openings.filter(opening=>distance(opening.center,hole.center)<=tolerance&&dot(opening.axis,hole.axis)>1-1e-8);
  const opening=matches.find(candidate=>sameSupportHole(candidate,hole))||(matches.length===1?matches[0]:null);
  if(!opening)throw Error('保護する穴の入口が見つかりません。リブサポートの設定で穴を選び直してください');
  const protection={...hole,...opening};
  const shape=hold(supportHoleCylinder(protection));
  return {shape,bounds:supportShapeBounds(shape),protection};
 });
}

export function supportHoleCylinder({center,axis,radius,depth,outside,margin},endPad=0){
 const start=center.map((value,index)=>value-axis[index]*(depth+endPad));
 return R.makeCylinder(radius+margin,depth+outside+2*endPad,start,axis);
}
