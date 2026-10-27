import * as R from 'replicad';
import * as THREE from 'three';
import {lastBodyWriter} from './body-revolution-history.js';
import {basisFor,worldPoint} from './frames.js';
import {circularRing} from './circular-ring.js';
import {nativeRingSegments} from './native-sketch-arcs.js';
import {fuseSolids} from './solid-fuse.js';
import {solidMeshComplete} from './solid-mesh.js';

const V=a=>new THREE.Vector3(...a),finite=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite),eps=1e-7;
// The complete revolution of a solid, polygonal meridian about an intersecting
// perpendicular axis has an exact construction using cones and sphere belts.
// No intermediate angular snapshots or polygonal approximations are needed.
export function orthogonalProfileSweepPlan(features,p){
 if(!p.bodySweep||p.type!=='revolve'||p.angle!==360||!finite(p.origin)||!finite(p.axisVector))return null;
 const writer=lastBodyWriter(features,p.sourceBody),q=writer?.feature.spec;
 if(!q||q.type!=='revolve'||q.bodySweep||q.sourceBody||q.operation!=='new'||q.angle!==360||q.id!==p.sourceBody||writer.feature.outputs.length!==1||!finite(q.origin)||!finite(q.axisVector))return null;
 const region=q.region;if(!region?.outer?.length||region.outer.length>64||region.holes?.length||circularRing(region.outer)||nativeRingSegments(region.outer,region._nativeArcSources).some(edge=>edge.via))return null;
 const a=V(p.axisVector).normalize(),d=V(q.axisVector).normalize(),normal=basisFor(region).n;
 if(Math.abs(a.dot(d))>1e-8||Math.abs(normal.dot(d))>1e-8||Math.abs(normal.dot(V(q.origin))-region.offset)>eps)return null;
 const center=V(q.origin).addScaledVector(d,V(p.origin).sub(V(q.origin)).dot(d)),radial=normal.clone().cross(d).normalize();
 if(center.clone().sub(V(p.origin)).cross(a).length()>eps)return null;
 let ring=region.outer.map(point=>{const v=worldPoint(region,point).sub(V(q.origin));return {r:v.dot(radial),y:worldPoint(region,point).sub(center).dot(d)};});
 if(ring.some(point=>!Number.isFinite(point.r)||!Number.isFinite(point.y)))return null;
 const nonzero=ring.filter(point=>Math.abs(point.r)>eps),sign=Math.sign(nonzero[0]?.r);if(!nonzero.length||nonzero.some(point=>Math.sign(point.r)!==sign))return null;
 ring=ring.map(({r,y})=>({r:Math.abs(r)<=eps?0:Math.abs(r),y}));
 if(ring.filter(point=>!point.r).length!==2)return null;
 const start=ring.findIndex((point,i)=>point.r&&ring[(i+ring.length-1)%ring.length].r===0);if(start<0)return null;
 const samples=[];let at=start;while(ring[at].r){samples.push(ring[at]);at=(at+1)%ring.length;if(at===start)return null;}
 if(samples.length!==nonzero.length)return null;
 const before=ring[(start+ring.length-1)%ring.length],after=ring[at];
 if(Math.abs(before.y-samples[0].y)>eps)samples.unshift(before);
 if(Math.abs(after.y-samples.at(-1).y)>eps)samples.push(after);
 if(samples[0].y>samples.at(-1).y)samples.reverse();
 if(samples.some((point,i)=>i&&point.y<samples[i-1].y-eps))return null;
 if(samples.some(point=>point.y<-eps)&&samples.some(point=>point.y>eps))return null;
 if(samples.at(-1).y<=eps){samples.forEach(point=>point.y=-point.y);samples.reverse();}
 samples.forEach(point=>{if(Math.abs(point.y)<eps)point.y=0;});
 const sourceVolume=samples.slice(1).reduce((sum,b,i)=>{const c=samples[i];return sum+Math.PI*(b.y-c.y)*(b.r*b.r+b.r*c.r+c.r*c.r)/3;},0);
 if(!(sourceVolume>0))return null;
 return {samples:samples.map(({r,y})=>[r,y]),origin:center.toArray(),axis:a.toArray(),meridian:d.toArray(),sourceVolume};
}

function boolean(a,b,type){
 const oc=R.getOC(),builder=new oc[type](),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();
 try{args.Append(a.wrapped);tools.Append(b.wrapped);builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.SetFuzzyValue(0);builder.Build();if(builder.HasErrors())throw Error('全周回転の球面を構成できません');return R.cast(builder.Shape()).asShape3D();}
 finally{builder.delete();args.delete();tools.delete();}
}
function valid(shape){const checker=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return checker.IsValid();}finally{checker.delete();}}

function envelopeVolume(samples){
 let volume=0,past=0;
 for(let i=1;i<samples.length;i++){
  const [r0,lo]=samples[i-1],[r1,hi]=samples[i];past=Math.max(past,lo*lo+r0*r0);if(hi<=lo)continue;
  const k=(r1-r0)/(hi-lo),b=r0-k*lo,A=1+k*k,B=2*k*b,discriminant=B*B-4*A*(b*b-past),cuts=[lo,hi];
  if(discriminant>=0)for(const value of [(-B-Math.sqrt(discriminant))/(2*A),(-B+Math.sqrt(discriminant))/(2*A)])if(value>lo&&value<hi)cuts.push(value);
  cuts.sort((a,b)=>a-b);
  for(let j=1;j<cuts.length;j++){const a=cuts[j-1],z=cuts[j],m=(a+z)/2;volume+=m*m+(k*m+b)**2>=past?4*Math.PI*(k*(z**3-a**3)/3+b*(z*z-a*a)/2):4*Math.PI/3*(Math.max(0,past-a*a)**1.5-Math.max(0,past-z*z)**1.5);}
 }
 const [r,y]=samples.at(-1);past=Math.max(past,y*y+r*r);return volume+4*Math.PI/3*Math.max(0,past-y*y)**1.5;
}
function preciseVolume(shape){const oc=R.getOC(),properties=new oc.GProp_GProps();try{oc.BRepGProp.VolumeProperties(shape.wrapped,properties,1e-9,true,false);return properties.Mass();}finally{properties.delete();}}

export function orthogonalProfileSweep(body,plan,onProgress){
 const originalVolume=R.measureVolume(body);
 if(Math.abs(originalVolume-plan.sourceVolume)>Math.max(1e-5,Math.abs(originalVolume)*1e-8))throw Error('回転元の形状と断面の履歴が一致しません。断面を確認してください');
 // Do the boolean construction in a canonical frame. In oblique coordinates
 // OC can otherwise omit a tangent sphere belt without flagging an error.
 const {samples}=plan,outline=[...samples.map(([r,y])=>[-r,y,0]),...samples.toReversed().map(([r,y])=>[r,y,0])],points=outline.filter((p,i)=>!i||V(p).distanceTo(V(outline[i-1]))>eps),center=[0,0,0],axis=[1,0,0];
 if(V(points[0]).distanceTo(V(points.at(-1)))<eps)points.pop();
 const pieces=[];let result;
 try{
  onProgress?.({stage:'元の断面から直交軸の全周回転を作成しています'});
  const edges=points.map((p,i)=>R.makeLine(p,points[(i+1)%points.length]));let wire,face;
  try{wire=R.assembleWire(edges);face=R.makeFace(wire);pieces.push(R.revolution(face,center,axis,360));}finally{face?.delete();wire?.delete();edges.forEach(edge=>edge.delete());}
  // At fixed x, y²+r(y)² is convex on each linear meridian segment.
  // Therefore its maximum occurs at a vertex or the clipped endpoint y=rho.
  // The meridian solid supplies the latter; each vertex supplies a sphere belt
  // rho>=|y|, |x|<=r, x²+rho²<=y²+r². Their union is the exact swept volume.
  for(const [index,[r,y]]of samples.entries()){
   if(r<=eps)continue;onProgress?.({stage:'全周回転の球面を作成しています（'+(index+1)+' / '+samples.length+'）'});
   const radius=Math.hypot(r,y),sphere=R.makeSphere(radius),slab=R.makeCylinder(radius+1,2*r,[-r,0,0],axis);let belt;
   try{belt=boolean(sphere,slab,'BRepAlgoAPI_Common');if(y>eps){const hole=R.makeCylinder(y,2*r+2,[-r-1,0,0],axis);try{const cut=boolean(belt,hole,'BRepAlgoAPI_Cut');belt.delete();belt=cut;}finally{hole.delete();}}pieces.push(belt);belt=null;}
   finally{belt?.delete();sphere.delete();slab.delete();}
  }
  result=fuseSolids(pieces,{onProgress});
  // A compound containing one solid is classified differently by OC's point
  // and boolean algorithms. Publish the actual connected solid for reuse.
  const solids=result.solids;try{if(solids.length!==1)throw Error('全周回転を一体のソリッドにできません');const single=solids[0].clone();result.delete();result=single;}finally{solids.forEach(shape=>shape.delete());}
  const expected=envelopeVolume(samples);
  if(!valid(result)||!solidMeshComplete(result)||Math.abs(preciseVolume(result)-expected)>Math.max(1e-5,expected*1e-8))throw Error('全周回転を有効なソリッドにできません');
  const rotation=new THREE.Quaternion().setFromUnitVectors(V(axis),V(plan.axis)),angle=2*Math.acos(Math.max(-1,Math.min(1,rotation.w)));
  if(angle>1e-10)result=result.rotate(angle*180/Math.PI,center,new THREE.Vector3(rotation.x,rotation.y,rotation.z).normalize().toArray());
  result=result.translate(plan.origin);
  if(!valid(result)||!solidMeshComplete(result)||Math.abs(preciseVolume(result)-expected)>Math.max(1e-5,expected*1e-8))throw Error('全周回転の配置を検証できません');
  const output=result;result=null;return output;
 }finally{result?.delete();pieces.forEach(shape=>shape.delete());}
}
