import * as THREE from 'three';
import {arcEdges} from './arc-edges.js';
import {circularEdges} from './circular-edges.js';
// Boolean meshes can contain T junctions. EdgesGeometry treats their unmatched
// triangle edges as boundaries; discard edges with surface on both sides.
export function bodyEdges(geometry, angle=28){
 const raw=new THREE.EdgesGeometry(geometry,angle);
 // Exact CAD tessellation has shared face boundaries and no CSG T junctions.
 if(geometry.userData.faceGroups?.length){
  const pos=geometry.attributes.position,index=geometry.index,faces=new Map(),key=(attr,i)=>[attr.getX(i),attr.getY(i),attr.getZ(i)].map(x=>Math.round(x*1e4)).join(','),edgeKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  for(const face of geometry.userData.faceGroups)for(let i=face.start;i<face.start+face.count;i+=3)for(let j=0;j<3;j++){const a=key(pos,index?index.getX(i+j):i+j),b=key(pos,index?index.getX(i+(j+1)%3):i+(j+1)%3),k=edgeKey(a,b),entry=faces.get(k);if(entry){entry.count++;entry.same&&=entry.face===face.faceId;}else faces.set(k,{face:face.faceId,count:1,same:true});}
  const positions=raw.attributes.position,kept=[];for(let i=0;i<positions.count;i+=2){const entry=faces.get(edgeKey(key(positions,i),key(positions,i+1)));if(entry?.same&&entry.count>=2)continue;for(const j of [i,i+1])kept.push(positions.getX(j),positions.getY(j),positions.getZ(j));}
  raw.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(kept,3));result.userData.circularEdges=circularEdges(result);result.userData.arcEdges=arcEdges(result);return result;
 }
 const p=geometry.attributes.position,ix=geometry.index,triangles=[];
 for(let i=0;i<(ix?.count??p.count);i+=3){const pts=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j)),t=new THREE.Triangle(...pts),n=t.getNormal(new THREE.Vector3());if(t.getArea()>1e-10)triangles.push({t,n});}
 const ep=raw.attributes.position,out=[],epsilon=1e-4;
 // A rounded face outline and CSG can split adjacent curved facets differently.
 // Test nearby surface coverage, allowing smooth normals, not only coplanarity.
 const smooth=Math.cos(angle*Math.PI/180),nearest=new THREE.Vector3();
 const covered=(point,n)=>triangles.some(q=>q.n.dot(n)>smooth&&q.t.closestPointToPoint(point,nearest).distanceToSquared(point)<(epsilon*.4)**2);
 for(let i=0;i<ep.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(ep,i),b=new THREE.Vector3().fromBufferAttribute(ep,i+1),dir=b.clone().sub(a).normalize(),mid=a.clone().lerp(b,.5);
 const internal=triangles.some(({t,n})=>{if(Math.abs(n.dot(mid.clone().sub(t.a)))>epsilon*.1||t.closestPointToPoint(mid,new THREE.Vector3()).distanceTo(mid)>epsilon)return false;const side=n.clone().cross(dir).normalize().multiplyScalar(epsilon);return [.25,.5,.75].every(f=>{const p=a.clone().lerp(b,f);return covered(p.clone().add(side),n)&&covered(p.clone().sub(side),n);});});
 if(!internal)out.push(...a.toArray(),...b.toArray());
 }
 raw.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(out,3));result.userData.circularEdges=circularEdges(result);result.userData.arcEdges=arcEdges(result);return result;
}

