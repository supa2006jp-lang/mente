import * as THREE from 'three';

// Tessellated CAD seams can meet within rounding tolerance, or share a section
// edge at the beginning of a thread. Walk planar faces instead of requiring
// every contour vertex to have exactly two neighbours.
export function sectionCap(segments,plane,{precision=false}={}){
 const n=plane.normal,u=new THREE.Vector3(Math.abs(n.x)<.9?1:0,Math.abs(n.x)<.9?0:1,0);
 u.addScaledVector(n,-u.dot(n)).normalize();const v=n.clone().cross(u),nodes=[],buckets=new Map(),edges=new Set(),tolerance=1e-5;
 function node(point){
  const world=new THREE.Vector3(...point),p=new THREE.Vector2(world.dot(u),world.dot(v)),x=Math.floor(p.x/tolerance),y=Math.floor(p.y/tolerance);
  let nearest=-1,distance=tolerance*tolerance;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const id of buckets.get((x+dx)+','+(y+dy))||[]){const d=nodes[id].p.distanceToSquared(p);if(d<=distance){nearest=id;distance=d;}}
  if(nearest>=0)return nearest;
  const id=nodes.length,key=x+','+y;nodes.push({p,links:new Set()});if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;
 }
 for(let i=0;i<segments.length;i+=6){
  const a=node(segments.slice(i,i+3)),b=node(segments.slice(i+3,i+6)),key=Math.min(a,b)+','+Math.max(a,b);
  if(a===b||edges.has(key))continue;edges.add(key);nodes[a].links.add(b);nodes[b].links.add(a);
 }
 // An open fragment is not evidence of filled material. Remove only dangling
 // branches, retaining closed neighbouring contours and genuine holes.
 const ends=nodes.flatMap((node,id)=>node.links.size<2?[id]:[]);
 while(ends.length){const id=ends.pop(),item=nodes[id];if(item.links.size>1)continue;for(const other of item.links){nodes[other].links.delete(id);if(nodes[other].links.size===1)ends.push(other);}item.links.clear();}
 const neighbours=nodes.map(item=>[...item.links].sort((a,b)=>Math.atan2(nodes[a].p.y-item.p.y,nodes[a].p.x-item.p.x)-Math.atan2(nodes[b].p.y-item.p.y,nodes[b].p.x-item.p.x)));
 const used=new Set(),loops=[];
 for(let start=0;start<nodes.length;start++)for(const next of neighbours[start]){
  if(used.has(start+','+next))continue;
  let a=start,b=next,valid=false;const points=[];
  for(let step=0;step<=edges.size*2;step++){
   const key=a+','+b;if(used.has(key)){valid=a===start&&b===next;break;}
   used.add(key);points.push(nodes[a].p);const around=neighbours[b],index=around.indexOf(a),c=around[(index+around.length-1)%around.length];a=b;b=c;
  }
  const area=THREE.ShapeUtils.area(points);
  // Clockwise walks describe the unbounded side of each component.
  if(!valid||points.length<3||area<=1e-12)continue;
  const triangles=THREE.ShapeUtils.triangulateShape(points,[]);let sample=null,best=0;
  for(const [a,b,c] of triangles){const size=Math.abs((points[b].x-points[a].x)*(points[c].y-points[a].y)-(points[b].y-points[a].y)*(points[c].x-points[a].x));if(size>best){best=size;sample=points[a].clone().add(points[b]).add(points[c]).multiplyScalar(1/3);}}
  if(sample)loops.push({points,area,sample});
 }
 const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
 const depths=loops.map(loop=>loops.filter(other=>other.area>loop.area&&inside(loop.sample,other.points)).length),vertices=[];
 for(let i=0;i<loops.length;i++){
  if(depths[i]%2)continue;
  const outer=loops[i].points,holes=loops.filter((loop,j)=>depths[j]===depths[i]+1&&inside(loop.sample,outer)).map(loop=>loop.points),points=[outer,...holes].flat();
  for(const triangle of THREE.ShapeUtils.triangulateShape(outer,holes))for(const index of triangle){const p=points[index];vertices.push(...u.clone().multiplyScalar(p.x).addScaledVector(v,p.y).addScaledVector(n,-plane.constant).toArray());}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',precision?new THREE.BufferAttribute(new Float64Array(vertices),3):new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}
