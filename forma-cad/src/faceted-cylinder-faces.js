import * as THREE from 'three';
import {cylindricalRimWalls} from './cylindrical-rim-walls.js';

const cache=new WeakMap();
// Older circular extrusions stored each sampled arc segment as a planar CAD face.
// Use circular recipes or matching top/bottom rims; keep cut planes separate.
export function facetedCylinderGroup(geometry,group){
 let hints=geometry.userData.circularWalls||[];const groups=geometry.userData.faceGroups;
 if(!groups||geometry.userData.planarFaces&&!geometry.userData.planarFaces.includes(group.faceId))return group;
 let entry=cache.get(geometry);if(!entry){entry={groups:new Map(),samples:new Map()};cache.set(geometry,entry);}
 if(entry.groups.has(group))return entry.groups.get(group);
 const p=geometry.attributes.position,ix=geometry.index;
 const samples=part=>{
  if(entry.samples.has(part))return entry.samples.get(part);
  const points=[],normals=[],seen=new Set();
  for(let i=part.start;i<part.start+part.count;i+=3){
   const triangle=[0,1,2].map(j=>{const k=ix?ix.getX(i+j):i+j;if(!seen.has(k)){seen.add(k);points.push(new THREE.Vector3().fromBufferAttribute(p,k));}return new THREE.Vector3().fromBufferAttribute(p,k);});
   normals.push(triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize());
  }
  const result={points,normals,keys:new Set(points.map(v=>v.toArray().map(x=>Math.round(x*1e4)).join(',')))};entry.samples.set(part,result);return result;
 };
 const coincident=(a,b)=>Math.abs(a.axis.dot(b.axis))>.999999&&Math.abs(a.radius-b.radius)<.0001&&a.origin.clone().sub(b.origin).cross(a.axis).length()<.0001;
 const matches=(part,hint,extents)=>{
  const {points,normals}=samples(part),{axis,origin,radius,tolerance}=hint;
  if(!points.length||normals.some(n=>Math.abs(n.dot(axis))>.001))return false;
  return points.every(point=>{const delta=point.clone().sub(origin),height=delta.dot(axis);delta.addScaledVector(axis,-height);return extents.some(h=>{const z=point.clone().sub(h.origin).dot(h.axis);return z>=h.min-h.tolerance&&z<=h.max+h.tolerance;})&&Math.abs(delta.length()-radius)<=tolerance&&normals.every(n=>Math.abs(n.dot(delta.clone().normalize()))>.98);});
 };
 let seed=hints.find(h=>matches(group,h,hints.filter(other=>coincident(h,other))));
 if(!seed){
  if(!entry.rims)entry.rims=cylindricalRimWalls(geometry);
  hints=[...hints,...entry.rims];seed=hints.find(h=>matches(group,h,hints.filter(other=>coincident(h,other))));
 }
 if(!seed){entry.groups.set(group,group);return group;}
 const seedPoint=samples(group).points[0],radial=seedPoint.clone().sub(seed.origin);radial.addScaledVector(seed.axis,-radial.dot(seed.axis));
 const internal=samples(group).normals[0].dot(radial)<0;
 const sameCylinder=hints.filter(h=>coincident(h,seed));
 const compatible=groups.filter(part=>matches(part,seed,sameCylinder)&&samples(part).normals.every(n=>n.dot(samples(part).points[0].clone().sub(seed.origin))*(internal?-1:1)>0));
 const parts=[group],keys=new Set(samples(group).keys);let changed=true;
 while(changed){changed=false;for(const part of compatible){if(parts.includes(part))continue;let shared=0;for(const key of samples(part).keys)if(keys.has(key)&&++shared>=2)break;if(shared<2)continue;parts.push(part);for(const key of samples(part).keys)keys.add(key);changed=true;}}
 // One plane is insufficient evidence of a sampled cylindrical surface.
 if(parts.length<3){entry.groups.set(group,group);return group;}
 parts.sort((a,b)=>a.start-b.start);
 const result={...parts[0],parts,cylinder:{radius:seed.radius,internal}};for(const part of parts)entry.groups.set(part,result);return result;
}
