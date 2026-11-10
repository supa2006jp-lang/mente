import {Box3, Vector2, Vector3} from 'three';
import {steppedStlProfile} from './stl-import-stepped.js';

const edgeKey = (a,b) => a < b ? a+','+b : b+','+a;

function boundaries(cap) {
 const edges = new Map();
 for (const face of cap) for (const [i,a] of face.entries()) {
  const b = face[(i+1)%3], key = edgeKey(a,b);
  edges.set(key,edges.has(key) ? null : [a,b]);
 }
 return new Map([...edges].filter(([,pair]) => pair));
}

function loops(edges) {
 const links = new Map();
 for (const [a,b] of edges.values()) {
  if (links.has(a)) return null;
  links.set(a,b);
 }
 const result = [];
 while (links.size) {
  const start = links.keys().next().value, loop = [];
  let id = start;
  do {
   if (!links.has(id)) return null;
   loop.push(id);
   const next = links.get(id);
   links.delete(id);
   id = next;
  } while (id !== start);
  result.push(loop);
 }
 return result;
}

const areaOf = polygon => polygon.reduce((sum,p,i) => sum+p.cross(polygon[(i+1)%polygon.length]),0)/2;

function fitCircle(polygon, precision) {
 if (polygon.length < 12) return null;
 const a = polygon[0], b = polygon[Math.floor(polygon.length/3)].clone().sub(a);
 const c = polygon[Math.floor(polygon.length*2/3)].clone().sub(a);
 const determinant = 2*b.cross(c);
 if (Math.abs(determinant) < precision ** 2) return null;
 const center = new Vector2(
  (c.y*b.lengthSq()-b.y*c.lengthSq())/determinant,
  (b.x*c.lengthSq()-c.x*b.lengthSq())/determinant
 ).add(a);
 const radius = center.distanceTo(a), tolerance = Math.max(precision,Math.min(.02,radius*.002));
 if (radius < precision || polygon.some(p => Math.abs(p.distanceTo(center)-radius) > tolerance)) return null;
 let maximum = 0, totalAngle = 0;
 const direction = Math.sign(areaOf(polygon));
 for (const [i,p] of polygon.entries()) {
  const from = p.clone().sub(center), to = polygon[(i+1)%polygon.length].clone().sub(center);
  const angle = Math.atan2(from.cross(to),from.dot(to))*direction;
  if (angle <= 1e-6 || angle > Math.PI/4) return null;
  totalAngle += angle;
  const edge = to.clone().sub(from), t = Math.max(0,Math.min(1,-from.dot(edge)/edge.lengthSq()));
  const near = from.clone().addScaledVector(edge,t).length();
  maximum = Math.max(maximum,Math.abs(near-radius),Math.abs(from.length()-radius),Math.abs(to.length()-radius));
 }
 if (Math.abs(totalAngle-2*Math.PI) > 1e-4) return null;
 return {center,radius,deviation:maximum+2*precision};
}

function profileOnAxis(points, faces, axis, tolerance) {
 const origin = points[faces[0][0]];
 const v = new Vector3(), u = Math.abs(axis.x)<.8 ? new Vector3(1,0,0) : new Vector3(0,1,0);
 u.addScaledVector(axis,-u.dot(axis)).normalize();
 v.crossVectors(axis,u);
 const projected = points.map(p => {
  const relative = p.clone().sub(origin);
  return new Vector3(relative.dot(u),relative.dot(v),relative.dot(axis));
 });
 let low = Infinity, high = -Infinity;
 for (const face of faces) for (const id of face) {
  low = Math.min(low,projected[id].z);
  high = Math.max(high,projected[id].z);
 }
 if (high-low < tolerance*10) return null;
 const sides = projected.map(p => Math.abs(p.z-low)<=tolerance ? 0 : Math.abs(p.z-high)<=tolerance ? 1 : -1);
 const caps = [[],[]], walls = [];
 for (const face of faces) {
  const levels = face.map(id => sides[id]);
  if (levels.includes(-1)) return null;
  if (levels.every(level => level === levels[0])) caps[levels[0]].push(face);
  else walls.push(face);
 }
 if (!caps[0].length || !caps[1].length || !walls.length) return null;
 const rim = caps.map(boundaries);
 const covered = [new Set(),new Set()];
 let wallError = 0;
 for (const face of walls) {
  const side = face.filter(id => sides[id]===0).length === 2 ? 0 : 1;
  const [a,b] = face.filter(id => sides[id]===side), c = face.find(id => sides[id]!==side);
  const key = edgeKey(a,b);
  if (!rim[side].has(key) || covered[side].has(key)) return null;
  const d = Math.min(...[a,b].map(id => Math.hypot(projected[id].x-projected[c].x,projected[id].y-projected[c].y)));
  if (d > tolerance) return null;
  wallError = Math.max(wallError,d);
  covered[side].add(key);
 }
 if (rim.some((edges,i) => edges.size !== covered[i].size)) return null;
 const paths = loops(rim[0]), otherPaths = loops(rim[1]);
 if (!paths?.length || paths.length !== otherPaths?.length) return null;
 const profile = paths.map(loop => {
  const polygon = loop.map(id => new Vector2(projected[id].x,projected[id].y));
  return {polygon, area:Math.abs(areaOf(polygon)), circle:fitCircle(polygon,tolerance)};
 }).sort((a,b) => b.area-a.area);
 if (!profile.some(loop => loop.circle)) return null;
 const base = origin.clone().addScaledVector(axis,low);
 const world = (p,z=0) => base.clone().addScaledVector(u,p.x).addScaledVector(v,p.y).addScaledVector(axis,z).toArray();
 const height = high-low;
 return {axis:axis.toArray(),height,loops:profile.map((loop,i) => ({
  area:loop.area, points:loop.polygon.map(p => world(p)),
  ...(loop.circle ? {circle:{
   id:'circle-'+i,kind:i?'hole':'cylinder',center:world(loop.circle.center),radius:loop.circle.radius,
   deviation:loop.circle.deviation+wallError,
   segments:[0,height].flatMap(z => Array.from({length:64},(_,j) => {
    const point = angle => world(loop.circle.center.clone().add(new Vector2(Math.cos(angle),Math.sin(angle)).multiplyScalar(loop.circle.radius)),z);
    return [...point(j*Math.PI/32),...point((j+1)*Math.PI/32)];
   }).flat())
  }} : {})
 }))};
}

export function circularStlProfile({points,solidFaces,shells}) {
 if (shells.length !== 1) return null;
 const faces = shellFaces(shells[0],solidFaces), directions = new Map();
 const a = new Vector3(), b = new Vector3(), n = new Vector3();
 for (const [i,j,k] of faces) {
  n.crossVectors(a.subVectors(points[j],points[i]),b.subVectors(points[k],points[i]));
  const weight = n.length();
  if (!weight) continue;
  n.divideScalar(weight);
  const dominant = [n.x,n.y,n.z].reduce((max,v) => Math.abs(v)>Math.abs(max)?v:max,0);
  if (dominant < 0) n.negate();
  const key = n.toArray().map(x => Math.round(x*1000)).join(',');
  const entry = directions.get(key) || {direction:new Vector3(),weight:0};
  entry.direction.addScaledVector(n,weight);
  entry.weight += weight;
  directions.set(key,entry);
 }
 const tolerance = Math.max(2e-6,new Box3().setFromPoints(points).getSize(a).length()*1e-6);
 for (const {direction} of [...directions.values()].sort((x,y) => y.weight-x.weight).slice(0,10)) {
  const axis = direction.normalize();
  const plan = profileOnAxis(points,faces,axis,tolerance);
  if (plan) return {slabs:[plan],circles:plan.loops.flatMap(loop=>loop.circle?[loop.circle]:[])};
  const stepped = steppedStlProfile(points,faces,axis,tolerance,shells[0].volume,fitCircle);
  if (stepped) return stepped;
 }
 return null;
}

function shellFaces(shell,faces) {
 return shell.faces.map(i => faces[i]);
}
