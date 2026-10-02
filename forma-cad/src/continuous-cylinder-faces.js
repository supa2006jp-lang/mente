import * as THREE from 'three';
const cache=new WeakMap();
// OCCT section cuts may leave two adjacent faces on the same cylinder.
// Join only coincident cylindrical surfaces that share a boundary, within one mesh.
export function continuousCylinderGroup(geometry,group){
 const groups=geometry.userData.faceGroups,planar=geometry.userData.planarFaces;
 if(!groups||!planar||planar.includes(group.faceId))return group;
 let entry=cache.get(geometry);if(!entry){entry={fits:new Map(),groups:new Map()};cache.set(geometry,entry);}
 if(entry.groups.has(group))return entry.groups.get(group);
 const p=geometry.attributes.position,n=geometry.attributes.normal,ix=geometry.index;
 if(!n)return group;
 const fit=part=>{
  if(entry.fits.has(part))return entry.fits.get(part);
  const samples=[],seen=new Set();for(let i=part.start;i<part.start+part.count;i++){const k=ix?ix.getX(i):i;if(seen.has(k))continue;seen.add(k);samples.push({p:new THREE.Vector3().fromBufferAttribute(p,k),n:new THREE.Vector3().fromBufferAttribute(n,k).normalize()});}
  const first=samples[0],second=first&&samples.find(s=>first.n.clone().cross(s.n).length()>.2);let cylinder=null;
  if(second){
   const axis=first.n.clone().cross(second.n).normalize();if(axis.toArray().find(v=>Math.abs(v)>1e-6)<0)axis.negate();
   const dn=second.n.clone().sub(first.n),radius=second.p.clone().sub(first.p).dot(dn)/dn.lengthSq(),origin=first.p.clone().addScaledVector(first.n,-radius);origin.addScaledVector(axis,-origin.dot(axis));
   const tolerance=Math.max(1e-4,Math.abs(radius)*1e-5);
   if(Math.abs(radius)>.001&&samples.every(s=>Math.abs(s.n.dot(axis))<1e-4&&s.p.clone().sub(origin).addScaledVector(axis,-s.p.dot(axis)).addScaledVector(s.n,-radius).length()<tolerance)){
    const keys=new Set(samples.map(s=>s.p.toArray().map(v=>Math.round(v*1e4)).join(',')));cylinder={axis,origin,radius,tolerance,keys};
   }
  }
  entry.fits.set(part,cylinder);return cylinder;
 };
 const seed=fit(group);if(!seed){entry.groups.set(group,group);return group;}
 const compatible=groups.filter(part=>!planar.includes(part.faceId)&&(()=>{const c=fit(part);return c&&c.axis.dot(seed.axis)>.999999&&Math.abs(c.radius-seed.radius)<seed.tolerance&&c.origin.distanceTo(seed.origin)<seed.tolerance;})());
 const parts=[group],keys=new Set(seed.keys);let changed=true;
 while(changed){changed=false;for(const part of compatible){if(parts.includes(part))continue;let shared=0;for(const key of fit(part).keys)if(keys.has(key)&&++shared>=2)break;if(shared<2)continue;parts.push(part);for(const key of fit(part).keys)keys.add(key);changed=true;}}
 parts.sort((a,b)=>a.start-b.start);
 const result={...parts[0],parts,cylinder:{radius:Math.abs(seed.radius),internal:seed.radius<0}};for(const part of parts)entry.groups.set(part,result);return result;
}
