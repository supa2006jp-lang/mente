import Clipper from 'clipper-lib';
import {Vector3} from 'three';
import {basisFor} from './frames.js';
import {formWorld} from './form-orientation.js';
import {pointInRing} from './regions.js';

const scale=1000;
export const formProjection={
 front:{axes:[0,2],normal:1},right:{axes:[1,2],normal:0},top:{axes:[0,1],normal:2}
};

export function projectFormOutline(region,view){
 const projection=formProjection[view];
 if(!projection||region.overlapSource||region.outer.length>4096)return null;
 const basis=basisFor(region);
 if(Math.abs(basis.n.getComponent(projection.normal))<1-1e-8)return null;
 return region.outer.map(([x,y])=>{
  const p=formWorld(basis,x,y,region.offset);
  return projection.axes.map(axis=>p.getComponent(axis));
 });
}

export function formSilhouette(mesh,view){
 const projection=formProjection[view];
 if(!projection)return [];
 if(mesh.triangles.length>180000)throw Error('比較する曲面が複雑すぎます。断面や制御点を減らしてください。');
 const points=[];
 for(let i=0;i<mesh.vertices.length;i+=3){
  const [x,y]=projection.axes.map(axis=>Math.round(mesh.vertices[i+axis]*scale));
  points.push({X:x,Y:y});
 }
 const union=new Clipper.Clipper();
 for(let i=0;i<mesh.triangles.length;i+=3){
  const path=[0,1,2].map(j=>points[mesh.triangles[i+j]]),area=Clipper.Clipper.Area(path);
  if(Math.abs(area)<.5)continue;
  if(area<0)path.reverse();
  union.AddPath(path,Clipper.PolyType.ptSubject,true);
 }
 const tree=new Clipper.PolyTree(),rings=[];
 union.Execute(Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 for(let node=tree.GetFirst();node;node=node.GetNext()){
  if(node.IsHole()||Math.abs(Clipper.Clipper.Area(node.Contour()))<4)continue;
  rings.push(node.Contour().map(({X,Y})=>[X/scale,Y/scale]));
 }
 return rings;
}

function samples(ring){
 const lengths=ring.map(([x,y],i)=>Math.hypot(ring[(i+1)%ring.length][0]-x,ring[(i+1)%ring.length][1]-y));
 const spacing=Math.max(.15,lengths.reduce((sum,d)=>sum+d,0)/480);
 return ring.flatMap((a,i)=>{
  const b=ring[(i+1)%ring.length],count=Math.max(1,Math.ceil(lengths[i]/spacing));
  return Array.from({length:count},(_,j)=>[a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count]);
 });
}

function nearest(point,rings){
 let minimum=Infinity;
 for(const ring of rings)for(const [i,a] of ring.entries()){
  const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
  minimum=Math.min(minimum,(point[0]-a[0]-dx*t)**2+(point[1]-a[1]-dy*t)**2);
 }
 return Math.sqrt(minimum);
}

export function compareFormSilhouette(model,outline,tolerance){
 if(!model.length||!outline.length)throw Error('比較できる外周が見つかりません。');
 let max=0;
 const segments=model.flatMap(ring=>{
  const points=samples(ring);
  return points.map((p,i)=>{
   const q=points[(i+1)%points.length],middle=[(p[0]+q[0])/2,(p[1]+q[1])/2],distance=nearest(middle,[outline]);
   max=Math.max(max,distance);
   return {p,q,state:distance<=tolerance?'match':pointInRing(middle,outline)?'inside':'outside'};
  });
 });
 const referenceSegments=[];
 const boundary=samples(outline);
 for(const [i,p] of boundary.entries()){
  const q=boundary[(i+1)%boundary.length],distance=nearest(p,model);
  max=Math.max(max,distance);
  referenceSegments.push({p,q,missing:distance>tolerance&&!model.some(ring=>pointInRing(p,ring))});
 }
 return {max,segments,referenceSegments};
}

export function formProjectionPoint(view,[u,v],offset){
 const {axes,normal}=formProjection[view],p=new Vector3();
 p.setComponent(axes[0],u);p.setComponent(axes[1],v);p.setComponent(normal,offset);
 return p;
}
