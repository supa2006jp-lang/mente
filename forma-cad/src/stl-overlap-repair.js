import {inspectStlMesh, STL_INSPECTION_MAX_TRIANGLES} from './stl-mesh-health.js';

const edgeKey = (a, b) => a < b ? a + ',' + b : b + ',' + a;
const positionKey = (v, i) => [Math.fround(v[i]), Math.fround(v[i + 1]), Math.fround(v[i + 2])].join(',');

function disjointSets(count) {
  const parents = Array.from({length: count}, (_, i) => i);
  function root(i) {
    while (i !== parents[i]) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  }
  return {root, join(a, b) { parents[root(a)] = root(b); }};
}

function eligible(row) {
  return row.complete && row.issues.some(i => i.code === 'duplicate' || i.code === 'nonmanifold') &&
    row.issues.every(i => ['duplicate', 'nonmanifold', 'orientation'].includes(i.code));
}

// A selection may split the two sides of a shared wall across different colours.
// Look up exact edges of failed bodies only. A distant defect must not pull an
// unrelated selection into the repair or make it exceed the inspection limit.
function contactGroups(meshes, rows) {
  const faulty = meshes.filter(m => eligible(rows.get(m.id)));
  if (!faulty.length) return [];
  if (meshes.length === 1) return [faulty];
  const ids = new Map();
  const edgeOwners = new Map();
  const sets = disjointSets(meshes.length);
  const indices = new Map(meshes.map((m, i) => [m.id, i]));
  const included = new Set();
  function link(mesh, seed) {
    const owner = indices.get(mesh.id);
    const vertices = new Int32Array(mesh.vertices.length / 3);
    let matches = 0;
    for (let i = 0; i < vertices.length; i++) {
      const key = positionKey(mesh.vertices, i * 3);
      if (seed && !ids.has(key)) ids.set(key, ids.size);
      vertices[i] = ids.get(key) ?? -1;
      if (vertices[i] >= 0) matches++;
    }
    if (!seed && matches < 2) return;
    const t = mesh.triangles;
    for (let i = 0; i < t.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = vertices[t[i + j]], b = vertices[t[i + (j + 1) % 3]];
        if (a < 0 || b < 0 || a === b) continue;
        const key = edgeKey(a, b), other = edgeOwners.get(key);
        if (other !== undefined && other !== owner) {
          sets.join(owner, other);
          included.add(owner);
        } else if (seed) edgeOwners.set(key, owner);
      }
    }
    if (seed) included.add(owner);
  }
  for (const mesh of faulty) link(mesh, true);
  for (const mesh of meshes) if (rows.get(mesh.id).ok) link(mesh, false);
  const groups = new Map();
  for (const i of included) {
    const key = sets.root(i);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meshes[i]);
  }
  return [...groups.values()];
}

function indexedFaces(meshes) {
  const ids = new Map(), points = [], faces = [];
  for (const mesh of meshes) {
    const indices = new Uint32Array(mesh.vertices.length / 3);
    for (let i = 0; i < indices.length; i++) {
      const key = positionKey(mesh.vertices, i * 3);
      if (!ids.has(key)) {
        ids.set(key, points.length);
        points.push(mesh.vertices.slice(i * 3, i * 3 + 3).map(Math.fround));
      }
      indices[i] = ids.get(key);
    }
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const face = mesh.triangles.slice(i, i + 3).map(index => indices[index]);
      faces.push(face);
    }
  }
  return {points, faces};
}

function faceNormal(face, points) {
  const [a,b,c] = face.map(i => points[i]);
  const x = b[0]-a[0], y = b[1]-a[1], z = b[2]-a[2];
  const u = c[0]-a[0], v = c[1]-a[1], w = c[2]-a[2];
  const cross = [y*w-z*v, z*u-x*w, x*v-y*u];
  const length = Math.hypot(...cross);
  return cross.map(n => n / length);
}
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

function triangleBuckets(faces) {
  const buckets = new Map();
  for (const [i, f] of faces.entries()) {
    const sorted = [...f].sort((a,b) => a-b), key = sorted.join(',');
    let bucket = buckets.get(key);
    if (!bucket) { bucket = [[],[]]; buckets.set(key, bucket); }
    const start = f.indexOf(sorted[0]);
    bucket[Number(f[(start+1)%3] === sorted[1])].push(i);
  }
  return buckets;
}

function meshEdges(faces, removed) {
  const edges = new Map();
  for (const [i, f] of faces.entries()) {
    if (removed.has(i)) continue;
    for (let j = 0; j < 3; j++) {
      const a = f[j], b = f[(j+1)%3], key = edgeKey(a,b);
      let edge = edges.get(key);
      if (!edge) { edge = {count:0, sign:0, first:i, second:-1}; edges.set(key, edge); }
      if (++edge.count === 2) edge.second = i;
      edge.sign += a < b ? 1 : -1;
    }
  }
  return edges;
}

function removeDuplicateTriangles(faces, buckets, removed) {
  const opposite = [];
  for (const [back, front] of buckets.values()) {
    for (const side of [back, front]) for (let i = 1; i < side.length; i++) removed.add(side[i]);
    if (back.length && front.length) opposite.push([back[0], front[0]]);
  }
  const edges = meshEdges(faces, removed);
  if (!opposite.length) return edges;

  // An extra reversed copy on an exterior surface leaves three faces at
  // the border of the patch. Follow the winding of the remaining neighbour
  // and propagate that choice into the patch, whatever the input order.
  const incident = new Map();
  for (const [index, [, front]] of opposite.entries()) {
    const f = faces[front];
    for (let j = 0; j < 3; j++) {
      const key = edgeKey(f[j], f[(j+1)%3]);
      if (!incident.has(key)) incident.set(key, []);
      incident.get(key).push(index);
    }
  }
  const queue = opposite.map((_, i) => i);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [back, front] = opposite[queue[cursor]];
    if (removed.has(back) || removed.has(front)) continue;
    const f = faces[front];
    let discard = -1;
    for (let j = 0; j < 3; j++) {
      const a = f[j], b = f[(j+1)%3], edge = edges.get(edgeKey(a,b));
      if (edge.count !== 3 || Math.abs(edge.sign) !== 1) continue;
      const wrong = edge.sign === (a < b ? 1 : -1) ? front : back;
      if (discard !== -1 && discard !== wrong) { discard = -1; break; }
      discard = wrong;
    }
    if (discard === -1) continue;
    removed.add(discard);
    const wrong = faces[discard];
    for (let j = 0; j < 3; j++) {
      const a = wrong[j], b = wrong[(j+1)%3], key = edgeKey(a,b), edge = edges.get(key);
      edge.sign -= a < b ? 1 : -1;
      if (--edge.count === 3) for (const index of incident.get(key)) queue.push(index);
    }
  }

  // Paired walls inside closed solids have material on both sides. Keep a
  // freestanding two-sided sheet for the final audit instead of deleting it.
  for (const [back, front] of opposite) {
    if (removed.has(back) || removed.has(front)) continue;
    const f = faces[front];
    if (f.every((a,j) => {
      const edge = edges.get(edgeKey(a, f[(j+1)%3]));
      return edge.count >= 4 && edge.sign === 0;
    })) {
      removed.add(back);
      removed.add(front);
    }
  }
  return edges;
}

function planarPatches(faces, points, removed, edges, originalEdges) {
  const sets = disjointSets(faces.length);
  const normals = faces.map((f,i) => removed.has(i) ? null : faceNormal(f,points));
  for (const edge of edges.values()) {
    if (edge.count === 2 && edge.sign === 0 && dot(normals[edge.first],normals[edge.second]) > .999999)
      sets.join(edge.first,edge.second);
  }
  // Most of a detailed model is healthy. Materialize perimeter maps only
  // for patches that actually meet an ambiguous edge.
  const candidates = new Set();
  for (const [i, f] of faces.entries()) {
    if (!removed.has(i) && f.some((a,j)=>originalEdges.get(edgeKey(a,f[(j+1)%3])).count>2))
      candidates.add(sets.root(i));
  }
  const patches = new Map();
  for (const [i, f] of faces.entries()) {
    if (removed.has(i)) continue;
    const root = sets.root(i);
    if (!candidates.has(root)) continue;
    let patch = patches.get(root);
    if (!patch) { patch = {indices:[], border:new Map()}; patches.set(root,patch); }
    patch.indices.push(i);
    for (let j=0; j<3; j++) {
      const a=f[j], b=f[(j+1)%3], key=edgeKey(a,b);
      const sign=(patch.border.get(key) || 0) + (a<b ? 1 : -1);
      if (sign) patch.border.set(key,sign);
      else patch.border.delete(key);
    }
  }
  return patches;
}

// Choose a well-spaced triangle on the common rim. Both triangulations are
// tested against the same plane, independent of triangle size and input order.
function perimeterPlane(border, points) {
  const ids = new Set();
  for (const key of border.keys()) for (const n of key.split(',')) ids.add(Number(n));
  const rim = [...ids], first = rim[0], origin = points[first];
  let furthest = first, longest = 0;
  for (const id of rim) {
    const p = points[id], distance = Math.hypot(p[0]-origin[0],p[1]-origin[1],p[2]-origin[2]);
    if (distance > longest) { furthest = id; longest = distance; }
  }
  const u = points[furthest].map((x,k) => x-origin[k]);
  let normal = null, area = 0;
  for (const id of rim) {
    const v = points[id].map((x,k) => x-origin[k]);
    const cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const magnitude = Math.hypot(...cross);
    if (magnitude > area) { normal = cross.map(x=>x/magnitude); area=magnitude; }
  }
  return normal && {origin,normal};
}

// A raised panel can have exactly the same boundary as a flat cap. Check every
// interior vertex to STL coordinate precision; never use a distance to weld.
function liesOnPlane(patch, {origin,normal}, faces, points) {
  for (const i of patch.indices) for (const id of faces[i]) {
    const p = points[id];
    const distance = Math.abs((p[0]-origin[0])*normal[0]+(p[1]-origin[1])*normal[1]+(p[2]-origin[2])*normal[2]);
    const precision = normal.reduce((sum,c,k) => sum+Math.abs(c)*Math.max(Math.abs(p[k]),Math.abs(origin[k])),0) * 2**-22;
    if (distance > Math.max(precision, 2**-148)) return false;
  }
  return true;
}

function removeMatchingPatches(faces, points, removed, originalEdges) {
  const edges = removed.size ? meshEdges(faces,removed) : originalEdges;
  const patches = planarPatches(faces,points,removed,edges,originalEdges);
  const perimeters = new Map();
  for (const patch of patches.values()) {
    if (patch.border.size < 3) continue;
    const keys = [...patch.border.keys()].sort();
    if (!keys.every(k => Math.abs(patch.border.get(k)) === 1 && originalEdges.get(k).count >= 3)) continue;
    const orientation = patch.border.get(keys[0]);
    // All loops, including hole boundaries, must agree up to ONE reversal.
    const key = keys.map(k => (patch.border.get(k)===orientation ? '+' : '-')+k).join('|');
    if (!perimeters.has(key)) perimeters.set(key, []);
    perimeters.get(key).push({patch,orientation});
  }
  for (const peers of perimeters.values()) {
    if (peers.length < 2) continue;
    const plane = perimeterPlane(peers[0].patch.border,points);
    if (!plane) continue;
    const sides = new Map();
    for (const {patch,orientation} of peers) {
      if (!liesOnPlane(patch,plane,faces,points)) continue;
      if (sides.has(orientation)) {
        for (const i of patch.indices) removed.add(i);
      } else sides.set(orientation,patch);
    }
    if (sides.size === 2)
      for (const patch of sides.values()) for (const i of patch.indices) removed.add(i);
  }
}

function checkedRepair(meshes, options) {
  if (meshes.reduce((n,m) => n + m.triangles.length/3, 0) > STL_INSPECTION_MAX_TRIANGLES) return null;
  const {faces,points} = indexedFaces(meshes);
  const removed = new Set(), buckets = triangleBuckets(faces);
  const originalEdges = removeDuplicateTriangles(faces,buckets,removed);
  removeMatchingPatches(faces,points,removed,originalEdges);
  if (!removed.size || removed.size===faces.length) return null;
  const triangles=[], vertices=[], remap=new Map();
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for (const [i,f] of faces.entries()) {
    if (removed.has(i)) continue;
    for (const id of f) {
      if (!remap.has(id)) {
        remap.set(id,vertices.length/3);
        const p=points[id];
        vertices.push(...p);
        for (let k=0;k<3;k++) {
          min[k]=Math.min(min[k],p[k]);
          max[k]=Math.max(max[k],p[k]);
        }
      }
      triangles.push(remap.get(id));
    }
  }
  // Removing hidden faces must preserve the envelope of the input triangles.
  for (const i of removed) for (const id of faces[i]) {
    if (points[id].some((v,k)=>v<min[k]||v>max[k])) return null;
  }
  const mesh={id:meshes[0].id,vertices,triangles};
  const audit=inspectStlMesh(mesh,options);
  if (!audit.ok || !audit.complete) return null;
  if (meshes.length>1) mesh.sourceIds=meshes.map(m=>m.id);
  return {mesh,audit,removedFaces:removed.size};
}

// The repaired surface can span two selected material bodies. Only STL export
// calls this routine; model history, native geometry and independent bodies keep
// their original representation. Each emitted repair is itself a closed mesh.
export function repairStlOverlaps(outputs, rows, {onProgress, includeComponents=false}={}) {
  const byId=new Map(rows.map(row=>[row.id,row]));
  const replacements=new Map(), consumed=new Set();
  for (const group of contactGroups(outputs,byId)) {
    onProgress?.({stage:'重なった面を整理してSTLを再検査しています',bodyId:group[0].id});
    const checked=checkedRepair(group,{includeComponents});
    if (!checked) continue;
    replacements.set(group[0].id,checked.mesh);
    for (const m of group) {
      consumed.add(m.id);
      const original=byId.get(m.id);
      byId.set(m.id,{...original,...checked.audit,originalIssues:original.originalIssues?.length?original.originalIssues:original.issues,
        repaired:true,attempts:original.attempts+1,removedDegenerate:original.removedDegenerate||0,
        overlapRepair:{outputId:checked.mesh.id,removedFaces:checked.removedFaces,bodyCount:group.length}});
    }
  }
  return {outputs:outputs.flatMap(m=>replacements.has(m.id)?[replacements.get(m.id)]:consumed.has(m.id)?[]:[m]),rows:rows.map(r=>byId.get(r.id))};
}
