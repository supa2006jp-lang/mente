import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {before, test} from 'node:test';
import {BoxGeometry,ShapeUtils,Vector2} from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {analyzeStl,readStl} from '../src/stl-import-mesh.js';
import {inspectStlImport,simplifyStlImport,convertStlImport} from '../src/stl-import.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';

before(async () => {
 const wasmBinary = await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
 R.setOC(await init({wasmBinary}));
});

function box(size, x = 0) {
 const geometry = new BoxGeometry(size,size,size).translate(x,0,0);
 const {index,attributes:{position}} = geometry;
 const faces = [];
 for (let i = 0; i < index.count; i += 3) {
  faces.push([0,1,2].flatMap(j => {
   const v = index.getX(i+j);
   return [position.getX(v),position.getY(v),position.getZ(v)];
  }));
 }
 geometry.dispose();
 return faces;
}

const flip = face => [...face.slice(0,3),...face.slice(6),...face.slice(3,6)];
function binary(faces) {
 const data = new ArrayBuffer(84+50*faces.length), view = new DataView(data);
 new Uint8Array(data).set(new TextEncoder().encode('solid Binary header'));
 view.setUint32(80,faces.length,true);
 faces.forEach((face,i) => face.forEach((coordinate,j) => view.setFloat32(96+i*50+j*4,coordinate,true)));
 return data;
}
function ascii(faces) {
 const facets = faces.map(face => {
  const vertices = [0,3,6].map(i => 'vertex '+face.slice(i,i+3).join(' '));
  return ['facet normal 0 0 0','outer loop',...vertices,'endloop','endfacet'].join('\n');
 });
 return new TextEncoder().encode(['solid box',...facets,'endsolid box'].join('\n')).buffer;
}

const importModel = data => {
 const analysis = analyzeStl(readStl(data));
 if (!analysis.shells) return analysis;
 const session = inspectStlImport({data,id:'source'});
 const parts = session.preview.parts.map(part => ({part:part.id,repairs:part.repairs.map(fix => fix.id)}));
 return {...analysis,...convertStlImport(session,{id:'import',session:session.id,parts})};
};
function checkSolid(body, volume, tolerance = 1e-8) {
 assert.ok(inspectStlMesh(body).ok);
 const solid = R.deserializeShape(body.brep).asShape3D();
 try {assert.ok(Math.abs(R.measureVolume(solid)-volume) < tolerance);}
 finally {solid.delete();}
}

test('binary and ASCII STL preserve dimensions and produce editable planar CAD faces', () => {
 for (const encode of [binary,ascii]) {
  const result = importModel(encode(box(2,37)));
  assert.equal(result.repair,null);
  const [body] = result.outputs;
  assert.equal(body.planarFaces.length,6);
  const x = body.vertices.filter((_,i) => i%3 === 0);
  assert.equal(Math.min(...x),36);
  assert.equal(Math.max(...x),38);
  checkSolid(body,8);
 }
});

test('STL reports a winding error, duplicate, degenerate face and small planar hole with a repair candidate', () => {
 const faces = box(2).slice(2);
 const input = [flip(faces[0]),...faces.slice(1),faces[1],Array(9).fill(0)];
 const result = importModel(binary(input));
 assert.equal(result.counts.boundary,4);
 assert.ok(result.counts.orientation);
 assert.ok(result.segments.length);
 assert.equal(result.repair.filledFaces,2);
 assert.equal(result.repair.duplicate,1);
 assert.equal(result.repair.degenerate,1);
 assert.equal(result.repair.flippedFaces,1);
 checkSolid(result.outputs[0],8);
});

test('STL retains a nested void and imports a separate component as another body', () => {
 const result = importModel(binary([...box(10),...box(2).map(flip),...box(2,20)]));
 assert.equal(result.repair,null);
 assert.equal(result.outputs.length,2);
 checkSolid(result.outputs[0],992);
 checkSolid(result.outputs[1],8);
});

test('STL refuses ambiguous or large repairs and reports the relevant geometry', () => {
 const open = importModel(binary(box(20).slice(2)));
 assert.equal(open.outputs,undefined);
 assert.equal(open.counts.boundary,4);
 assert.ok(open.segments.length);
 const overlap = importModel(binary([...box(2),...box(2,1)]));
 assert.equal(overlap.outputs,undefined);
 assert.equal(overlap.counts.intersection,1);
 assert.ok(overlap.segments.length);
 const touch = importModel(binary([...box(2),...box(2,2).map(face => face.map((v,i) => i%3===0?v:v+2))]));
 assert.equal(touch.outputs,undefined);
 assert.equal(touch.counts.vertex,1);
 assert.throws(() => importModel(new TextEncoder().encode('bad STL').buffer),/読み込めません/);
});

const inspect = faces => inspectStlImport({data:binary(faces),id:'session'});
const convert = (session,parts) => convertStlImport(session,{id:'result',session:session.id,parts});

test('choose good parts without silently closing holes in an unselected part', () => {
 const session = inspect([...box(2).slice(4),...box(3,20)]);
 const [open,closed] = session.preview.parts;
 assert.equal(open.repairs.filter(fix => fix.type==='hole').length,2);
 assert.ok(open.repairs.every(fix => fix.segments.length));
 assert.throws(() => convert(session,[{part:open.id,repairs:[open.repairs[0].id]}]),/修正候補/);
 checkSolid(convert(session,[{part:closed.id}]).outputs[0],27);
 const fixed = convert(session,[{part:open.id,repairs:open.repairs.map(fix => fix.id)}]);
 checkSolid(fixed.outputs[0],8);
});

test('part selection keeps a cavity with its enclosing body', () => {
 const session = inspect([...box(10),...box(2).map(flip),...box(2,20)]);
 assert.equal(session.preview.parts.length,2);
 assert.equal(session.preview.parts[0].triangles,24);
 checkSolid(convert(session,[{part:1}]).outputs[0],992);
});

function prismaticMesh(outer,hole,angle=0) {
 const loops = hole ? [outer,hole] : [outer];
 const points = loops.flat();
 const height = 5, faces = [];
 const transform = ([x,y,z]) => [x+21,y*Math.cos(angle)-z*Math.sin(angle)+11,y*Math.sin(angle)+z*Math.cos(angle)-13];
 const triangle = (...coords) => faces.push(coords.flatMap(transform));
 const cap = ShapeUtils.triangulateShape(outer.map(p=>new Vector2(...p)),hole ? [hole.map(p=>new Vector2(...p))] : []);
 for (const [a,b,c] of cap) {
  triangle([...points[c],0],[...points[b],0],[...points[a],0]);
  triangle([...points[a],height],[...points[b],height],[...points[c],height]);
 }
 for (const loop of loops) for (const [i,p] of loop.entries()) {
  const q = loop[(i+1)%loop.length];
  triangle([...p,0],[...q,0],[...q,height]);
  triangle([...p,0],[...q,height],[...p,height]);
 }
 return faces;
}

const circle = (radius,n,direction=1) => Array.from({length:n},(_,i) => [
 radius*Math.cos(direction*2*Math.PI*i/n),radius*Math.sin(direction*2*Math.PI*i/n)
]);

test('a rotated cylinder and a through-hole convert into analytic cylindrical faces on request', () => {
 const cylinder = inspect(prismaticMesh(circle(5,32),null,.61));
 const ring = inspect(prismaticMesh([[-8,-8],[8,-8],[8,8],[-8,8]],circle(3,32,-1),.61));
 for (const [session,kind,radius,volume] of [
  [cylinder,'cylinder',5,Math.PI*25*5],[ring,'hole',3,(256-Math.PI*9)*5]
 ]) {
  const [candidate] = session.preview.parts[0].circles;
  assert.equal(candidate.kind,kind);
  assert.ok(Math.abs(candidate.radius-radius)<1e-5);
  assert.ok(candidate.deviation >= radius*(1-Math.cos(Math.PI/32)));
  const exact = convert(session,[{part:1,circles:[candidate.id]}]).outputs[0];
  const shape = R.deserializeShape(exact.brep).asShape3D(), faces = shape.faces;
  try {
   assert.equal(faces.filter(face=>face.geomType==='CYLINDRE').length,1);
   assert.ok(Math.abs(R.measureVolume(shape)-volume)<.002);
  } finally {faces.forEach(face=>face.delete()); shape.delete();}
 }
});

test('a heavily tessellated part can be inspected, reduced and selected for conversion', async () => {
 const fine = new BoxGeometry(2,2,2,42,42,42), {index,attributes:{position}} = fine;
 const dense = [];
 for (let i=0; i<index.count; i+=3) dense.push([0,1,2].flatMap(j => {
  const v=index.getX(i+j); return [position.getX(v),position.getY(v),position.getZ(v)];
 }));
 fine.dispose();
 const session = inspect([...dense,...box(2,10)]);
 assert.ok(session.preview.parts[0].triangles > session.preview.maxTriangles);
 assert.throws(() => convert(session,[{part:1}]),/簡略化/);
 checkSolid(convert(session,[{part:2}]).outputs[0],8);
 const reduction = await simplifyStlImport(session,{part:1,id:'candidate',percentage:25,maxDeviation:.005});
 assert.ok(reduction.after < reduction.before && reduction.after < session.preview.maxTriangles);
 assert.ok(reduction.deviation < 1e-6);
 checkSolid(convert(session,[{part:1,simplification:reduction.id}]).outputs[0],8);
});

test('independently selectable STL parts may be converted alone when their meshes intersect', () => {
 const session = inspect([...box(2),...box(2,1)]);
 assert.equal(session.preview.parts.length,2);
 assert.throws(() => convert(session,[{part:1},{part:2}]),/面が交差/);
 checkSolid(convert(session,[{part:2}]).outputs[0],8);
});

function lathe(profile,angle=0) {
 const facets = 48, faces = [];
 const point = ([radius,z],i) => {
  const theta=(i%facets)*2*Math.PI/facets, x=radius*Math.cos(theta), y=radius*Math.sin(theta);
  return [x+10,y*Math.cos(angle)-z*Math.sin(angle),y*Math.sin(angle)+z*Math.cos(angle)];
 };
 for (const [j,a] of profile.entries()) {
  const b=profile[(j+1)%profile.length];
  for (let i=0;i<facets;i++) {
   if (a[0]>0) faces.push([...point(a,i),...point(a,i+1),...point(b,i+1)]);
   if (b[0]>0) faces.push([...point(a,i),...point(b,i+1),...point(b,i)]);
  }
 }
 return faces;
}

test('blind holes, counterbores and stepped cylinders restore selected bands only', () => {
 const shapes = [
  {kind:'blind',bands:1,profile:[[0,0],[8,0],[8,10],[3,10],[3,4],[0,4]],volume:Math.PI*(640-9*6)},
  {kind:'counterbore',bands:2,profile:[[2,0],[8,0],[8,10],[4,10],[4,7],[2,7]],volume:Math.PI*(640-16*3-4*7)},
  {kind:'stepped',bands:2,profile:[[0,0],[8,0],[8,3],[5,3],[5,8],[0,8]],volume:Math.PI*(64*3+25*5)}
 ];
 for (const {kind,bands,profile,volume} of shapes) {
  const session = inspect(lathe(profile,.38)), [part] = session.preview.parts;
  const candidate = part.circles.find(circle=>circle.kind===kind);
  assert.ok(candidate,kind+' '+JSON.stringify(part.circles.map(circle=>circle.kind)));
  assert.equal(candidate.steps.length,bands);
  const circles = part.circles.map(circle=>circle.id);
  const result = convert(session,[{part:1,circles}]).outputs[0];
  checkSolid(result,volume,0.004);
  const partial = convert(session,[{part:1,circles:[candidate.id]}]).outputs[0];
  const shape = R.deserializeShape(partial.brep).asShape3D(), faces=shape.faces;
  try {assert.equal(faces.filter(face=>face.geomType==='CYLINDRE').length,bands);}
  finally {faces.forEach(face=>face.delete());shape.delete();}
 }
});

test('STL preview compares actual print geometry and flags a small separate output', () => {
 const session = inspect([...lathe([[0,0],[8,0],[8,3],[0,3]]),...box(1,31)]);
 const circle = session.preview.parts[0].circles[0];
 const {reviews} = convertStlImport(session,{session:session.id,id:'preview',review:true,parts:[{part:1,circles:[circle.id]},{part:2}]});
 assert.ok(reviews.every(review=>review.print.ok));
 assert.ok(reviews[0].difference.before.maximum>.005);
 assert.ok(reviews[0].difference.after.maximum>.005);
 assert.equal(reviews[0].difference.before.values.length,session.preview.parts[0].mesh.triangles.length/3);
 assert.equal(reviews[0].difference.after.values.length,reviews[0].difference.mesh.triangles.length/3);
 assert.equal(reviews[1].print.pieces.length,1);
 assert.ok(reviews[1].difference.after.maximum<1e-7);
});

test('STL export topology distinguishes disconnected outer pieces from cavities', () => {
 const asMesh = faces => ({vertices:faces.flat(),triangles:faces.flatMap((_,i)=>[i*3,i*3+1,i*3+2])});
 const audit = inspectStlMesh(asMesh([...box(10),...box(2).map(flip),...box(1,20)]),{includeComponents:true});
 assert.ok(audit.ok);
 assert.equal(audit.components.length,2);
 assert.ok(Math.abs(audit.components[0].volume-1000)<1e-8);
 assert.ok(Math.abs(audit.components[1].volume-1)<1e-8);
 const open = inspectStlMesh(asMesh(box(2).slice(2)),{includeComponents:true});
 assert.equal(open.counts.boundary,4);
 assert.ok(open.segments.length);
 assert.equal(open.components,undefined);
});
