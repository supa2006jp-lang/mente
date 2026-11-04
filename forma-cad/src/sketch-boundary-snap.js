import * as THREE from 'three';
import {solidSketchBoundarySegments} from './sketch-solid-overlap.js';
import {basisFor,worldPoint} from './frames.js';
import {cadPosition} from './cad-coordinates.js';


// Measure attraction in pixels, so zooming never changes the usable distance.
// The projected closest point is lifted back onto the actual sketch section.
export function closestBoundaryPoint(segments,hit,project,{tolerance=8,origin=null,direction=null}={}){
 const cursor=project(hit);let best=null,distance=tolerance;
 for(const [a,b] of segments){
  const pa=project(a),pb=project(b),dx=pb.x-pa.x,dy=pb.y-pa.y,length2=dx*dx+dy*dy;
  if(length2<1e-12)continue;
  let point;
  if(origin&&direction){
   const edge=b.clone().sub(a),normal=edge.clone().cross(direction),denominator=normal.lengthSq();
   if(denominator<1e-16)continue;
   const t=origin.clone().sub(a).cross(direction).dot(normal)/denominator;
   if(t<0||t>1)continue;
   point=a.clone().lerp(b,t);
   if(point.clone().sub(origin).dot(direction)<0)continue;
  }else{
   const t=THREE.MathUtils.clamp(((cursor.x-pa.x)*dx+(cursor.y-pa.y)*dy)/length2,0,1);
   point=a.clone().lerp(b,t);
  }
  const p=project(point),d=Math.hypot(p.x-cursor.x,p.y-cursor.y);
  if(d<distance){distance=d;best=point;}
 }
 return best;
}

function projectedExtension(a,b,projectedA,projectedB,boundary,normal){
 const [c,d]=boundary,edge=projectedB.clone().sub(projectedA),target=d.clone().sub(c);
 const cross=(u,v)=>u.clone().cross(v).dot(normal),den=cross(edge,target);
 if(Math.abs(den)<=edge.length()*target.length()*1e-6)return null;
 const delta=c.clone().sub(projectedA),along=cross(delta,target)/den,onBoundary=cross(delta,edge)/den;
 if(onBoundary< -1e-7||onBoundary>1+1e-7||along>=-1e-7&&along<=1+1e-7)return null;
 const near=along<0?a:b,far=along<0?b:a,start=along<0?projectedA:projectedB;
 return {point:c.clone().lerp(d,THREE.MathUtils.clamp(onBoundary,0,1)),near,far,start,projected:true};
}

export function createSketchBoundarySnap(){
 let cache=new WeakMap(),extensionCache=new WeakMap();
 return {
  clear(){cache=new WeakMap();extensionCache=new WeakMap();},
  extension(meshes,basis,offset,hit,project,{boundaries=[],origin=null,direction=null,sourceVisible=()=>true}={}){
   const cursor=project(hit),nearby=[];
   const targets=boundaries.filter(segment=>closestBoundaryPoint([segment],hit,project));
   const consider=candidate=>{
    const projected=project(candidate.point),distance=Math.hypot(projected.x-cursor.x,projected.y-cursor.y);
    if(distance>8||Math.abs(projected.z)>1)return;
    if(origin&&direction){
     const delta=candidate.point.clone().sub(origin);
     if(delta.dot(direction)<-1e-6||delta.cross(direction).length()>1e-6)return;
    }
    nearby.push({...candidate,distance});
   };
   for(const mesh of meshes){
    if(!mesh.visible)continue;
    mesh.updateWorldMatrix(true,false);
    const geometry=mesh.children[0]?.geometry,positions=cadPosition(geometry);
    if(!positions)continue;
    const key=[offset,...basis.n.toArray(),...mesh.matrixWorld.elements,positions.version].join(',');
    let entry=extensionCache.get(mesh);
    if(!entry||entry.positions!==positions||entry.key!==key){
     const candidates=[],parallel=[];
     for(let i=0;i<positions.count;i+=2){
      if(geometry.userData.circularEdges?.has(i)||geometry.userData.arcEdges?.has(i))continue;
      const a=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      const b=new THREE.Vector3().fromBufferAttribute(positions,i+1).applyMatrix4(mesh.matrixWorld);
      const da=a.dot(basis.n)-offset,db=b.dot(basis.n)-offset;
      if(Math.abs(db-da)<=Math.max(1e-7,a.distanceTo(b)*1e-6)){
       const projectedA=a.clone().addScaledVector(basis.n,-da),projectedB=b.clone().addScaledVector(basis.n,-db);
       if(projectedA.distanceToSquared(projectedB)>1e-12)parallel.push({a,b,projectedA,projectedB});
       continue;
      }
      // An existing crossing is handled by the solid boundary on the sketch plane.
      if(Math.min(da,db)<=1e-6&&Math.max(da,db)>=-1e-6)continue;
      const point=a.clone().lerp(b,da/(da-db));
      point.addScaledVector(basis.n,offset-point.dot(basis.n));
      const [near,far]=Math.abs(da)<Math.abs(db)?[a,b]:[b,a];
      candidates.push({point,near,far});
     }
     entry={positions,key,candidates,parallel};extensionCache.set(mesh,entry);
    }
    for(const candidate of entry.candidates)consider(candidate);
    for(const target of targets){
     for(const {a,b,projectedA,projectedB} of entry.parallel){
      const crossing=projectedExtension(a,b,projectedA,projectedB,target,basis.n);
      if(crossing)consider(crossing);
     }
    }
   }
   nearby.sort((a,b)=>a.distance-b.distance);
   // The virtual crossing may be behind its own solid. Test the source edge.
   const match=nearby.find(({near,far})=>[near,near.clone().lerp(far,.5),far].some(sourceVisible));
   return match?{kind:'edgeExtension',point:match.point,distance:match.distance,projected:match.projected,segments:[[match.start||match.near,match.point]]}:null;
  },
  reference(face,basis,offset,hit,project,options){
   if(!face?.filletGridReference)return null;
   const normal=basisFor(face).n;
   if(Math.abs(normal.dot(basis.n))<.999999)return null;
   let entry=cache.get(face);
   if(!entry){
    const edges=[];
    for(const ring of [face.outer,...(face.holes||[])]){
     const points=ring.map(p=>worldPoint(face,p));
     for(let i=0;i<points.length;i++)edges.push([points[i],points[(i+1)%points.length]]);
    }
    entry={edges};cache.set(face,entry);
   }
   // A reference from another sketch plane must not pull points off-plane.
   if(entry.edges.some(([a,b])=>Math.abs(a.dot(basis.n)-offset)>1e-4||Math.abs(b.dot(basis.n)-offset)>1e-4))return null;
   const point=closestBoundaryPoint(entry.edges,hit,project,options);
   return point?.addScaledVector(basis.n,offset-point.dot(basis.n))||null;
  },
  segments(meshes,basis,offset){
   const segments=[];
   for(const mesh of meshes){
    if(!mesh.visible)continue;mesh.updateWorldMatrix(true,false);
    const geometry=mesh.geometry,key=[offset,...basis.u.toArray(),...basis.v.toArray(),...basis.n.toArray(),...mesh.matrixWorld.elements,geometry.attributes.position.version,geometry.index?.version].join(',');
    let entry=cache.get(mesh);
    if(!entry||entry.geometry!==geometry||entry.key!==key){
     const edges=solidSketchBoundarySegments([mesh],basis,offset);
     entry={geometry,key,edges};cache.set(mesh,entry);
    }
    for(const edge of entry.edges)segments.push(edge);
   }
   return segments;
  },
  snap(meshes,basis,offset,hit,project,options){
   return closestBoundaryPoint(this.segments(meshes,basis,offset),hit,project,options);
  }
 };
}
