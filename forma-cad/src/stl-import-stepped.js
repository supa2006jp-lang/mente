import {ShapeUtils,Vector2,Vector3} from 'three';

const MAX_LAYERS = 24;
const cross2 = (a,b,c) => (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
const keyFor = (a,b) => a<b ? a+','+b : b+','+a;

function horizontalLevels(projected,faces,tolerance) {
 const levels = [], walls = [];
 const a = new Vector3(), b = new Vector3(), n = new Vector3(), edges = new Map();
 for (const face of faces) {
  const [x,y,z] = face.map(id => projected[id]);
  const min = Math.min(x.z,y.z,z.z), max = Math.max(x.z,y.z,z.z);
  if (max-min <= tolerance) {levels.push((x.z+y.z+z.z)/3); continue;}
  n.crossVectors(a.subVectors(y,x),b.subVectors(z,x)).normalize();
  if (Math.abs(n.z)>3e-5) return null;
  for (const [i,id] of face.entries()) {
   const next = face[(i+1)%3], p = projected[id], q = projected[next];
   if (Math.abs(p.z-q.z)<=tolerance || Math.hypot(p.x-q.x,p.y-q.y)<=tolerance) continue;
   const key = keyFor(id,next), other = edges.get(key);
   if (other) {
    if (other.dot(n)<1-1e-7) return null;
    edges.delete(key);
   } else edges.set(key,n.clone());
  }
  walls.push(face);
 }
 if (edges.size || !walls.length) return null;
 const heights = [];
 for (const value of levels.sort((a,b)=>a-b)) {
  if (!heights.length || value-heights.at(-1)>tolerance) heights.push(value);
 }
 return heights.length>=3 && heights.length<=MAX_LAYERS && heights.length*walls.length<=2_000_000 ? {heights,walls} : null;
}

function slice(projected,walls,z,tolerance) {
 const links = new Map(), points = new Map();
 // The caller tries nearby sections if the plane passes through a vertex.
 if (projected.some(p=>Math.abs(p.z-z)<tolerance/100)) return null;
 for (const face of walls) {
  const hits = [];
  for (const [i,id] of face.entries()) {
   const next = face[(i+1)%3], p = projected[id], q = projected[next];
   if ((p.z<z)===(q.z<z)) continue;
   const key = keyFor(id,next), t = (z-p.z)/(q.z-p.z);
   if (!points.has(key)) points.set(key,new Vector2(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t));
   hits.push(key);
  }
  if (!hits.length) continue;
  if (hits.length!==2) return null;
  for (const [i,key] of hits.entries()) {
   if (!links.has(key)) links.set(key,[]);
   links.get(key).push(hits[1-i]);
  }
 }
 if (!links.size || [...links.values()].some(neighbours=>neighbours.length!==2)) return null;
 const polygons = [];
 while (links.size) {
  const start = links.keys().next().value, path = [];
  let current = start, previous = null;
  do {
   const neighbours = links.get(current);
   if (!neighbours) return null;
   path.push(points.get(current));
   links.delete(current);
   const next = neighbours[0]===previous ? neighbours[1] : neighbours[0];
   previous = current;
   current = next;
  } while (current!==start);
  const polygon = path.filter((point,i)=>{
   const a=path[(i+path.length-1)%path.length], b=path[(i+1)%path.length];
   const dx=point.x-a.x, dy=point.y-a.y, ex=b.x-point.x, ey=b.y-point.y;
   return dx*ex+dy*ey<=0 || Math.abs(cross2(a,point,b))>tolerance*Math.hypot(b.x-a.x,b.y-a.y);
  });
  if (polygon.length<3) return null;
  polygons.push(polygon);
 }
 return polygons;
}

function inside(point,polygon) {
 let result = false;
 for (const [i,a] of polygon.entries()) {
  const b = polygon[(i+1)%polygon.length];
  if ((a.y>point.y)!==(b.y>point.y) && point.x < a.x+(point.y-a.y)*(b.x-a.x)/(b.y-a.y)) result=!result;
 }
 return result;
}

function samePolygon(a,b,tolerance) {
 if (a.length!==b.length) return false;
 const squared=tolerance*tolerance;
 const start=b.findIndex(point=>point.distanceToSquared(a[0])<=squared);
 if (start<0) return false;
 return [1,-1].some(direction=>a.every((point,i)=>point.distanceToSquared(b[(start+direction*i+b.length)%b.length])<=squared));
}

function circularBands(slabs,tolerance) {
 const groups = [];
 for (const [i,slab] of slabs.entries()) for (const [j,loop] of slab.loops.entries()) {
  if (!loop.fit) continue;
  const {center,radius} = loop.fit, inner = j>0;
  let group = groups.find(item => item.inner===inner && item.last===i-1 && item.center.distanceTo(center)<=tolerance*3);
  if (!group) {group={inner,center,first:i,last:i,bands:[]};groups.push(group);}
  group.last = i;
  group.bands.push({slab,loop,radius});
 }
 return groups;
}

export function steppedStlProfile(points,faces,axis,tolerance,volume,fitCircle) {
 const origin = points[faces[0][0]], ref = Math.abs(axis.x)<.8 ? new Vector3(1,0,0) : new Vector3(0,1,0);
 const u = ref.addScaledVector(axis,-ref.dot(axis)).normalize(), v = axis.clone().cross(u);
 const projected = points.map(point=>{
  const p=point.clone().sub(origin);
  return new Vector3(p.dot(u),p.dot(v),p.dot(axis));
 });
 const layers = horizontalLevels(projected,faces,tolerance);
 if (!layers) return null;
 const {heights,walls} = layers;
 const world = (p,z) => origin.clone().addScaledVector(u,p.x).addScaledVector(v,p.y).addScaledVector(axis,z).toArray();
 const slabs = [];
 for (let i=0;i<heights.length-1;i++) {
  const low=heights[i], high=heights[i+1], height=high-low;
  if (height<=10*tolerance) return null;
  let polygons;
  for (const fraction of [.437912,.57191,.359823]) {
   polygons=slice(projected,walls,low+height*fraction,tolerance);
   if (polygons) break;
  }
  if (!polygons) return null;
  const loops = polygons.map(polygon=>({polygon,area:Math.abs(ShapeUtils.area(polygon))})).sort((a,b)=>b.area-a.area);
  if (loops.slice(1).some((loop,j)=>!inside(loop.polygon[0],loops[0].polygon) ||
      loops.slice(1,j+1).some(other=>inside(loop.polygon[0],other.polygon)))) return null;
  for (const [j,loop] of loops.entries()) {
   // Matching sections share exactly the same polygon across a step.
   const previous=slabs.at(-1)?.loops.find((other,k)=>(j===0)===(k===0)&&samePolygon(loop.polygon,other.polygon,tolerance));
   if (previous) {loop.polygon=previous.polygon;loop.area=previous.area;}
   loop.fit = fitCircle(loop.polygon,tolerance);
   loop.points = loop.polygon.map(p=>world(p,low));
  }
  slabs.push({axis:axis.toArray(),height,low,high,loops});
 }
 const rebuiltVolume = slabs.reduce((sum,{loops,height})=>sum+height*loops.reduce((area,loop,i)=>area+(i?-loop.area:loop.area),0),0);
 if (!(rebuiltVolume>0) || Math.abs(rebuiltVolume-Math.abs(volume))>Math.max(tolerance**3,rebuiltVolume*2e-5)) return null;
 const circles = [];
 for (const group of circularBands(slabs,tolerance)) {
  const lowEnd=group.first===0, highEnd=group.last===slabs.length-1;
  if (group.inner && !lowEnd && !highEnd) continue;
  const id = 'step-circle-'+circles.length, steps = [], segments = [];
  let deviation = 0;
  for (const {slab,loop,radius} of group.bands) {
   const previous = steps.at(-1), sameRadius = previous && Math.abs(previous.radius-radius)<=tolerance*3;
   const normalized = sameRadius ? previous.radius : radius;
   if (sameRadius) previous.depth += slab.height;
   else steps.push({radius,start:slab.low-heights[0],depth:slab.height});
   loop.circle = {id,center:world(group.center,slab.low),radius:normalized};
   deviation=Math.max(deviation,loop.fit.deviation+loop.fit.center.distanceTo(group.center)+Math.abs(radius-normalized)+tolerance*2);
   for (const z of [slab.low,slab.high]) for (let i=0;i<48;i++) {
    const at = angle=>world(new Vector2(group.center.x+normalized*Math.cos(angle),group.center.y+normalized*Math.sin(angle)),z);
    segments.push(...at(i*Math.PI/24),...at((i+1)*Math.PI/24));
   }
  }
  const widerMouth = steps.length>1 && ((lowEnd&&steps[0].radius>steps[1].radius) ||
   (highEnd&&steps.at(-1).radius>steps.at(-2).radius));
  const kind = group.inner ? (widerMouth?'counterbore':steps.length>1?'stepped-hole':lowEnd&&highEnd?'hole':'blind')
   : (steps.length>1?'stepped':'cylinder');
  circles.push({id,kind,radius:steps[0].radius,steps,deviation,segments});
 }
 if (!circles.length) return null;
 return {slabs,circles};
}
