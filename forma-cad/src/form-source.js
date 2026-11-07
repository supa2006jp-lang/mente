import {basisFor,validateFrame} from './frames.js';
import {ringArea,validateRegion} from './regions.js';
import {formBasis} from './form-orientation.js';

const maxOutlinePoints=2048;
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(value=>Number.isFinite(value)&&Math.abs(value)<=25000);

function validArcSources(sources){
 if(sources===undefined)return true;
 if(!Array.isArray(sources)||sources.length>128)return false;
 let count=0;
 return sources.every(source=>source&&validPoint(source.center)&&Number.isFinite(source.radius)&&
  source.radius>.001&&source.radius<100000&&Array.isArray(source.points)&&source.points.length>=3&&
  (count+=source.points.length)<=maxOutlinePoints*2&&source.points.every(validPoint));
}

export function formSourceContour(region,axes=formBasis()){
 if(!region||region.overlapSource||region.holes?.length||region.outer?.length>maxOutlinePoints||!validArcSources(region._nativeArcSources))return null;
 try{
  validateRegion(region);
  if(region.frame)validateFrame(region.frame);
 }catch{return null;}
 const {u,v,n}=basisFor(region);
 if(Math.abs(u.dot(axes.n))>1e-8||Math.abs(v.dot(axes.n))>1e-8||Math.abs(n.dot(axes.n))<1-1e-10)return null;
 const z=n.dot(axes.n)*region.offset;
 const outline=region.outer.map(([x,y])=>[axes.u,axes.v].map(axis=>u.dot(axis)*x+v.dot(axis)*y+n.dot(axis)*region.offset));
 if(Math.hypot(outline[0][0]-outline.at(-1)[0],outline[0][1]-outline.at(-1)[1])<1e-7)outline.pop();
 if(outline.length<3||Math.abs(ringArea(outline))<.01)return null;
 if(ringArea(outline)<0)outline.reverse();
 return {outline,z};
}

function controlsFor(outline,count){
 // Use a common starting side and direction so adjacent sections correspond.
 const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
 const centerY=(Math.min(...ys)+Math.max(...ys))/2;
 const maxX=Math.max(...xs);
 const start=outline.reduce((best,[x,y],i)=>x>maxX-1e-7&&Math.abs(y-centerY)<Math.abs(outline[best][1]-centerY)?i:best,xs.indexOf(maxX));
 const points=[...outline.slice(start),...outline.slice(0,start)];
 const next=i=>points[(i+1)%points.length];
 const distances=points.map(([x,y],i)=>Math.hypot(next(i)[0]-x,next(i)[1]-y));
 const total=distances.reduce((sum,d)=>sum+d,0);
 let segment=0,passed=0;
 return Array.from({length:count},(_,i)=>{
  const distance=i*total/count;
  while(segment<distances.length-1&&passed+distances[segment]<=distance)passed+=distances[segment++];
  const t=distances[segment]?(distance-passed)/distances[segment]:0;
  return points[segment].map((value,axis)=>value+(next(segment)[axis]-value)*t);
 });
}

export function importFormRings(regions,count,limit,axes=formBasis()){
 if(!Array.isArray(regions)||regions.length<2||regions.length>limit)throw Error('取り込む断面は2〜'+limit+'枚を選んでください。');
 const rings=regions.map(region=>{
  const contour=formSourceContour(region,axes);
  if(!contour)throw Error('取り込めるのは、指定した断面方向に平行で穴のない閉じた断面です。');
  const {plane,frame,offset,outer,_nativeArcSources}=region;
  return {z:contour.z,locked:true,points:controlsFor(contour.outline,count),
   reference:structuredClone({plane,frame,offset,outer,holes:[],...(_nativeArcSources?{_nativeArcSources}:{})})};
 }).sort((a,b)=>a.z-b.z);
 if(rings.some((ring,i)=>i>0&&ring.z-rings[i-1].z<.1))
  throw Error('高さが異なる断面を選んでください。断面間は0.1 mm以上必要です。');
 return rings;
}
