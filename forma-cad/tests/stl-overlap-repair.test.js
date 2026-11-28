import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savedBodyMeshes} from '../src/cad-output-mesh.js';
import {createPreciseStl} from '../src/stl-export-mesh.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';
import {binaryStlReport} from './stl-topology.mjs';

function block(id, x, y=0, flip=false) {
  const vertices = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
    .flatMap(([a,b,c]) => [a+x,b+y,c]);
  const quads = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
  const triangles = quads.flatMap(([a,b,c,d]) => flip ? [a,b,d,b,c,d] : [a,b,c,a,c,d]);
  return {id,vertices,triangles};
}
function combine(id, meshes) {
  const vertices=[], triangles=[];
  for (const mesh of meshes) {
    const start=vertices.length/3;
    vertices.push(...mesh.vertices);
    triangles.push(...mesh.triangles.map(i=>i+start));
  }
  return {id,vertices,triangles};
}
const print = bodies => savedBodyMeshes({type:'stlMeshes',repairOverlaps:true,bodies});
const inspect = body => inspectStlMesh(body);
const shell = (body,volume) => {
  const r=inspect(body);
  assert.equal(r.ok,true,JSON.stringify(r.issues));
  assert.ok(Math.abs(r.volume-volume) < Math.max(1e-10,volume*1e-6), 'material volume');
};

test('coincident exterior triangles are removed, including a reversed copy',()=>{
  for(const reversed of [false,true]){
    const box=block('box',0);
    const extra=box.triangles.slice(0,6);
    if(reversed)extra.reverse();
    box.triangles.unshift(...extra);
    box.triangles.push(0,0,1);
    const before=structuredClone(box),r=print([box]);
    assert.equal(r.inspection.repairedBodies,1);
    assert.equal(r.inspection.removedDegenerate,1);
    assert.equal(r.inspection.rows[0].overlapRepair.removedFaces,2);
    shell(r.outputs[0],1);
    assert.deepEqual(box,before);
  }
});
test('opposite internal walls match by perimeter with either triangulation',()=>{
  for (const alternate of [false,true]){
    const mesh=combine('block',[block('a',0),block('b',1,0,alternate)]);
    assert.equal(inspect(mesh).ok,false);
    const r=print([mesh]);
    assert.equal(r.inspection.ok,true);
    assert.equal(r.inspection.rows[0].overlapRepair.removedFaces,4);
    shell(r.outputs[0],2);
  }
});
test('a different triangulation with an extra interior vertex can be repaired',()=>{
  const a=block('a',0),b=block('b',1);
  b.vertices.push(1,.5,.5);
  b.triangles.splice(24,6,0,4,8,4,7,8,7,3,8,3,0,8);
  const r=print([combine('two',[a,b])]);
  assert.equal(r.inspection.ok,true);
  assert.equal(r.inspection.rows[0].overlapRepair.removedFaces,6);
  shell(r.outputs[0],2);
});
test('same-direction copies of an exterior panel match across different diagonals',()=>{
  const a=block('panel',0), other=block('panel',0,0,true);
  a.triangles.push(...other.triangles.slice(0,6));
  const r=print([a]);
  assert.equal(r.inspection.removedOverlapFaces,2);
  shell(r.outputs[0],1);
});
test('two surfaces that share a perimeter but enclose a recess are preserved',()=>{
  const a=block('a',0),b=block('b',1);
  b.vertices.push(1.03,.5,.5);
  b.triangles.splice(24,6,0,4,8,4,7,8,7,3,8,3,0,8);
  const input=combine('recess',[a,b]),before=structuredClone(input),r=print([input]);
  assert.equal(r.inspection.ok,false);
  assert.equal(r.inspection.removedOverlapFaces,0);
  assert.deepEqual(r.outputs[0],before);
});
test('a coloured checkerboard is closed only in the selected assembly',async()=>{
  const a=combine('light',[block('a',0),block('b',1,1)]);
  const b=combine('shade',[block('c',1),block('d',0,1)]);
  const far=block('separate',5);
  const input=[a,b,far], snapshot=structuredClone(input);
  assert.equal(print([a]).inspection.ok,false,'only an edge touches when the other material is hidden');
  const r=print(input);
  assert.equal(r.inspection.checkedBodies,3);
  assert.equal(r.inspection.repairedBodies,2);
  assert.equal(r.inspection.removedOverlapFaces,16,'count shared walls only once in the UI');
  assert.deepEqual(r.outputs.find(o=>o.id==='separate'),far);
  const repaired=r.outputs.find(o=>o.sourceIds);
  assert.deepEqual(repaired.sourceIds.sort(),['light','shade']);
  shell(repaired,4);
  const bytes=await createPreciseStl(input,async(_,spec)=>savedBodyMeshes(spec));
  const wrong={...r,outputs:r.outputs.map(o=>o.sourceIds?{...o,sourceIds:['light','light']}:o)};
  await assert.rejects(()=>createPreciseStl(input,async()=>wrong),{code:'stl-inspection'});
  const stl=binaryStlReport(bytes);
  for(const key of ['nonmanifold','boundary','orientation','degenerate'])assert.equal(stl[key],0);
  assert.ok(Math.abs(stl.volume-5)<1e-8);
  assert.deepEqual(input,snapshot);
});
test('a tiny real gap, a through-opening, and disjoint shells retain their geometry',()=>{
  const ring=[];
  for(let x=0; x<3; x++) for(let y=0; y<3; y++) if(x!==1||y!==1) ring.push(block('tile',x,y,(x+y)%2===0));
  const mesh=combine('frame',[...ring,block('gap',3.0001)]);
  const r=print([mesh]);
  assert.equal(r.inspection.ok,true);
  shell(r.outputs[0],9);
  const result=inspectStlMesh(r.outputs[0],{includeComponents:true});
  assert.equal(result.components.length,2);
  assert.ok(Math.abs(result.components[0].volume-8)<1e-8);
});
test('open surfaces and edge-only contact stay visible in the failure report',async()=>{
  const missing=block('open',0); missing.triangles.splice(0,3);
  missing.triangles.push(...missing.triangles.slice(0,3));
  const edgeOnly=combine('edge',[block('a',4),block('b',5,1)]);
  const r=print([edgeOnly,missing]);
  assert.equal(r.inspection.ok,false);
  assert.ok(r.inspection.rows.find(row=>row.id==='open').counts.boundary>0);
  await assert.rejects(()=>createPreciseStl([edgeOnly,missing],async()=>r),{code:'stl-inspection'});
});
test('healthy results and diagnostic-only calls keep original body boundaries',()=>{
  const a=block('a',0), b=block('b',1);
  assert.deepEqual(print([a,b]).outputs,[a,b]);
  const overlap=combine('both',[a,b]);
  assert.equal(savedBodyMeshes({type:'stlMeshes',bodies:[overlap],includeComponents:true}).inspection.ok,false);
});
