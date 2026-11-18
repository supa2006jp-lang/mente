import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {circularRing} from './circular-ring.js';
import {offsetExtrusionRegions} from './offset-extrusion.js';

const epsilon=5e-5,key=value=>Number(value.toPrecision(12)),lower=(values,value)=>{let lo=0,hi=values.length;while(lo<hi){const mid=(lo+hi)>>1;if(values[mid]<value)lo=mid+1;else hi=mid;}return lo;};
export function offsetGridSignature(state){
 return JSON.stringify([!!state?.enabled,...(state?.grids||[]).map(entry=>{const object=entry.object||entry;object?.updateWorldMatrix(true,false);return [object?.uuid,object?.geometry?.uuid,object?.visible,entry.step,object?.matrixWorld?.elements];})]);
}
function vertexPaths(region){
 // Full circles have no CAD corners; their tessellation points are not vertices.
 if(circularRing(region.outer,{nonUniform:true}))return [];
 const points=region.outer,basis=basisFor(region),area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=area>=0?1:-1,result=[];
 const normal=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);return length>1e-9?[sign*dy/length,-sign*dx/length]:null;};
 for(let i=0;i<points.length;i++){
  const point=points[i],a=normal(points[(i+points.length-1)%points.length],point),b=normal(point,points[(i+1)%points.length]);if(!a||!b)continue;
  const divisor=1+a[0]*b[0]+a[1]*b[1];if(divisor<1e-9)continue;
  const velocity=basis.u.clone().multiplyScalar((a[0]+b[0])/divisor).addScaledVector(basis.v,(a[1]+b[1])/divisor);
  result.push({origin:worldPoint(region,point),velocity});
 }
 return result;
}
function readGrid(entry,region){
 const object=entry.object||entry,position=object?.geometry?.attributes.position;if(!object?.visible||!position)return null;
 object.updateWorldMatrix(true,false);const normal=new THREE.Vector3(0,1,0).transformDirection(object.matrixWorld),planeNormal=basisFor(region).n;if(Math.abs(normal.dot(planeNormal))<.999999)return null;
 // Project a parallel reference grid onto the selected working plane.
 const matrix=object.matrixWorld.clone(),origin=new THREE.Vector3().setFromMatrixPosition(matrix);origin.addScaledVector(planeNormal,region.offset-origin.dot(planeNormal));matrix.setPosition(origin);const inverse=matrix.clone().invert(),lines=[new Map(),new Map()],step=entry.step;
 const fixed=value=>Number.isFinite(step)&&step>0?key(Math.round(value/step)*step):key(value);
 for(let i=0;i+1<position.count;i+=2){const ax=position.getX(i),az=position.getZ(i),bx=position.getX(i+1),bz=position.getZ(i+1);let axis,value,start,end;
  if(Math.abs(ax-bx)<1e-7&&Math.abs(az-bz)>1e-8){axis=0;value=fixed(ax);start=Math.min(az,bz);end=Math.max(az,bz);}
  else if(Math.abs(az-bz)<1e-7&&Math.abs(ax-bx)>1e-8){axis=1;value=fixed(az);start=Math.min(ax,bx);end=Math.max(ax,bx);}else continue;
  if(!lines[axis].has(value))lines[axis].set(value,[]);lines[axis].get(value).push([start,end]);
 }
 const values=lines.map(map=>[...map.keys()].sort((a,b)=>a-b));if(values.some(array=>!array.length))return null;
 const contains=(x,z)=>lines[0].get(x)?.some(([a,b])=>z>=a-epsilon&&z<=b+epsilon)&&lines[1].get(z)?.some(([a,b])=>x>=a-epsilon&&x<=b+epsilon);
 return {matrix,inverse,values,contains};
}

// A mitered corner follows a straight path as the single offset distance varies.
// Solve that path against both finite grid directions, then verify the corner
// against the actual offset polygon before accepting it. No vertex is moved alone.
export function createOffsetGridSnap(regions,entries){
 const items=regions.map(region=>{const grids=entries.map(entry=>readGrid(entry,region)).filter(Boolean);return {region,paths:grids.length?vertexPaths(region):[],grids};});
 return {pick(distance,{project,tolerance=8}={}){
  if(!Number.isFinite(distance)||!project)return null;const candidates=[];let budget=20000;
  for(const item of items)for(const path of item.paths){
   const raw=path.origin.clone().addScaledVector(path.velocity,distance),screen=project(raw),next=project(raw.clone().add(path.velocity));if(!screen||!next||!Number.isFinite(screen.x+screen.y+next.x+next.y))continue;
   const speed=Math.hypot(next.x-screen.x,next.y-screen.y);if(speed<1e-6)continue;const window=tolerance/speed;
   for(const grid of item.grids){
    const a=path.origin.clone().applyMatrix4(grid.inverse),b=path.origin.clone().add(path.velocity).applyMatrix4(grid.inverse),p=[a.x,a.z],v=[b.x-a.x,b.z-a.z],current=[p[0]+v[0]*distance,p[1]+v[1]*distance];
    const ranges=v.map((velocity,axis)=>{if(Math.abs(velocity)<1e-9)return null;const span=Math.abs(velocity*window),values=grid.values[axis];return {axis,start:lower(values,current[axis]-span-epsilon),end:lower(values,current[axis]+span+epsilon)};}).filter(Boolean).sort((a,b)=>(a.end-a.start)-(b.end-b.start));
    const range=ranges[0];if(!range)continue;const axis=range.axis,other=1-axis,values=grid.values[axis],otherValues=grid.values[other];
    for(let i=range.start;i<range.end&&budget>0;i++,budget--){
     const value=values[i],offset=(value-p[axis])/v[axis];if(Math.abs(offset)>10000)continue;const expected=p[other]+v[other]*offset,index=lower(otherValues,expected);
     for(const j of [index-1,index]){if(j<0||j>=otherValues.length||Math.abs(otherValues[j]-expected)>epsilon)continue;
      const coords=axis===0?[value,otherValues[j]]:[otherValues[j],value];if(!grid.contains(...coords))continue;
      const point=new THREE.Vector3(coords[0],0,coords[1]).applyMatrix4(grid.matrix),target=project(point);if(!target||target.visible===false||Math.abs(target.z||0)>1)continue;
      const gap=Math.hypot(target.x-screen.x,target.y-screen.y);if(gap>tolerance)continue;
      candidates.push({distance:key(offset),point,gap,item});
     }
    }
   }
   if(budget<=0)break;
  }
  candidates.sort((a,b)=>a.gap-b.gap);const verified=new Map();
  const verify=candidate=>{let byDistance=verified.get(candidate.item);if(!byDistance){byDistance=new Map();verified.set(candidate.item,byDistance);}let points=byDistance.get(candidate.distance);
   if(!points){try{points=offsetExtrusionRegions(candidate.item.region,candidate.distance).flatMap(region=>region.outer.map(point=>worldPoint(region,point)));}catch{points=[];}byDistance.set(candidate.distance,points);}
   return points.some(point=>point.distanceTo(candidate.point)<=epsilon);
  };
  for(const candidate of candidates.slice(0,16)){if(!verify(candidate))continue;const points=[],seen=new Set();
   for(const match of candidates){if(Math.abs(match.distance-candidate.distance)>1e-7||!verify(match))continue;const id=match.point.toArray().map(key).join(',');if(!seen.has(id)){seen.add(id);points.push(match.point.toArray());}if(points.length>=12)break;}
   return {distance:candidate.distance,points};
  }
  return null;
 }};
}
