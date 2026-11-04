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

const extensionTolerance=8;

function nearProjectedLine(a,b,cursor,project,finite){
 const p=project(a),q=project(b),dx=q.x-p.x,dy=q.y-p.y,length2=dx*dx+dy*dy;
 if(length2<1e-12)return false;
 const fraction=((cursor.x-p.x)*dx+(cursor.y-p.y)*dy)/length2;
 const t=finite?THREE.MathUtils.clamp(fraction,0,1):fraction;
 return Math.hypot(p.x+t*dx-cursor.x,p.y+t*dy-cursor.y)<=extensionTolerance;
}

function projectedExtension(source,target,normal,scratch){
 const {a,b,start,end,offPlane}=source,{points:[c,d],edge}=target;
 const cross=(u,v)=>scratch.crossVectors(u,v).dot(normal),den=cross(source.edge,edge);
 if(den*den<=source.edge.lengthSq()*edge.lengthSq()*1e-12)return null;
 const delta=c.clone().sub(start),along=cross(delta,edge)/den,onBoundary=cross(delta,source.edge)/den;
 if(onBoundary< -1e-7||onBoundary>1+1e-7)return null;
 const within=along>=-1e-7&&along<=1+1e-7;
 if(within&&!offPlane&&!target.source)return null;
 const t=THREE.MathUtils.clamp(onBoundary,0,1),fromA=along<.5;
 const point=c.clone().lerp(d,t);
 return {
  point,near:fromA?a:b,far:fromA?b:a,
  start:fromA?start:end,end:within?(fromA?end:start):null,
  sourceFraction:within?THREE.MathUtils.clamp(fromA?along:1-along,0,1):null,
  physicalTarget:target.source?target.source.a.clone().lerp(target.source.b,t):null,
  projected:true
 };
}

function visibleExtension(candidate,visible,project){
 if(candidate.physicalTarget&&!visible(candidate.physicalTarget))return false;
 const {near,far}=candidate;
 if(candidate.sourceFraction!=null){
  // Exactly on a silhouette, a ray may pass on either side. Check the
  // source edge immediately around the crossing for the covered portion.
  const a=project(candidate.start),b=project(candidate.end),step=1/Math.hypot(b.x-a.x,b.y-a.y);
  if([-step,0,step].every(delta=>visible(near.clone().lerp(far,THREE.MathUtils.clamp(candidate.sourceFraction+delta,0,1)))))return false;
 }
 for(const t of [0,1,.5,.25,.75]){
  if(!visible(t===0?near:t===1?far:near.clone().lerp(far,t)))continue;
  if(candidate.end)candidate.start=candidate.start.clone().lerp(candidate.end,t);
  return true;
 }
 return false;
}

export function createSketchBoundarySnap(){
 let cache=new WeakMap(),extensionCache=new WeakMap();
 return {
  clear(){cache=new WeakMap();extensionCache=new WeakMap();},
  extension(meshes,basis,offset,hit,project,{boundaries=[],origin=null,direction=null,sourceVisible=()=>true}={}){
   const cursor=project(hit),nearby=[],sources=[],targets=[],scratch=new THREE.Vector3();
   const addTarget=(a,b,source=null)=>{
    if(nearProjectedLine(a,b,cursor,project,true))targets.push({points:[a,b],edge:b.clone().sub(a),source});
   };
   for(const [a,b] of boundaries)addTarget(a,b);
   const consider=candidate=>{
    const projected=project(candidate.point),distance=Math.hypot(projected.x-cursor.x,projected.y-cursor.y);
    if(distance>extensionTolerance||Math.abs(projected.z)>1)return;
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
     const candidates=[],projectedEdges=[];
     for(let i=0;i<positions.count;i+=2){
      if(geometry.userData.circularEdges?.has(i)||geometry.userData.arcEdges?.has(i))continue;
      const a=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      const b=new THREE.Vector3().fromBufferAttribute(positions,i+1).applyMatrix4(mesh.matrixWorld);
      const da=a.dot(basis.n)-offset,db=b.dot(basis.n)-offset;
      const offPlane=Math.max(Math.abs(da),Math.abs(db))>1e-6;
      const start=a.clone().addScaledVector(basis.n,-da),end=b.clone().addScaledVector(basis.n,-db);
      const edge=end.clone().sub(start);
      if(edge.lengthSq()>1e-12)projectedEdges.push({a,b,start,end,edge,offPlane});
      if(Math.abs(db-da)<=Math.max(1e-7,a.distanceTo(b)*1e-6))continue;
      // An existing crossing is handled by the solid boundary on the sketch plane.
      if(Math.min(da,db)<=1e-6&&Math.max(da,db)>=-1e-6)continue;
      const point=a.clone().lerp(b,da/(da-db));
      point.addScaledVector(basis.n,offset-point.dot(basis.n));
      const [near,far]=Math.abs(da)<Math.abs(db)?[a,b]:[b,a];
      candidates.push({point,near,far});
     }
     entry={positions,key,candidates,projectedEdges};extensionCache.set(mesh,entry);
    }
    for(const candidate of entry.candidates)consider(candidate);
    for(const source of entry.projectedEdges){
     sources.push(source);
     if(source.offPlane)addTarget(source.start,source.end,source);
    }
   }
   if(targets.length)for(const source of sources){
    if(!nearProjectedLine(source.start,source.end,cursor,project,false))continue;
    for(const target of targets){
     const crossing=projectedExtension(source,target,basis.n,scratch);
     if(crossing)consider(crossing);
    }
   }
   nearby.sort((a,b)=>a.distance-b.distance);
   // The virtual crossing may be behind its own solid. Test the source edge.
   const match=nearby.find(candidate=>visibleExtension(candidate,sourceVisible,project));
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
