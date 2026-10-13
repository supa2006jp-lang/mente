import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {filletSolid,resolveFilletEdges} from '../src/solid-fillet.js';
import {fuseSolids} from '../src/solid-fuse.js';
import {edgeFilletReferences} from '../src/edge-references.js';
import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function check(shape){const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(analyzer.IsValid());assert.ok(shape.mesh().triangles.length);}finally{analyzer.delete();}}
function rounded(shape,radius,references=[]){const result=filletSolid(shape,radius,{references});try{check(result.shape);assert.equal(result.radius,radius,'requested radius must never be silently reduced');return result;}finally{result.shape.delete();}}
const box=R.makeBox([0,0,0],[1000,10,10]),point=[501.95,0,10],edges=box.edges;let sampled=Infinity;
try{for(const edge of edges)for(let i=0;i<=128;i++){const p=edge.pointAt(i/128);try{sampled=Math.min(sampled,new THREE.Vector3(...p.toTuple()).distanceTo(new THREE.Vector3(...point)));}finally{p.delete();}}}finally{edges.forEach(e=>e.delete());}
assert.ok(sampled>1,'old 128-sample matching misses an exactly selected long edge');
rounded(box,.2,[{point}]);rounded(box,.5,[{point,a:[0,0,10],b:[1000,0,10]}]);
const cylinder=R.makeCylinder(120,10),angle=2*Math.PI*.12345,rimPoint=[120*Math.cos(angle),120*Math.sin(angle),10];rounded(cylinder,.2,[{point:rimPoint}]);
assert.throws(()=>filletSolid(cylinder,.2,{references:[{point:[120,0,5]}]}),error=>error.code==='fillet-smooth'&&!error.message.includes('半径を小さく'),'a cylindrical seam must not be reported as a radius error');
const all=filletSolid(cylinder,.5);try{check(all.shape);assert.equal(all.edgeCount,2,'whole-body fillet excludes the periodic seam');}finally{all.shape.delete();}
const parts=[0,10,20,30].map(x=>R.makeBox([x,0,0],[x+10,10,10])),joined=fuseSolids(parts),refs=[{point:[20,0,10],a:[0,0,10],b:[40,0,10]}],selected=resolveFilletEdges(joined,{references:refs});assert.equal(selected.length,4,'one displayed straight edge can contain four CAD fragments');selected.forEach(e=>e.delete());rounded(joined,.5,refs);
assert.throws(()=>filletSolid(joined,.2,{references:[{point:[10,5,10]}]}),error=>error.code==='fillet-smooth');
const small=R.makeBox([0,0,0],[10,10,2]),unchanged=small.serialize();assert.throws(()=>filletSolid(small,20),error=>error.code==='fillet-geometry');assert.equal(small.serialize(),unchanged,'failed retries preserve the original shape');
assert.throws(()=>filletSolid(small,-1),error=>error.code==='fillet-radius');assert.throws(()=>filletSolid(small,.2,{references:[{point:[200,200,200]}]}),error=>error.code==='fillet-selection');
const circle={points:Array.from({length:129},(_,i)=>[120*Math.cos(i/128*2*Math.PI),120*Math.sin(i/128*2*Math.PI),10])},circleRefs=edgeFilletReferences([{bodyId:'c',point:rimPoint,circle}]);assert.equal(circleRefs.length,128);rounded(cylinder,.2,circleRefs);
const features=[{kind:'cadop',id:'source',outputs:[{id:'long',brep:box.serialize()},{id:'round',brep:cylinder.serialize()}],remove:[]}],spec={id:'fillet',type:'fillet',target:'long',radius:.2,edges:[{bodyId:'long',point},{bodyId:'round',point:rimPoint}]},result=runOperation(features,spec);
assert.deepEqual(result.outputs.map(o=>o.id),['long','round']);assert.equal(result.analysis.fillets.length,2);assert.deepEqual(result.analysis.fillets.map(f=>f.radius),[.2,.2]);
const faceResult=runOperation(features,{id:'face-fillet',type:'fillet',target:'round',radius:.2,face:{plane:'XY',offset:10}});assert.equal(faceResult.analysis.fillets[0].edges,1);
for(const shape of [box,cylinder,joined,small,...parts])shape.delete();
console.log('PASS exact long/curved edge matching, straight fragments, complete circles, periodic and coplanar seams, same-radius topology retry, input preservation, distinct failures, multiple bodies and face-plane selection');
