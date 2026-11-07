import {basisFor} from './frames.js';
import {formLocal,formWorld} from './form-orientation.js';

const tolerance=.02;
export const formSeamLimit=8;
export const formSeams=form=>form.seams??(form.seam?[form.seam]:[]);
export const formSeamEnd=(form,index)=>index===0?'start':index===form.rings.length-1?'end':null;
export const formSeamsAt=(form,index)=>formSeams(form).filter(seam=>seam.end===formSeamEnd(form,index));
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export function validFormSeam(seam){
 const point=(p,count)=>Array.isArray(p)&&p.length===count&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000);
 return seam&&['start','end'].includes(seam.end)&&Number.isFinite(seam.z)&&Math.abs(seam.z)<=10000&&
  [seam.from,seam.to].every(k=>Number.isFinite(k)&&k>=0&&k<8)&&seam.from!==seam.to&&
  point(seam.a,2)&&point(seam.b,2)&&Math.hypot(seam.a[0]-seam.b[0],seam.a[1]-seam.b[1])>.05&&
  point(seam.normal,3)&&Math.abs(Math.hypot(...seam.normal)-1)<1e-5&&Math.hypot(...seam.normal.slice(0,2))>.1&&
  Math.abs((seam.a[0]-seam.b[0])*seam.normal[0]+(seam.a[1]-seam.b[1])*seam.normal[1])<1e-5&&
  (seam.b[1]-seam.a[1])*seam.normal[0]-(seam.b[0]-seam.a[0])*seam.normal[1]>1e-6&&
  (seam.range===undefined||Array.isArray(seam.range)&&seam.range.length===2&&seam.range.every(p=>point(p,2))&&
   distance(...seam.range)>.05&&[seam.a,seam.b].every(p=>withinRange(seam,p,1e-6)))&&
  typeof seam.name==='string'&&seam.name.length<=100;
}

function withinRange(seam,p,slack){
 const [a,b]=seam.range??[seam.a,seam.b],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 const u=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length;
 return u>=-slack&&u<=length+slack&&Math.abs(cross(p[0]-a[0],p[1]-a[1],dx,dy))/length<=slack;
}

function intersectSeams(first,second,p,q){
 const [ax,ay]=first.normal,[bx,by]=second.normal,det=cross(ax,ay,bx,by);
 if(Math.abs(det)<1e-7)return distance(p,q)<=1e-6?p:null;
 const a=ax*p[0]+ay*p[1],b=bx*q[0]+by*q[1];
 const candidate=[(a*by-ay*b)/det,(ax*b-a*bx)/det];
 return withinRange(first,candidate,1e-6)&&withinRange(second,candidate,1e-6)?candidate:null;
}

export function addFormSeam(form,incoming){
 const seams=structuredClone(formSeams(form).filter(s=>s.end!==incoming.end||s.from!==incoming.from));
 const seam=structuredClone(incoming);
 for(const existing of seams){
  if(existing.end!==seam.end)continue;
  for(const [from,to] of [['a','b'],['b','a']]){
   const key=from==='a'?'from':'to',other=key==='from'?'to':'from';
   if(seam[key]!==existing[other])continue;
   const corner=intersectSeams(seam,existing,seam[from],existing[to]);
   if(!corner)throw Error('隣の接続と境界辺の端をそろえられません。角で交わる境界辺を選んでください。');
   seam[from]=corner;existing[to]=corner.slice();
  }
 }
 return [...seams,seam];
}

// Each slope is a tangent in the section travel direction. At a shared
// corner the same slope belongs to both surfaces, so both equations apply.
export function constrainFormTangent(dx,dy,normals){
 if(!normals.length)return [dx,dy];
 const [ax,ay,az]=normals[0],norm2=ax*ax+ay*ay;
 if(normals.length>1){
  const [bx,by,bz]=normals[1],det=cross(ax,ay,bx,by);
  if(Math.abs(det)>1e-7)return [(ay*bz-az*by)/det,(az*bx-ax*bz)/det];
  if(Math.abs(bz-az*(ax*bx+ay*by)/norm2)>1e-6)
   throw Error('隣り合う接続面の傾きが合いません。接続する区間を変更してください。');
 }
 const correction=(ax*dx+ay*dy+az)/norm2;
 return [dx-correction*ax,dy-correction*ay];
}

export function findFormSeam(face,axes,ring,knots,index,end,name){
 const faceBasis=basisFor(face),normal=formLocal(axes,faceBasis.n);
 if(Math.hypot(...normal.slice(0,2))<=.1)throw Error('断面と平行な面には接続できません。側面の境界を選んでください。');
 const outline=face.outer.map(([x,y])=>formLocal(axes,formWorld(faceBasis,x,y,face.offset)));
 if(outline.some(p=>end==='start'?p[2]>ring.z+tolerance:p[2]<ring.z-tolerance))
  throw Error('平面の反対側へつながる端の断面を選んでください。');
 const from=ring.points[index],next=(index+1)%knots.length,to=ring.points[next];
 const candidates=outline.flatMap((a,i)=>{
  const b=outline[(i+1)%outline.length];
  if(Math.abs(a[2]-ring.z)>tolerance||Math.abs(b[2]-ring.z)>tolerance)return [];
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  if(length<.0025)return [];
  const project=p=>{
   const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length));
   // Re-evaluate the plane at the exact section offset.
   const correction=(a[2]+t*(b[2]-a[2])-ring.z)*normal[2]/(normal[0]**2+normal[1]**2);
   return [a[0]+t*dx+correction*normal[0],a[1]+t*dy+correction*normal[1]];
  };
  const p=project(from),q=project(to);
  if(Math.hypot(p[0]-q[0],p[1]-q[1])<.05)return [];
  if((q[1]-p[1])*normal[0]-(q[0]-p[0])*normal[1]<=1e-6)return [];
  const error=Math.hypot(p[0]-from[0],p[1]-from[1])+Math.hypot(q[0]-to[0],q[1]-to[1]);
  return [{p,q,error,range:[project(a),project(b)]}];
 }).sort((a,b)=>a.error-b.error);
 if(!candidates.length)throw Error('選んだ区間に合う境界辺が見つかりません。断面の位置と制御点を確認してください。');
 const {p,q,range}=candidates[0];
 return {end,z:ring.z,from:knots[index],to:knots[next],a:p,b:q,range,normal,name:name.slice(0,100)};
}
