import {basisFor} from './frames.js';
import {planeCoordinates,sketchPoints} from './regions.js';
import {formBasis,formLocal} from './form-orientation.js';
import {formSymmetryU} from './form-symmetry.js';

export const formGuideLimit=4;
const maxGuidePoints=96;

export function formGuideFromSketch(sketch,axes=formBasis()){
 if(sketch.kind!=='sketch'||!['line','polyline','spline'].includes(sketch.profile)||sketch.closed)return null;
 if(sketch.points?.length>(sketch.profile==='spline'?128:4096))return null;
 const basis=basisFor(sketch),offset=planeCoordinates(sketch).offset;
 const axis=Math.abs(basis.n.dot(axes.v))>1-1e-8?0:Math.abs(basis.n.dot(axes.u))>1-1e-8?1:null;
 if(axis===null)return null;
 const points=sketchPoints(sketch).map(([u,v])=>{
  const p=basis.u.clone().multiplyScalar(u).addScaledVector(basis.v,v).addScaledVector(basis.n,offset);
  const local=formLocal(axes,p);
  return [local[2],local[axis]];
 });
 if(points[0]?.[0]>points.at(-1)?.[0])points.reverse();
 const increasing=[];
 for(const p of points){
  const last=increasing.at(-1);
  if(last&&p[0]-last[0]<1e-6){
   if(Math.hypot(p[0]-last[0],p[1]-last[1])<1e-6)continue;
   return null;
  }
  increasing.push(p);
 }
 const simplified=simplifyGuide(increasing,.035);
 if(!simplified||simplified.length<2)return null;
 return {axis,points:simplified};
}

function simplifyGuide(points,tolerance){
 if(points.length<3)return points;
 const keep=new Set([0,points.length-1]),intervals=[[0,points.length-1]];
 while(intervals.length){
  const [start,end]=intervals.pop(),[a,x]=points[start],[b,y]=points[end];
  let farthest=tolerance,index=-1;
  for(let i=start+1;i<end;i++){
   const [z,value]=points[i],error=Math.abs(value-(x+(y-x)*(z-a)/(b-a)));
   if(error>farthest){index=i;farthest=error;}
  }
  if(index>=0){
   keep.add(index);
   if(keep.size>maxGuidePoints)return null;
   intervals.push([start,index],[index,end]);
  }
 }
 return points.filter((_,i)=>keep.has(i));
}

export function mirrorFormKnot(knot){return (12-knot)%8;}

export function validFormGuide(guide){
 return guide&&[0,1].includes(guide.axis)&&Number.isInteger(guide.knot)&&guide.knot>=0&&guide.knot<8&&
  typeof guide.name==='string'&&guide.name.length<=100&&Array.isArray(guide.points)&&
  guide.points.length>=2&&guide.points.length<=maxGuidePoints&&guide.points.every((p,i)=>
   Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)&&
   (!i||p[0]-guide.points[i-1][0]>=1e-6));
}

export function formGuideValue(guide,z){
 const points=guide.points;
 const next=points.findIndex(p=>p[0]>z);
 if(next===0)return points[0][1];
 if(next<0)return points.at(-1)[1];
 const [a,x]=points[next-1],[b,y]=points[next];
 return x+(y-x)*(z-a)/(b-a);
}

export function formGuideBindings(form){
 return (form.guides??[]).flatMap(guide=>{
  const first={guide,knot:guide.knot,sign:1,offset:0},opposite=mirrorFormKnot(guide.knot);
  return form.symmetric&&opposite!==guide.knot?
   [first,{guide,knot:opposite,sign:guide.axis===0?-1:1,offset:guide.axis===0?2*formSymmetryU(form):0}]:[first];
 });
}

export const formGuideCoordinate=(binding,z)=>binding.offset+binding.sign*formGuideValue(binding.guide,z);

export function formGuideHeights(form){
 if(!form.guides?.length)return [];
 const heights=form.rings.map(r=>r.z),result=[];
 for(let i=1;i<heights.length;i++){
  const a=heights[i-1],b=heights[i],candidates=form.guides.flatMap(guide=>guide.points.slice(1,-1)
   .filter(([z])=>z>a+.02&&z<b-.02)
   .map(([z,value])=>{
    const start=formGuideValue(guide,a),end=formGuideValue(guide,b);
    return {z,importance:Math.abs(value-start-(end-start)*(z-a)/(b-a))};
   }));
  // Give each span a small, bounded set of extra sections; prioritize bends.
  const samples=[];
  const add=z=>{if(z>a+.02&&z<b-.02&&samples.every(at=>Math.abs(at-z)>.02))samples.push(z);};
  for(const candidate of candidates.sort((x,y)=>y.importance-x.importance)){
   if(samples.length===2)break;
   add(candidate.z);
  }
  for(const t of [1/3,2/3]){
   if(samples.length===2)break;
   add(a+(b-a)*t);
  }
  result.push(samples.sort((x,y)=>x-y));
 }
 return result;
}
