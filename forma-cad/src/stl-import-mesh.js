import {Box3, BufferAttribute, BufferGeometry, Matrix4, ShapeUtils, Vector2, Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

export const STL_IMPORT_MAX_BYTES = 32_000_000;
export const STL_SOLID_MAX_TRIANGLES = 20_000;
const MAX_TRIANGLES = 300_000;
const MAX_PARTS = 500;
const MAX_MARKERS = 400;
const MAX_HOLE_EDGES = 16;
const MAX_HOLE_DIAMETER = 5;
const PLANAR_TOLERANCE = 1e-7;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function readStl(data) {
 const fail = () => { throw Error('STLを読み込めませんでした。バイナリまたはASCIIのSTLファイルを選んでください'); };
 if (!(data instanceof ArrayBuffer) || !data.byteLength || data.byteLength > STL_IMPORT_MAX_BYTES) {
  throw Error('空でない32 MB以下のSTLファイルを指定してください');
 }
 const reader = new DataView(data);
 const count = data.byteLength >= 84 ? reader.getUint32(80, true) : 0;
 const binary = data.byteLength === 84 + 50 * count;
 const points = [], triangles = [], indices = new Map();
 function addTriangle(coords) {
  if (triangles.length >= MAX_TRIANGLES) throw Error('三角形は30万枚まで読み込めます。部品を分けるか、元のソフトでメッシュを簡略化してください');
  if (!coords.every(value => Number.isFinite(Math.fround(value)))) fail();
  const ids = [];
  for (let i = 0; i < coords.length; i += 3) {
   const xyz = coords.slice(i, i + 3), key = xyz.join(',');
   let id = indices.get(key);
   if (id === undefined) {
    id = points.length;
    indices.set(key, id);
    points.push(new Vector3(...xyz));
   }
   ids.push(id);
  }
  triangles.push(ids);
 }
 if (binary) {
  for (let i = 0; i < count; i++) {
   addTriangle(Array.from({length: 9}, (_, j) => reader.getFloat32(96 + i * 50 + j * 4, true)));
  }
 } else {
  const lines = new TextDecoder().decode(data).split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean);
  let i = 0;
  while (i < lines.length) {
   if (!/^solid(?:\s|$)/i.test(lines[i++])) fail();
   while (/^facet\s/i.test(lines[i] || '')) {
    if (!/^facet\s+normal\s+\S+\s+\S+\s+\S+$/i.test(lines[i++]) || !/^outer\s+loop$/i.test(lines[i++] || '')) fail();
    const coords = [];
    for (let j = 0; j < 3; j++) {
     const [word, ...values] = (lines[i++] || '').split(/\s+/);
     if (word.toLowerCase() !== 'vertex' || values.length !== 3 || !values.every(value => NUMBER.test(value))) fail();
     coords.push(...values.map(Number));
    }
    if (!/^endloop$/i.test(lines[i++] || '') || !/^endfacet$/i.test(lines[i++] || '')) fail();
    addTriangle(coords);
   }
   if (!/^endsolid(?:\s|$)/i.test(lines[i++] || '')) fail();
  }
 }
 if (!triangles.length) fail();
 return {points, triangles};
}

function topology(triangles) {
 const edges = new Map(), facesAtPoint = new Map(), neighbours = triangles.map(() => []);
 for (const [face, ids] of triangles.entries()) {
  for (const [i, a] of ids.entries()) {
   const b = ids[(i + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
   if (!edges.has(key)) edges.set(key, []);
   edges.get(key).push({a, b, face});
   if (!facesAtPoint.has(a)) facesAtPoint.set(a, []);
   facesAtPoint.get(a).push(face);
  }
 }
 for (const uses of edges.values()) {
  if (uses.length !== 2) continue;
  const [a,b] = uses, flip = a.a === b.a;
  neighbours[a.face].push({face: b.face, flip, a: a.a, b: a.b});
  neighbours[b.face].push({face: a.face, flip, a: a.a, b: a.b});
 }
 return {edges, neighbours, facesAtPoint};
}

function orientation(topology, triangles, points) {
 const flips = new Array(triangles.length), shells = [];
 for (const start of triangles.keys()) {
  if (flips[start] !== undefined) continue;
  flips[start] = false;
  const faces = [start], box = new Box3();
  for (const face of faces) {
   for (const id of triangles[face]) box.expandByPoint(points[id]);
   for (const link of topology.neighbours[face]) {
    const flip = flips[face] !== link.flip;
    if (flips[link.face] === undefined) {
     flips[link.face] = flip;
     faces.push(link.face);
    } else if (flips[link.face] !== flip) return null;
   }
  }
  shells.push({faces, box});
 }
 return {shells, flips};
}

function splitFan(faces, vertex, neighbours) {
 const visited = new Set([faces[0]]), stack = [faces[0]];
 for (const face of stack) for (const link of neighbours[face]) {
  if ((link.a === vertex || link.b === vertex) && !visited.has(link.face)) {
   visited.add(link.face);
   stack.push(link.face);
  }
 }
 return visited.size !== faces.length;
}

const reversed = ([a,b,c]) => [a,c,b];
const mesh = (points, faces) => ({vertices:points.flatMap(p => p.toArray()), triangles:faces.flat()});

function closeHole(ids, points) {
 if (ids.length < 3 || ids.length > MAX_HOLE_EDGES) return null;
 const ring = ids.map(id => points[id]), start = ring[0], u = ring[1].clone().sub(start).normalize();
 const normal = new Vector3();
 for (let i = 1; i < ring.length - 1; i++) {
  normal.add(ring[i].clone().sub(start).cross(ring[i + 1].clone().sub(start)));
 }
 if (normal.lengthSq() <= PLANAR_TOLERANCE ** 4) return null;
 normal.normalize();
 const v = normal.clone().cross(u), delta = new Vector3(), loop = [];
 for (const p of ring) {
  delta.subVectors(p, start);
  if (Math.abs(delta.dot(normal)) > PLANAR_TOLERANCE || ring.some(q => q.distanceToSquared(p) > MAX_HOLE_DIAMETER ** 2)) return null;
  loop.push(new Vector2(delta.dot(u), delta.dot(v)));
 }
 const crosses = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for (let i = 0; i < loop.length; i++) for (let j = i + 2; j < loop.length; j++) {
  if (i === 0 && j === loop.length - 1) continue;
  const a = loop[i], b = loop[(i+1)%loop.length], c = loop[j], d = loop[(j+1)%loop.length];
  if (Math.max(a.x,b.x) < Math.min(c.x,d.x) || Math.max(c.x,d.x) < Math.min(a.x,b.x) ||
      Math.max(a.y,b.y) < Math.min(c.y,d.y) || Math.max(c.y,d.y) < Math.min(a.y,b.y)) continue;
  if (crosses(a,b,c)*crosses(a,b,d) <= 0 && crosses(c,d,a)*crosses(c,d,b) <= 0) return null;
 }
 const faces = ShapeUtils.triangulateShape(loop, []);
 if (faces.length !== ids.length - 2) return null;
 return faces.map(([a,b,c]) => crosses(loop[a],loop[b],loop[c]) < 0 ? [ids[a],ids[b],ids[c]] : [ids[a],ids[c],ids[b]]);
}

function holeCaps(boundaries, flips, points) {
 const next = new Map(), incoming = new Set();
 for (const uses of boundaries) {
  const {a,b,face} = uses[0], start = flips[face] ? b : a, end = flips[face] ? a : b;
  if (next.has(start) || incoming.has(end)) return null;
  next.set(start, end);
  incoming.add(end);
 }
 const holes = [];
 while (next.size) {
  const start = next.keys().next().value, ids = [];
  let id = start;
  do {
   if (!next.has(id)) return null;
   ids.push(id);
   const end = next.get(id);
   next.delete(id);
   id = end;
  } while (id !== start);
  const faces = closeHole(ids, points);
  holes.push({ids, faces});
 }
 return holes;
}

function signedVolume(shell, faces, points) {
 const origin = points[faces[shell.faces[0]][0]];
 const a = new Vector3(), b = new Vector3(), c = new Vector3();
 let sum = 0;
 for (const i of shell.faces) {
  const [x,y,z] = faces[i];
  sum += a.subVectors(points[x],origin).dot(b.subVectors(points[y],origin).cross(c.subVectors(points[z],origin)));
 }
 return sum / 6;
}

function contains(shell, point, faces, points) {
 const a = new Vector3(), b = new Vector3(), c = new Vector3(), cross = new Vector3();
 let angle = 0;
 for (const i of shell.faces) {
  const [x,y,z] = faces[i];
  a.subVectors(points[x],point).normalize();
  b.subVectors(points[y],point).normalize();
  c.subVectors(points[z],point).normalize();
  angle += 2 * Math.atan2(a.dot(cross.crossVectors(b,c)), 1 + a.dot(b) + b.dot(c) + c.dot(a));
 }
 return Math.abs(angle) > 2 * Math.PI;
}

function intersection(faces, points, partBoundary = 0) {
 const geometry = new BufferGeometry();
 const coords = new Float64Array(points.length * 3);
 // The BVH stores bounds in Float32. Keep those bounds close to the origin.
 const center = new Box3().setFromPoints(points).getCenter(new Vector3()), delta = new Vector3();
 for (const [i, point] of points.entries()) delta.subVectors(point,center).toArray(coords, i*3);
 geometry.setAttribute('position', new BufferAttribute(coords, 3));
 geometry.setIndex(faces.flat());
 let bad;
 try {
  const bvh = new MeshBVH(geometry, {indirect:true});
  bvh.bvhcast(bvh, new Matrix4(), {intersectsTriangles(a,b,first,second) {
   const i = bvh.resolveTriangleIndex(first), j = bvh.resolveTriangleIndex(second);
   if (i >= j || (partBoundary && (i >= partBoundary || j < partBoundary)) ||
       faces[i].some(id => faces[j].includes(id)) || !a.intersectsTriangle(b)) return false;
   bad = [faces[i], faces[j]];
   return true;
  }});
 } finally {geometry.dispose();}
 return bad;
}

export function stlPartsIntersect(a,b) {
 if (!a.box.intersectsBox(b.box)) return false;
 const offset = a.points.length;
 const faces = [...a.faces,...b.faces.map(face => face.map(id => id+offset))];
 return !!intersection(faces,[...a.points,...b.points],a.faces.length);
}

export function analyzeStl({points, triangles}, {quick = false, listRepairs = false} = {}) {
 const counts = {boundary:0, nonmanifold:0, orientation:0, duplicate:0, degenerate:0, vertex:0, intersection:0};
 const segments = [], faces = [], seen = new Set(), u = new Vector3(), v = new Vector3();
 const repairs = [], unfilled = [];
 const segment = (a,b) => [...points[a].toArray(),...points[b].toArray()];
 const outline = ids => ids.flatMap((id,i) => segment(id,ids[(i+1)%ids.length]));
 const overflow = new Map();
 function candidate(type, lines, count = 1, triangles = []) {
  if (!listRepairs) return;
  if (repairs.length >= 120 && ['duplicate','degenerate'].includes(type)) {
   if (overflow.has(type)) {overflow.get(type).count += count; return;}
   overflow.set(type,{id:type+'-rest',type,count,segments:lines,caps:[]});
   return;
  }
  repairs.push({id:type+'-'+repairs.length,type,count,segments:lines,caps:triangles.flat()});
 }
 let segmentsTruncated = false;
 function mark(a,b) {
  if (segments.length >= MAX_MARKERS*6) {segmentsTruncated = true; return;}
  segments.push(...points[a].toArray(), ...points[b].toArray());
 }
 const markFace = ids => ids.forEach((id,i) => mark(id,ids[(i+1)%3]));
 for (const ids of triangles) {
  const [a,b,c] = ids.map(id => points[id]);
  if (!u.subVectors(b,a).cross(v.subVectors(c,a)).lengthSq()) {
   counts.degenerate++;
   if (listRepairs) candidate('degenerate',outline(ids));
   markFace(ids);
   continue;
  }
  const key = [...ids].sort((a,b) => a-b).join(',');
  if (seen.has(key)) {
   counts.duplicate++;
   if (listRepairs) candidate('duplicate',outline(ids));
   markFace(ids);
   continue;
  }
  seen.add(key);
  faces.push(ids);
 }
 const graph = topology(faces), boundaries = [];
 for (const uses of graph.edges.values()) {
  const [first,second] = uses;
  if (uses.length === 1) {counts.boundary++; boundaries.push(uses);}
  else if (uses.length > 2) counts.nonmanifold++;
  else if (first.a === second.a) counts.orientation++;
  else continue;
  mark(first.a,first.b);
 }
 for (const [vertex, incident] of graph.facesAtPoint) {
  if (splitFan(incident,vertex,graph.neighbours)) {counts.vertex++; markFace(faces[incident[0]]);}
 }
 repairs.push(...overflow.values());
 const report = {mesh:mesh(points,faces), counts, segments, segmentsTruncated, ...(listRepairs?{repairs,unfilled}:{})};
 const stop = message => ({...report, message});
 if (!faces.length) return stop('面積のある面が見つかりません。');
 if (counts.nonmanifold || counts.vertex) return stop('面の接続が複雑なため、自動修正できません。元のソフトでメッシュを修復してください。');
 const oriented = orientation(graph,faces,points);
 if (!oriented) return stop('面の向きをそろえられません。');
 const holes = holeCaps(boundaries,oriented.flips,points);
 for (const hole of holes || []) {
  if (hole.faces) candidate('hole',outline(hole.ids),hole.faces.length,hole.faces);
  else if (listRepairs) unfilled.push({segments:outline(hole.ids),count:hole.ids.length});
 }
 if (!holes || holes.some(hole => !hole.faces)) return stop('自動で塞げるのは、直径5 mm以下・16辺以下の平らな穴です。元のソフトで開いた辺を修復してください。');
 const caps = holes.flatMap(hole => hole.faces);
 const closed = [...faces.map((ids,i) => oriented.flips[i] ? reversed(ids) : ids), ...caps];
 const closedGraph = topology(closed);
 if ([...closedGraph.edges.values()].some(uses => uses.length !== 2 || uses[0].a === uses[1].a)) return stop('穴を安全に塞げませんでした。');
 const bad = quick ? null : intersection(closed,points);
 if (bad) {
  counts.intersection++;
  bad.forEach(markFace);
  report.segmentsTruncated = segmentsTruncated;
  return stop('交差する面を検出しました。元のソフトでメッシュを修復してください。');
 }
 const {shells} = orientation(closedGraph,closed,points);
 for (const shell of shells) {
  shell.volume = signedVolume(shell,closed,points);
  if (Math.abs(shell.volume) <= 1e-9) return stop('閉じた体積を確認できませんでした。');
 }
 for (const shell of shells) {
  const point = points[closed[shell.faces[0]][0]];
  const parents = shells.filter(other => other !== shell && Math.abs(other.volume) > Math.abs(shell.volume) &&
   other.box.containsBox(shell.box) && contains(other,point,closed,points));
  shell.depth = parents.length;
  shell.parent = parents.reduce((nearest,other) => !nearest || Math.abs(other.volume) < Math.abs(nearest.volume) ? other : nearest, null);
 }
 let flippedFaces = 0;
 for (const shell of shells) {
  const reverseShell = (shell.volume < 0) !== (shell.depth % 2 === 1);
  const changed = [];
  let count = 0;
  for (const i of shell.faces) {
   if (i >= faces.length) continue;
   if (Boolean(oriented.flips[i]) === reverseShell) continue;
   flippedFaces++;
   count++;
   if (listRepairs && changed.length < MAX_MARKERS*6) changed.push(...outline(faces[i]));
   if (!counts.orientation) markFace(faces[i]);
  }
  if (count) candidate('orientation',changed,count);
 }
 const repair = counts.degenerate || counts.duplicate || caps.length || flippedFaces
  ? {degenerate:counts.degenerate, duplicate:counts.duplicate, filledFaces:caps.length, flippedFaces}
  : null;
 return {...report, segmentsTruncated, repair, solidFaces:closed, shells};
}

function groups(size) {
 const parent = Int32Array.from({length:size},(_,i) => i), rank = new Uint8Array(size);
 function find(i) {
  while (parent[i] !== i) {parent[i] = parent[parent[i]]; i = parent[i];}
  return i;
 }
 return {find, join(a,b) {
  a = find(a); b = find(b);
  if (a === b) return;
  if (rank[a] < rank[b]) [a,b] = [b,a];
  parent[b] = a;
  if (rank[a] === rank[b]) rank[a]++;
 }};
}

export function compactStl(points, triangles) {
 const ids = new Map(), compact = [];
 return {points:compact,triangles:triangles.map(face => face.map(id => {
  if (!ids.has(id)) {ids.set(id,compact.length); compact.push(points[id]);}
  return ids.get(id);
 }))};
}

export function splitStlParts({points, triangles}) {
 const links = groups(points.length), used = new Uint8Array(points.length), u = new Vector3(), v = new Vector3();
 const degenerate = new Uint8Array(triangles.length);
 for (const [i,[a,b,c]] of triangles.entries()) {
  if (!u.subVectors(points[b],points[a]).cross(v.subVectors(points[c],points[a])).lengthSq()) {
   degenerate[i] = 1;
   continue;
  }
  used[a] = used[b] = used[c] = 1;
  links.join(a,b); links.join(a,c);
 }
 const byRoot = new Map(), orphan = [];
 for (const [i,face] of triangles.entries()) {
  const vertex = degenerate[i] ? face.find(id => used[id]) : face[0];
  if (vertex === undefined) {orphan.push(face); continue;}
  const root = links.find(vertex);
  if (!byRoot.has(root)) {
   if (byRoot.size === MAX_PARTS) throw Error('部品は500個まで一覧にできます。STLを分けてから開いてください');
   byRoot.set(root,[]);
  }
  byRoot.get(root).push(face);
 }
 const parts = [...byRoot.values()];
 if (orphan.length) parts.push(orphan);
 const boxes = parts.map(faces => {
  const box = new Box3();
  for (const face of faces) for (const id of face) box.expandByPoint(points[id]);
  return box;
 });
 // A cavity shell is selectable only together with the containing part.
 const partLinks = groups(parts.length), containment = new Map();
 function enclosingFaces(j) {
  if (containment.has(j)) return containment.get(j);
  const outer = parts[j], graph = topology(outer), oriented = orientation(graph,outer,points);
  const closed = oriented && [...graph.edges.values()].every(uses => uses.length === 2);
  const faces = closed ? outer.map((face,k) => oriented.flips[k] ? reversed(face) : face) : null;
  const result = faces ? {faces,shell:{faces:outer.map((_,face) => face)}} : null;
  containment.set(j,result);
  return result;
 }
 for (const [i,faces] of parts.entries()) {
  const inner = boxes[i];
  const possible = boxes.flatMap((outer,j) => j !== i && outer.containsBox(inner) && !outer.equals(inner) ? [j] : []);
  for (const j of possible) {
   if (faces === orphan || parts[j] === orphan) continue;
   const enclosure = enclosingFaces(j);
   // An invalid enclosing shell must remain with a possible cavity until it can be checked.
   if (!enclosure || contains(enclosure.shell,points[faces[0][0]],enclosure.faces,points)) {
    partLinks.join(i,j);
   }
  }
 }
 const grouped = new Map();
 for (const [i,faces] of parts.entries()) {
  const root = partLinks.find(i);
  if (!grouped.has(root)) grouped.set(root,[]);
  const combined = grouped.get(root);
  for (const face of faces) combined.push(face);
 }
 // Isolated zero-area triangles are debris. Attach them to an existing part's
 // review so an otherwise valid single body still presents the cleanup.
 if (orphan.length && grouped.size > 1) {
  grouped.delete(partLinks.find(parts.length-1));
  const first = grouped.values().next().value;
  for (const face of orphan) first.push(face);
 }
 return [...grouped.values()].map(faces => compactStl(points,faces));
}

function triangulatePatch(edges,normal,points,junctions) {
 const next = new Map(edges);
 if (next.size !== edges.length) return null;
 const rings = [], u = new Vector3(), v = new Vector3();
 while (next.size) {
  const start = next.keys().next().value, ring = [];
  let id = start;
  do {
   if (!next.has(id)) return null;
   ring.push(id);
   const successor = next.get(id);
   next.delete(id);
   id = successor;
  } while (id !== start);
  const clean = ring.filter((vertex,i) => {
   if (junctions[vertex]) return true;
   u.subVectors(points[vertex],points[ring[(i+ring.length-1)%ring.length]]);
   v.subVectors(points[ring[(i+1)%ring.length]],points[vertex]);
   return u.dot(v) <= 0 || u.cross(v).length() > 1e-8*v.length();
  });
  if (clean.length < 3) return null;
  rings.push(clean);
 }
 const origin = points[rings[0][0]];
 u.set(...(Math.abs(normal.x)<.8 ? [1,0,0] : [0,1,0]));
 u.addScaledVector(normal,-u.dot(normal)).normalize();
 v.crossVectors(normal,u);
 const delta = new Vector3();
 const paths = rings.map(ring => {
  const coords = ring.map(id => {
   delta.subVectors(points[id],origin);
   return new Vector2(delta.dot(u),delta.dot(v));
  });
  return {ring,coords,area:ShapeUtils.area(coords)};
 }).sort((a,b) => Math.abs(b.area)-Math.abs(a.area));
 if (paths[0].area <= 0 || paths.slice(1).some(path => path.area >= 0)) return null;
 const ids = paths.flatMap(path => path.ring);
 const triangles = ShapeUtils.triangulateShape(paths[0].coords,paths.slice(1).map(path => path.coords));
 if (!triangles.length) return null;
 return triangles.map(face => {
  const [a,b,c] = face.map(i => ids[i]);
  const sign = u.subVectors(points[b],points[a]).cross(v.subVectors(points[c],points[a])).dot(normal);
  return sign > 0 ? [a,b,c] : [a,c,b];
 });
}

export function reducePlanarStl({points,triangles}) {
 const graph = topology(triangles);
 const u = new Vector3(), v = new Vector3();
 const normals = triangles.map(([a,b,c]) => u.subVectors(points[b],points[a]).cross(v.subVectors(points[c],points[a])).clone().normalize());
 const ownership = new Int32Array(triangles.length).fill(-1), patches = [];
 const firstOwner = new Int32Array(points.length).fill(-1), secondOwner = new Int32Array(points.length).fill(-1), junctions = new Uint8Array(points.length);
 for (const start of triangles.keys()) {
  if (ownership[start] >= 0) continue;
  const patch = patches.length, faces = [start], normal = normals[start], origin = points[triangles[start][0]];
  patches.push({faces,normal,edges:[]});
  ownership[start] = patch;
  for (const face of faces) {
   for (const vertex of triangles[face]) {
    if (firstOwner[vertex] < 0) firstOwner[vertex] = patch;
    else if (firstOwner[vertex] !== patch) {
     if (secondOwner[vertex] < 0) secondOwner[vertex] = patch;
     else if (secondOwner[vertex] !== patch) junctions[vertex] = 1;
    }
   }
   for (const {face:neighbour} of graph.neighbours[face]) {
    if (ownership[neighbour] >= 0 || normal.dot(normals[neighbour]) < 1-1e-12) continue;
    if (triangles[neighbour].some(id => Math.abs(u.subVectors(points[id],origin).dot(normal)) > 1e-7)) continue;
    ownership[neighbour] = patch;
    faces.push(neighbour);
   }
  }
 }
 for (const uses of graph.edges.values()) {
  if (uses.length !== 2) return null;
  if (ownership[uses[0].face] === ownership[uses[1].face]) continue;
  for (const {a,b,face} of uses) patches[ownership[face]].edges.push([a,b]);
 }
 const result = [];
 for (const {faces,edges,normal} of patches) {
  const reduced = faces.length > 2 ? triangulatePatch(edges,normal,points,junctions) : null;
  // Every patch simplifies its shared straight seams by the same rule. The
  // caller checks the result as a whole before it can be used.
  for (const face of reduced || faces.map(i => triangles[i])) result.push(face);
 }
 return result.length < triangles.length ? compactStl(points,result) : null;
}
