import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {circularRing} from './circular-ring.js';

export function extrusionCircularWalls(f){
 if(f.kind==='sketch'||f.kind==='cadop'||f.kind==='plane'||f.kind==='referenceImage'||f.taperAngle||f.holesOnly)return [];
 const profile=f.region||f,axis=basisFor(profile).n,min=Math.min(0,f.depth),max=Math.max(0,f.depth);
 let circles=[];
 if(f.profile==='circle')circles=[{origin:new THREE.Vector3(f.x,f.y,f.z),radius:f.diameter/2,hole:false}];
 else if(f.profile==='region')circles=[f.region.outer,...((f.mode==='solid'&&f.capHoles)||(f.mode==='thin'&&f.skipHoleWalls)?[]:f.region.holes)].flatMap((ring,i)=>{
  const circle=circularRing(ring);return circle?[{origin:worldPoint(profile,circle.center),radius:circle.radius,hole:i>0}]:[];
 });
 return circles.flatMap(c=>{
  const out=f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0,inn=f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0;
  const radii=f.mode==='thin'?(c.hole?[c.radius+inn,c.radius-out]:[c.radius+out,c.radius-inn]):[c.radius];
  return radii.filter(radius=>radius>0).map(radius=>({...c,axis,min,max,radius,tolerance:Math.max(.002,radius*.003)}));
 });
}
export function matchingExtrusionWall(f,point,normal){
 return extrusionCircularWalls(f).find(c=>{
  const delta=point.clone().sub(c.origin),height=delta.dot(c.axis),radial=delta.addScaledVector(c.axis,-height);
  return Math.abs(radial.length()-c.radius)<=c.tolerance&&height>=c.min-c.tolerance&&height<=c.max+c.tolerance&&(!normal||Math.abs(normal.dot(c.axis))<.05);
 });
}
