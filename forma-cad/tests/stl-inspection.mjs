import assert from 'node:assert/strict';import * as THREE from 'three';import {inspectStlMesh,stlInspectionSummary} from '../src/stl-mesh-health.js';
const geometry=new THREE.BoxGeometry(20,20,20),box={vertices:Array.from(geometry.attributes.position.array),triangles:Array.from(geometry.index.array)};
assert(inspectStlMesh(box).ok);const missing={...box,triangles:box.triangles.slice(3)},gap=inspectStlMesh(missing);assert(!gap.ok);assert.equal(gap.counts.boundary,3);assert.equal(gap.segments.length,18);
assert(inspectStlMesh({...box,triangles:[...box.triangles,...box.triangles.slice(0,3)]}).counts.nonmanifold>0);assert(inspectStlMesh({...box,triangles:[...box.triangles,...box.triangles.slice(0,3)]}).counts.duplicate>0);
const reversed=[...box.triangles];[reversed[0],reversed[1]]=[reversed[1],reversed[0]];assert(inspectStlMesh({...box,triangles:reversed}).counts.orientation>0);
const inside=[...box.triangles];for(let i=0;i<inside.length;i+=3)[inside[i],inside[i+1]]=[inside[i+1],inside[i]];assert.equal(inspectStlMesh({...box,triangles:inside}).issues[0].code,'inverted');
const zero=inspectStlMesh({...box,triangles:[...box.triangles,0,0,1]});assert(zero.ok);assert.equal(zero.removedDegenerate,1);assert.deepEqual(zero.cleanTriangles,box.triangles);
assert.equal(inspectStlMesh({...box,vertices:[NaN,...box.vertices.slice(1)]}).issues[0].code,'invalid-coordinate');assert.equal(inspectStlMesh({...box,triangles:[-1,0,1]}).issues[0].code,'invalid-index');
assert.equal(inspectStlMesh({...box,vertices:box.vertices.map(v=>v*1e40)}).issues[0].code,'invalid-coordinate');assert(!inspectStlMesh(box,{maxTriangles:2}).complete);
// Preserve a very small real object; no tolerance welding or small-face removal.
assert(inspectStlMesh({...box,vertices:box.vertices.map(v=>v*1e-10)}).ok);
const expanded=[];for(const n of box.triangles)expanded.push(...box.vertices.slice(n*3,n*3+3));expanded[0]+=1e-5;const tinyGap=inspectStlMesh({vertices:expanded,triangles:Array.from({length:expanded.length/3},(_,i)=>i)});assert(!tinyGap.ok,'never weld a real gap closed');
const large=inspectStlMesh({...box,vertices:box.vertices.map((v,i)=>v+(i%3===0?1e9:0))});assert(!large.ok,'Float32 loss of a narrow part is not a successful export');
assert(!stlInspectionSummary([{id:'bad',...gap,repaired:false}]).ok);assert(stlInspectionSummary([{id:'a',...inspectStlMesh(box)},{id:'b',...inspectStlMesh(box)}]).ok,'two touching bodies remain independent');
assert(!stlInspectionSummary([]).ok);console.log('PASS STL Float32 topology, gaps, nonmanifold/duplicate faces, winding, exact cleanup, tiny geometry, limits and per-body isolation');
