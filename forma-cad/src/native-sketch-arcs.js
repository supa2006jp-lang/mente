import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor} from './frames.js';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function circleThrough(a,b,c){
 const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-a[0],c[1]-a[1]],den=2*(u[0]*v[1]-u[1]*v[0]);
 if(Math.abs(den)<1e-10)return null;
 const uu=u[0]**2+u[1]**2,vv=v[0]**2+v[1]**2,center=[a[0]+(uu*v[1]-vv*u[1])/den,a[1]+(u[0]*vv-v[0]*uu)/den],radius=distance(a,center);
 return Number.isFinite(radius)&&radius>.001&&radius<100000?{center,radius}:null;
}
// This metadata is temporary, never written into the project. Only actual
// circle/arc sketch recipes qualify; an intentional polygon is not rounded.
export function nativeSketchRegion(region,features){
 if(!region?.sourceIds?.length||region.cadFace||region.bodyId||region._nativeArcSources)return region;
 const b=basisFor(region),sources=[];
 for(const f of features){
  if(f.kind!=='sketch'||!region.sourceIds.includes(f.id)||!(f.profile==='circle'||f.profile==='polyline'&&f.arc))continue;
  const fb=basisFor(f),offset=planeCoordinates(f).offset;
  if(Math.abs(Math.abs(fb.n.dot(b.n))-1)>1e-8||Math.abs(offset*fb.n.dot(b.n)-region.offset)>1e-5)continue;
  const points=sketchPoints(f).map(([x,y])=>{const p=fb.u.clone().multiplyScalar(x).addScaledVector(fb.v,y).addScaledVector(fb.n,offset);return [p.dot(b.u),p.dot(b.v)];});
  if(points.length<8)continue;
  const circle=circleThrough(points[0],points[Math.floor(points.length/3)],points[Math.floor(points.length*2/3)]);
  if(!circle||points.some(p=>Math.abs(distance(p,circle.center)-circle.radius)>1e-5))continue;
  sources.push({...circle,points});
 }
 return sources.length?{...region,_nativeArcSources:sources}:region;
}
export function nativeSketchFeature(feature,features){
 if(feature.profile!=='region'||!feature.region)return feature;
 const region=nativeSketchRegion(feature.region,features);
 return region===feature.region?feature:{...feature,region};
}
function onSegment(p,a,b,tolerance){
 const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(l<1e-16)return false;
 const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l;
 return t>=-1e-6&&t<=1+1e-6&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)<=tolerance*Math.sqrt(l);
}
export function nativeRingSegments(ring,sources=[]){
 if(!sources.length)return ring.map((a,i)=>({a,b:ring[(i+1)%ring.length]}));
 const tags=ring.map((a,i)=>{
  const b=ring[(i+1)%ring.length],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return sources.find(source=>[a,b].every(p=>Math.abs(distance(p,source.center)-source.radius)<1e-5)&&source.points.slice(1).some((q,j)=>[a,b,mid].every(p=>onSegment(p,source.points[j],q,1e-5))));
 });
 // Start at a run boundary so an arc crossing the saved ring's first vertex
 // remains one native edge. Preserve the original winding, including holes.
 const start=Math.max(0,tags.findIndex((tag,i)=>!tag||tag!==tags[(i+ring.length-1)%ring.length])),result=[];
 for(let done=0;done<ring.length;){
  const i=(start+done)%ring.length,tag=tags[i];let count=1;
  if(tag)while(done+count<ring.length&&tags[(i+count)%ring.length]===tag)count++;
  const a=ring[i],b=ring[(i+count)%ring.length];
  if(tag&&count>=2&&distance(a,b)>1e-6){const via=ring[(i+Math.floor(count/2))%ring.length];result.push({a,via,b});}
  else for(let j=0;j<count;j++)result.push({a:ring[(i+j)%ring.length],b:ring[(i+j+1)%ring.length]});
  done+=count;
 }
 return result;
}
