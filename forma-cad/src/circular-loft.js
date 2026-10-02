import * as R from 'replicad';
import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';

function circularSection(section){
 const points=section?.outer;
 if(!Array.isArray(points)||points.length<96||section.holes?.length)return null;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const [x,y] of points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const center2=[(minX+maxX)/2,(minY+maxY)/2],rx=(maxX-minX)/2,ry=(maxY-minY)/2,radius=(rx+ry)/2;
 const tolerance=Math.max(.001,radius*1e-4);
 if(!(radius>.01)||Math.abs(rx-ry)>tolerance||points.some(([x,y])=>Math.abs(Math.hypot(x-center2[0],y-center2[1])-radius)>tolerance))return null;
 let longestEdge=0;
 for(let i=0;i<points.length;i++)longestEdge=Math.max(longestEdge,Math.hypot(points[i][0]-points[(i+1)%points.length][0],points[i][1]-points[(i+1)%points.length][1]));
 const basis=basisFor(section);
 return {center:worldPoint(section,center2).toArray(),normal:basis.n.toArray(),radial:basis.u.toArray(),radius,sagitta:radius-Math.sqrt(Math.max(0,radius*radius-longestEdge*longestEdge/4))};
}

export function coaxialCircularLoftInfo(sections){
 if(!Array.isArray(sections)||sections.length!==2)return null;
 const first=circularSection(sections[0]),last=circularSection(sections[1]);
 if(!first||!last)return null;
 const origin=new THREE.Vector3(...first.center),delta=new THREE.Vector3(...last.center).sub(origin),height=delta.length();
 if(height<1e-4)return null;
 const axis=delta.multiplyScalar(1/height),firstNormal=new THREE.Vector3(...first.normal),lastNormal=new THREE.Vector3(...last.normal);
 if(Math.abs(firstNormal.dot(axis))<.999999||Math.abs(lastNormal.dot(axis))<.999999)return null;
 const radial=new THREE.Vector3(...first.radial).addScaledVector(axis,-new THREE.Vector3(...first.radial).dot(axis)).normalize();
 return {origin:first.center,axis:axis.toArray(),radial:radial.toArray(),height,r0:first.radius,r1:last.radius,sagitta:Math.max(first.sagitta,last.sagitta)};
}

function revolveProfile(info,from,to,inset=0){
 const slope=(info.r1-info.r0)/info.height,lowRadius=info.r0+slope*from-inset,highRadius=info.r0+slope*to-inset;
 if(!(to>from&&lowRadius>.01&&highRadius>.01))throw Error('円形ロフトの断面寸法を確認してください');
 const radial=new THREE.Vector3(...info.radial),axis=new THREE.Vector3(...info.axis),plane=new R.Plane(info.origin,info.radial,radial.cross(axis).toArray());
 try{return R.draw([0,from]).lineTo([lowRadius,from]).lineTo([highRadius,to]).lineTo([0,to]).close().sketchOnPlane(plane).revolve(info.axis,{origin:info.origin,angle:360});}
 finally{plane.delete();}
}

function revolveExpandedProfile(info,bottom,thickness,inset){
 const start=bottom-thickness,radial=new THREE.Vector3(...info.radial),axis=new THREE.Vector3(...info.axis),plane=new R.Plane(info.origin,info.radial,radial.cross(axis).toArray());
 try{return R.draw([0,start]).lineTo([info.r0+inset,start]).lineTo([info.r0+inset,0]).lineTo([info.r1+inset,info.height]).lineTo([0,info.height]).close().sketchOnPlane(plane).revolve(info.axis,{origin:info.origin,angle:360});}
 finally{plane.delete();}
}

export function makeCoaxialCircularLoft(info){
 return revolveProfile(info,0,info.height);
}

export function shellCoaxialCircularLoft(base,opening,info,thickness,direction='内側'){
 if(!info||opening?.geomType!=='PLANE')return null;
 const center=R.makeVertex(new THREE.Vector3(...info.origin).addScaledVector(new THREE.Vector3(...info.axis),info.height).toArray());
 try{if(R.measureDistanceBetween(center,opening)>.2)return null;}finally{center.delete();}
 const axis=new THREE.Vector3(...info.axis),origin=new THREE.Vector3(...info.origin),vertices=base.mesh({tolerance:.1,angularTolerance:.15}).vertices;
 let bottom=Infinity,top=-Infinity;
 const slope=(info.r1-info.r0)/info.height,tolerance=Math.max(.15,Math.max(info.r0,info.r1)*.003);
 for(let i=0;i<vertices.length;i+=3){
  const position=new THREE.Vector3(vertices[i],vertices[i+1],vertices[i+2]).sub(origin),height=position.dot(axis),radius=position.addScaledVector(axis,-height).length();
  bottom=Math.min(bottom,height);top=Math.max(top,height);
  if(radius>info.r0+slope*Math.max(0,Math.min(info.height,height))+tolerance)return null;
 }
 if(!Number.isFinite(bottom)||Math.abs(top-info.height)>.2)return null;
 const floor=bottom+thickness,ceiling=info.height+Math.max(1,thickness),inset=thickness*Math.hypot(1,slope)+info.sagitta+.005;
 if(direction!=='外側'&&(floor>=info.height-.01||info.r0+slope*floor-inset<=.01||info.r0+slope*ceiling-inset<=.01))return null;
 let tool,result;
 try{
  if(direction==='外側'){tool=revolveExpandedProfile(info,bottom,thickness,inset);result=tool.cut(base);}
  else{tool=revolveProfile(info,floor,ceiling,inset);result=base.cut(tool);}
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);
  let valid;
  try{valid=check.IsValid();}finally{check.delete();}
  const solids=result.solids;
  try{valid=valid&&solids.length===1;}finally{solids.forEach(solid=>solid.delete());}
  const originalVolume=R.measureVolume(base),volume=R.measureVolume(result);
  if(!valid||!Number.isFinite(volume)||volume<=1e-8||(direction!=='外側'&&originalVolume-volume<=Math.max(1e-7,originalVolume*1e-8)))return null;
  const openingCenter=R.makeVertex(new THREE.Vector3(...info.origin).addScaledVector(axis,info.height).toArray());
  try{if(R.measureDistanceBetween(openingCenter,result)<.2)return null;}finally{openingCenter.delete();}
  const output=result;result=null;return output;
 }finally{result?.delete();tool?.delete();}
}
