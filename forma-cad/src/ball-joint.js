import * as R from 'replicad';
import * as THREE from 'three';
import {cylinderJointInfo} from './coil-joint.js';
import {fuseSolid} from './solid-fuse.js';

export {cylinderJointInfo as ballJointInfo};
import {ballJointDefaults,ballJointSettings} from './ball-joint-settings.js';
export {ballJointDefaults,ballJointSettings} from './ball-joint-settings.js';
function valid(shape,name){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{if(!check.IsValid()||solids.length!==1||!(R.measureVolume(shape)>1e-6))throw Error(name+'を正常なソリッドにできません。寸法を変更してください');}finally{check.delete();solids.forEach(s=>s.delete());}}
function radialSolid(points){let sketch=R.draw(points[0]);for(const pt of points.slice(1))sketch=sketch.lineTo(pt);return sketch.close().sketchOnPlane(new R.Plane([0,0,0],[1,0,0],[0,-1,0])).revolve([0,0,1]);}
function ridge(s,gap,hold){
 const edges=[],pieces=[],start=s.coneEnd-s.threadPitch,pathLength=s.threadLength+4*s.threadPitch,clipStart=gap?s.coneEnd:s.threadStart,clipEnd=gap?s.nutTop+.15:s.socketTop-.0001;let path,wire;
 try{for(let z=0;z<pathLength-1e-7;z+=s.threadPitch){const part=R.makeHelix(s.threadPitch,Math.min(s.threadPitch,pathLength-z),s.core).translate([0,0,start+z]);pieces.push(part);edges.push(...part.edges);}path=R.assembleWire(edges);
  const half=s.threadPitch*.34+gap*.3,tip=s.threadPitch*.1+gap*.3,points=[[-.12+gap,-half],[s.depth+gap,-tip],[s.depth+gap,tip],[-.12+gap,half]];let profile=R.draw(points[0]);for(const pt of points.slice(1))profile=profile.lineTo(pt);wire=profile.close().sketchOnPlane(new R.Plane([s.core,0,start],[1,0,0],[0,-1,0])).wire;const swept=hold(R.genericSweep(wire,path,{frenet:true}));return hold(swept.intersect(hold(R.makeCylinder(s.core+s.depth+gap+1,clipEnd-clipStart,[0,0,clipStart]))));
 }finally{wire?.delete();path?.delete();edges.forEach(e=>e.delete());pieces.forEach(e=>e.delete());}
}
function place(shapes,info,s,hold){
 const oriented=shape=>{let result=hold(shape.clone());const z=new THREE.Vector3(0,0,1),n=new THREE.Vector3(...info.axis),angle=z.angleTo(n)*180/Math.PI,axis=z.clone().cross(n);if(angle>1e-7)result=hold(result.rotate(angle,[0,0,0],axis.length()<1e-7?[1,0,0]:axis.normalize().toArray()));return hold(result.translate(info.origin));};
 if(s.pose==='assembled')return shapes.map(shape=>oriented(shape).clone());
 if(s.pose==='exploded')return shapes.map((shape,i)=>oriented(hold(shape.clone().translate(i===0?[0,0,-s.r]:i===1?[0,0,s.r]:[s.nutRadius*3,0,0]))).clone());
 let edge=0;return shapes.map((shape,i)=>{let copy=hold(shape.clone());if(i===1)copy=hold(copy.rotate(180,[0,0,0],[1,0,0]));const box=copy.boundingBox;let b;try{b=box.bounds;}finally{box.delete();}copy=hold(copy.translate([edge-b[0][0],-b[0][1],-b[0][2]]));edge+=b[1][0]-b[0][0]+8;return copy.clone();});
}
let cachedJoint=null;
function describe(info,s,overlap){return {...info,settings:Object.fromEntries(Object.keys(ballJointDefaults(info)).map(k=>[k,s[k]])),splitPosition:s.splitPosition,ballDiameter:s.ballDiameter,mouthDiameter:s.mouthRadius*2,neckDiameter:s.neckDiameter,socketDiameter:2*(s.core+s.depth),nutDiameter:s.nutRadius*2,slotCount:s.slotCount,threadPitch:s.threadPitch,engagedTurns:(s.nutTop-s.threadStart)/s.threadPitch,contactTravel:s.contactTravel,clampingTravel:s.clampingTravel,availableTravel:s.availableTravel,overlap,roles:['ball','socket','nut'],pose:s.pose};}
export function makeBallJoint(source,p,onProgress){
 const info=cylinderJointInfo(source),s=ballJointSettings(info,p),owned=[],hold=shape=>(owned.push(shape),shape);let outputs;
 try{
  const key=JSON.stringify([info.radius,info.height,...Object.keys(ballJointDefaults(info)).filter(k=>k!=='pose').map(k=>s[k])]);
  if(cachedJoint?.key===key){outputs=place(cachedJoint.parts,info,s,hold);return {parts:outputs,analysis:describe(info,s,cachedJoint.overlap)};}
  onProgress?.({stage:'球と首を作成しています'});const lower=hold(R.makeCylinder(info.radius,s.lowerEnd)),neck=hold(R.makeCylinder(s.neckDiameter/2,s.r+s.neckLength+.3,[0,0,s.lowerEnd-.2])),sphere=hold(R.makeSphere(s.r).translate([0,0,s.splitPosition]));const ball=hold(fuseSolid(hold(fuseSolid(lower,neck)),sphere));valid(ball,'球側');
  const upper=hold(R.makeCylinder(info.radius,info.height-s.socketTop,[0,0,s.socketTop])),outer=hold(radialSolid([[0,s.mouth],[s.core-s.coneDepth,s.mouth],[s.core,s.coneEnd],[s.core,s.socketTop+.2],[0,s.socketTop+.2]])),cavity=hold(R.makeSphere(s.r+s.clearance).translate([0,0,s.splitPosition])),entry=hold(R.makeCylinder(s.mouthRadius,s.mouth+1,[0,0,-1]));let socket=hold(hold(fuseSolid(upper,outer)).cut(cavity));socket=hold(socket.cut(entry));
  onProgress?.({stage:'受けのねじ山を作成しています'});socket=hold(fuseSolid(socket,ridge(s,0,hold)));
  for(let i=0;i<s.slotCount;i++){const tool=hold(R.makeBox([0,-s.slotWidth/2,s.mouth-.1],[s.core+s.depth+1,s.slotWidth/2,s.root-s.wall*.65]).rotate(i*360/s.slotCount,[0,0,0],[0,0,1]));socket=hold(socket.cut(tool));}valid(socket,'切り込み付き受け');
  onProgress?.({stage:'専用ナットのねじと締め付け面を作成しています'});let nut=hold(R.makeCylinder(s.nutRadius,s.nutTop-s.nutBottom,[0,0,s.nutBottom]));const slope=s.coneDepth/s.coneHeight,bottomRadius=s.core-s.coneDepth+s.threadClearance-(s.mouth-s.nutBottom+.1)*slope,inner=hold(radialSolid([[0,s.nutBottom-.1],[bottomRadius,s.nutBottom-.1],[s.core+s.threadClearance,s.coneEnd],[s.core+s.threadClearance,s.nutTop+.1],[0,s.nutTop+.1]]));nut=hold(nut.cut(inner));nut=hold(nut.cut(ridge(s,s.threadClearance,hold)));
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,tool=hold(R.makeCylinder(1.4,s.nutTop-s.nutBottom+.2,[(s.nutRadius+.7)*Math.cos(angle),(s.nutRadius+.7)*Math.sin(angle),s.nutBottom-.1]));nut=hold(nut.cut(tool));}valid(nut,'専用ナット');
  onProgress?.({stage:'3パーツのすき間を確認しています'});const shapes=[ball,socket,nut],overlap=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const common=hold(shapes[i].intersect(shapes[j])),volume=Math.abs(R.measureVolume(common));if(volume>1e-5)throw Error(['球側','受け側','ナット'][i]+'と'+['球側','受け側','ナット'][j]+'が干渉します（'+volume.toFixed(4)+' mm³）。球・ねじのすき間や寸法を変更してください');overlap.push(volume);}
  cachedJoint?.parts.forEach(shape=>shape.delete());cachedJoint={key,parts:shapes.map(shape=>shape.clone()),overlap};outputs=place(shapes,info,s,hold);outputs.forEach((shape,i)=>valid(shape,['球側','受け側','ナット'][i]));
  return {parts:outputs,analysis:describe(info,s,overlap)};
 }catch(e){outputs?.forEach(shape=>shape.delete());throw e;}finally{owned.reverse().forEach(shape=>shape.delete());}
}
