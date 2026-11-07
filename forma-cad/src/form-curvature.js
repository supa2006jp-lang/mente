import {Vector3} from 'three';

// Estimate the local shape operator from CAD mesh normals. Face tessellations
// use separate vertices, so intentionally sharp boundaries stay separate.
export function formCurvatureChanges({vertices,triangles,normals}){
 const count=vertices.length/3;
 if(!count||normals?.length!==vertices.length||triangles.length>150000)return null;
 const neighbors=Array.from({length:count},()=>new Set());
 for(let i=0;i<triangles.length;i+=3){
  const a=triangles[i],b=triangles[i+1],c=triangles[i+2];
  neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);
 }
 const normal=new Vector3(),other=new Vector3(),delta=new Vector3(),change=new Vector3();
 const position=new Vector3(),u=new Vector3(),v=new Vector3();
 const curvature=neighbors.map((links,i)=>{
  normal.fromArray(normals,i*3).normalize();
  if(normal.lengthSq()<.5)return null;
  u.set(Math.abs(normal.x)<.8?1:0,Math.abs(normal.x)<.8?0:1,0).cross(normal).normalize();
  v.crossVectors(normal,u);
  position.fromArray(vertices,i*3);
  let xx=0,xy=0,yy=0,ax=0,ay=0,bx=0,by=0;
  for(const j of links){
   other.fromArray(normals,j*3).normalize();
   if(normal.dot(other)<.7)continue;
   delta.fromArray(vertices,j*3).sub(position);change.copy(other).sub(normal);
   const x=delta.dot(u),y=delta.dot(v),length=x*x+y*y;
   if(length<1e-12)continue;
   const a=change.dot(u),b=change.dot(v);
   xx+=x*x/length;xy+=x*y/length;yy+=y*y/length;
   ax+=a*x/length;ay+=a*y/length;bx+=b*x/length;by+=b*y/length;
  }
  const det=xx*yy-xy*xy;
  if(det<1e-5)return null;
  const a=(ax*yy-ay*xy)/det,d=(by*xx-bx*xy)/det;
  const b=(ay*xx-ax*xy+bx*yy-by*xy)/(2*det);
  const spread=Math.hypot(a-d,2*b);
  return [(a+d-spread)/2,(a+d+spread)/2];
 });
 return Float32Array.from(curvature,(k,i)=>{
  if(!k)return 0;
  let score=0;
  for(const j of neighbors[i]){
   const n=curvature[j];
   if(!n)continue;
   const difference=Math.max(Math.abs(k[0]-n[0]),Math.abs(k[1]-n[1]));
   const scale=Math.max(.01,...k.map(Math.abs),...n.map(Math.abs));
   score=Math.max(score,difference/scale);
  }
  return score;
 });
}
