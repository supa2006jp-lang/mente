import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import {formGeometryRings,formKnots,formPointsAt,formRingOutline} from './form-profile.js';
import {formWorld} from './form-orientation.js';

function resampleOutline(outline,anchor,count){
 const distance=([x,y],[u,v])=>Math.hypot(x-u,y-v);
 const start=outline.reduce((best,p,i)=>distance(p,anchor)<distance(outline[best],anchor)?i:best,0);
 const points=[...outline.slice(start),...outline.slice(0,start)];
 points.push(points[0]);
 const ends=[0];
 for(let i=1;i<points.length;i++)ends.push(ends.at(-1)+distance(points[i-1],points[i]));
 let segment=1;
 return Array.from({length:count},(_,i)=>{
  const at=i*ends.at(-1)/count;
  while(segment<ends.length-1&&ends[segment]<=at)segment++;
  const span=ends[segment]-ends[segment-1],t=span?(at-ends[segment-1])/span:0;
  return points[segment-1].map((value,axis)=>value+t*(points[segment][axis]-value));
 });
}

export function formDragGeometry(form,axes){
 const rings=formGeometryRings(form);
 const parameters=[...new Set([...Array.from({length:48},(_,i)=>i/6),...rings.flatMap(formKnots)])].sort((a,b)=>a-b);
 const count=parameters.length,vertices=[],triangles=[],sections=[];
 for(const ring of rings){
  const section=ring.reference?resampleOutline(formRingOutline(ring,axes),ring.points[0],count):formPointsAt(ring,parameters);
  sections.push(section);
  for(const [x,y] of section)vertices.push(...formWorld(axes,x,y,ring.z).toArray());
 }
 for(let s=1;s<rings.length;s++)for(let i=0;i<count;i++){
  const next=(i+1)%count,a=(s-1)*count+i,b=(s-1)*count+next,c=s*count+next,d=s*count+i;
  triangles.push(a,b,c,a,c,d);
 }
 for(const [s,reverse] of [[0,true],[rings.length-1,false]]){
  for(const [a,b,c] of ShapeUtils.triangulateShape(sections[s].map(p=>new Vector2(...p)),[]))
   triangles.push(...(reverse?[c,b,a]:[a,b,c]).map(i=>i+s*count));
 }
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(triangles);
 geometry.computeVertexNormals();
 return geometry;
}
