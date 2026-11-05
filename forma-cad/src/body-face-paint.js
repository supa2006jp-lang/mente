import * as THREE from 'three';
import {copyCadCoordinates} from './cad-coordinates.js';
import {qrTriangleColors} from './qr-code-display.js';
import {planarFace} from './frames.js';
import {CLEAR_COLOR,CLEAR_OPACITY,colorChoiceRgb,isColorChoice} from './color-choice.js';

const paintByGeometry=new WeakMap();

function signature(geometry,ranges){
 const position=geometry.attributes.position,index=geometry.index;
 const bits=new Uint32Array(position.array.buffer,position.array.byteOffset,position.array.length);
 let hash=2166136261;
 for(const range of ranges){
  const {start,count}=range??{};
  if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<=0||
   start%3||count%3||start+count>(index?.count??position.count))return null;
  for(let i=start;i<start+count;i++){
   const vertex=index?index.getX(i):i;
   for(let k=0;k<3;k++)hash=Math.imul(hash^bits[vertex*3+k],16777619);
  }
 }
 return (hash>>>0).toString(16);
}

export function facePaintReference(geometry,ranges){
 if(!ranges.length)return null;
 const fingerprint=signature(geometry,ranges);
 return fingerprint?{ranges:mergeAdjacentRanges(ranges),fingerprint,plane:describePlane(geometry,ranges)}:null;
}

function mergeAdjacentRanges(ranges){
 const merged=[];
 for(const range of ranges){
  const previous=merged.at(-1);
  if(previous&&previous.start+previous.count===range?.start)previous.count+=range.count;
  else merged.push({...range});
 }
 return merged;
}

function triangleReader(geometry){
 const position=geometry.attributes.position,index=geometry.index;
 return (slot,target)=>target.fromBufferAttribute(position,index?index.getX(slot):slot);
}

function describePlane(geometry,ranges){
 const read=triangleReader(geometry),start=ranges[0].start;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 read(start,a);read(start+1,b);read(start+2,c);
 const normal=b.sub(a).cross(c.sub(a)).normalize();
 if(!normal.lengthSq())return null;
 const offset=normal.dot(a),bounds=new THREE.Box3(),point=new THREE.Vector3();
 for(const {start,count} of ranges)for(let i=start;i<start+count;i++){
  read(i,point);
  if(Math.abs(normal.dot(point)-offset)>.0001)return null;
  bounds.expandByPoint(point);
 }
 if(!geometry.boundingBox)geometry.computeBoundingBox();
 const axis=normal.toArray().findIndex(value=>Math.abs(value)>.999999);
 const boundary=axis<0?null:normal.getComponent(axis)>0?'max':'min';
 const extreme=boundary&&Math.abs(bounds[boundary].getComponent(axis)-geometry.boundingBox[boundary].getComponent(axis))<=.0001;
 const bodySize=geometry.boundingBox.getSize(new THREE.Vector3());
 const relative=point=>point.clone().sub(geometry.boundingBox.min).divide(bodySize).toArray();
 return {normal:normal.toArray(),offset,min:bounds.min.toArray(),max:bounds.max.toArray(),
  ...(extreme?{axis,boundary,relativeMin:relative(bounds.min),relativeMax:relative(bounds.max)}:{})};
}

const validPoint=point=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
function matchingPlane(geometry,plane,offset,atBoundary){
 const normal=new THREE.Vector3(...plane.normal),read=triangleReader(geometry);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),edge=new THREE.Vector3();
 const visited=new Set(),matches=[];
 const count=geometry.index?.count??geometry.attributes.position.count;
 for(let i=0;i<count;i+=3){
  if(visited.has(i))continue;
  read(i,a);read(i+1,b);read(i+2,c);
  if([a,b,c].some(point=>Math.abs(normal.dot(point)-offset)>.0001))continue;
  if(b.sub(a).cross(edge.subVectors(c,a)).normalize().dot(normal)<.999999)continue;
  let ranges;
  try{ranges=planarFace(geometry,i/3,{includeTriangles:true}).triangleRanges;}catch{continue;}
  if(!ranges.length)continue;
  for(const range of ranges)for(let j=range.start;j<range.start+range.count;j+=3)visited.add(j);
  const candidate=describePlane(geometry,ranges);
  if(!candidate||atBoundary&&candidate.boundary!==plane.boundary)continue;
  const relative=atBoundary&&[plane.relativeMin,plane.relativeMax,candidate.relativeMin,candidate.relativeMax].every(validPoint);
  const firstMin=relative?plane.relativeMin:plane.min,firstMax=relative?plane.relativeMax:plane.max;
  const secondMin=relative?candidate.relativeMin:candidate.min,secondMax=relative?candidate.relativeMax:candidate.max;
  const overlap=firstMin.every((min,axis)=>{
   if(atBoundary&&axis===plane.axis)return true;
   const max=firstMax[axis],otherMin=secondMin[axis],otherMax=secondMax[axis];
   const shared=Math.min(max,otherMax)-Math.max(min,otherMin);
   const span=atBoundary?Math.max(max-min,otherMax-otherMin):Math.min(max-min,otherMax-otherMin);
   return shared>=span*.75-.0001;
  });
  if(overlap)matches.push(ranges);
  if(matches.length>1)return {ambiguous:true};
 }
 return {ranges:matches[0]};
}

export function remapFacePaint(geometry,face,previous){
 if(face?.unresolved||!Array.isArray(face?.ranges)||!face.ranges.length)return face;
 if(signature(geometry,face.ranges)===face.fingerprint)return face;
 const plane=face.plane||(previous&&signature(previous,face.ranges)===face.fingerprint?
  describePlane(previous,face.ranges):null);
 if(plane&&[plane.normal,plane.min,plane.max].every(validPoint)&&Number.isFinite(plane.offset)){
  let match=matchingPlane(geometry,plane,plane.offset,false);
  if(!match.ranges&&!match.ambiguous&&[0,1,2].includes(plane.axis)&&['min','max'].includes(plane.boundary)){
   if(!geometry.boundingBox)geometry.computeBoundingBox();
   const offset=plane.normal[plane.axis]*geometry.boundingBox[plane.boundary].getComponent(plane.axis);
   if(Math.abs(offset-plane.offset)>.0001)match=matchingPlane(geometry,plane,offset,true);
  }
  if(match.ranges)return {...facePaintReference(geometry,match.ranges),color:face.color};
 }
 const native=geometry.userData.faceGroups?.find(group=>signature(geometry,[group])===face.fingerprint);
 if(native)return {...facePaintReference(geometry,[{start:native.start,count:native.count}]),color:face.color};
 return {...face,unresolved:true};
}

export function samePaintedFace(a,b){
 if(a?.fingerprint!==b.fingerprint||!Array.isArray(a.ranges))return false;
 const first=mergeAdjacentRanges(a.ranges),second=mergeAdjacentRanges(b.ranges);
 return first.length===second.length&&first.every((range,i)=>range.start===second[i].start&&range.count===second[i].count);
}

// The ranges refer to the original triangle order. Check the vertices before
// using them so a CAD operation cannot silently paint an unrelated face.
export function prepareBodyPaint(source,faces=[]){
 const layers=faces.filter(face=>!face?.unresolved&&Array.isArray(face?.ranges)&&face.ranges.length&&
  isColorChoice(face.color)&&signature(source,face.ranges)===face.fingerprint);
 const qr=qrTriangleColors(source);
 if(!layers.length&&!qr)return source;
 const geometry=source.index?source.toNonIndexed():source;
 if(geometry!==source){geometry.userData={...source.userData};copyCadCoordinates(source,geometry);}
 const palette=[],slots=new Uint16Array(geometry.attributes.position.count/3);
 function slot(color){
  color=color.toLowerCase();
  if(!palette.includes(color))palette.push(color);
  return palette.indexOf(color)+1;
 }
 if(qr){
  const black=slot('#000000'),white=slot('#ffffff');
  for(let i=0;i<qr.length;i++)slots[i]=qr[i]===1?black:qr[i]===2?white:0;
 }
 for(const face of layers){
  const value=slot(face.color);
  for(const {start,count} of face.ranges)slots.fill(value,start/3,(start+count)/3);
 }
 const used=new Set(slots);
 paintByGeometry.set(geometry,{layers,palette,slots,hasBase:used.has(0),
  colors:palette.filter((_,i)=>used.has(i+1))});
 return geometry;
}

export function bodyPaint(geometry){return paintByGeometry.get(geometry);}

export function updateBodyPaint(geometry,base){
 const paint=bodyPaint(geometry);
 if(!paint)return;
 const hasAlpha=paint.colors.includes(CLEAR_COLOR),size=hasAlpha?4:3;
 const colors=[base,...paint.palette].map(color=>{
  const rgb=new THREE.Color(colorChoiceRgb(color)).toArray();
  return [...rgb,color===CLEAR_COLOR?CLEAR_OPACITY:1];
 });
 let attr=geometry.getAttribute('color');
 if(attr?.itemSize!==size){
  attr=new THREE.Float32BufferAttribute(new Float32Array(paint.slots.length*3*size),size);
  geometry.setAttribute('color',attr);
 }
 for(let i=0;i<paint.slots.length;i++){
  const color=colors[paint.slots[i]];
  for(let j=0;j<3;j++){
   if(hasAlpha)attr.setXYZW(i*3+j,...color);
   else attr.setXYZ(i*3+j,...color);
  }
 }
 attr.needsUpdate=true;
}
