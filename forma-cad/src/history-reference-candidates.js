import {Triangle,Line3,Vector3} from 'three';
import {cadPosition} from './cad-coordinates.js';
import {cadFaceGeometry} from './face-selection.js';

const limit=4;
const vector=value=>value?.length===3?new Vector3(...value):null;
const segments=points=>points.slice(1).flatMap((point,i)=>[...points[i],...point]);

export function nearbyRepairEdges(geometry,reference,originalHighlight){
 const position=cadPosition(geometry),origin=vector(reference.point);
 if(!origin)return [];
 const a=new Vector3(),b=new Vector3(),nearest=new Vector3(),direction=new Vector3();
 const old=originalHighlight?.length===6?new Vector3().fromArray(originalHighlight,3).sub(new Vector3().fromArray(originalHighlight)).normalize():null;
 const line=new Line3(a,b),found=new Map();
 for(let i=0;i<position.count;i+=2){
  a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);
  const length=a.distanceTo(b);
  if(length<1e-6)continue;
  const curve=geometry.userData.circularEdges?.get(i)||geometry.userData.arcEdges?.get(i);
  const distance=line.closestPointToPoint(origin,true,nearest).distanceTo(origin);
  const alignment=old?Math.abs(direction.subVectors(b,a).divideScalar(length).dot(old)):1;
  const score=distance+(1-alignment)*Math.min(8,length/2);
  const key=curve||i;
  if(score>=(found.get(key)?.score??Infinity))continue;
  found.set(key,{score,distance,point:a.clone().lerp(b,.5).toArray(),curve,ends:[...a.toArray(),...b.toArray()]});
 }
 return [...found.values()].sort((a,b)=>a.score-b.score).slice(0,limit).map(row=>({
  point:row.point,distance:row.distance,points:row.curve?segments(row.curve.points):row.ends,
 }));
}

export function nearbyRepairFaces(geometry,reference,{normal:oldNormal,planarOnly=false}={}){
 const position=cadPosition(geometry),index=geometry.index,count=index?.count??position.count;
 const groups=geometry.userData.faceGroups,planar=geometry.userData.planarFaces;
 const normal=oldNormal||vector(reference.normal)?.normalize();
 const origin=vector(reference.point);
 const planeOffset=Number.isFinite(reference.offset)?reference.offset:null;
 if(!origin&&(!normal||planeOffset===null))return [];
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),closest=new Vector3(),n=new Vector3(),center=new Vector3();
 const triangle=new Triangle(a,b,c),found=new Map();
 let groupIndex=0;
 for(let i=0;i<count;i+=3){
  while(groups?.[groupIndex]&&i>=groups[groupIndex].start+groups[groupIndex].count)groupIndex++;
  const entry=groups?.[groupIndex],group=entry&&i>=entry.start?entry:null;
  if(planarOnly&&group&&Array.isArray(planar)&&!planar.includes(group.faceId))continue;
  a.fromBufferAttribute(position,index?index.getX(i):i);
  b.fromBufferAttribute(position,index?index.getX(i+1):i+1);
  c.fromBufferAttribute(position,index?index.getX(i+2):i+2);
  triangle.getNormal(n);if(!n.lengthSq())continue;
  triangle.getMidpoint(center);
  const distance=origin?triangle.closestPointToPoint(origin,closest).distanceTo(origin):Math.abs(normal.dot(center)-planeOffset);
  const score=distance+(normal?1-n.dot(normal):0)*6;
  const key=group??[...n.toArray(),n.dot(a)].map(v=>Math.round(v*1e5)).join(',');
  const existing=found.get(key);
  if(existing&&!group)existing.indices.push(i);
  if(score>=(existing?.score??Infinity))continue;
  found.set(key,{group,indices:existing?.indices??[i],score,distance,point:center.toArray(),normal:n.toArray()});
 }
 return [...found.values()].sort((a,b)=>a.score-b.score).slice(0,limit).map(row=>{
  let points;
  if(row.group){
   const selection=cadFaceGeometry(geometry,row.group);
   try{points=Array.from(selection.attributes.position.array);}finally{selection.dispose();}
  }else{
   points=row.indices.flatMap(i=>[i,i+1,i+2].flatMap(j=>a.fromBufferAttribute(position,index?index.getX(j):j).toArray()));
  }
  return {point:row.point,normal:row.normal,distance:row.distance,points};
 });
}
