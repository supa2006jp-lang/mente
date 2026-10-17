import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {cadMesh} from '../src/cad-mesh.js';
import {retainCadCoordinates} from '../src/cad-coordinates.js';
import {bodyEdges} from '../src/body-edges.js';
import {solidVertexPoints,screenVertexCandidates} from '../src/vertex-points.js';
import {allMeshHits,screenEdgeCandidates,selectionCandidates} from '../src/selection-candidates.js';
import {selectionCandidateGroups} from '../src/selection-picker.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const body={...defaults,kind:'extrusion',id:'screw',name:'M10',profile:'circle',diameter:10,depth:12},spec={type:'thread',id:'thread',target:'screw',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,surfacePoint:[5,0,6]},thread=runOperation([body],spec).outputs[0];
const shape=R.deserializeShape(thread.brep).asShape3D(),hex=Array.from({length:6},(_,i)=>[9*Math.cos(i*Math.PI/3),9*Math.sin(i*Math.PI/3)]),head=R.draw(hex[0]).lineTo(hex[1]).lineTo(hex[2]).lineTo(hex[3]).lineTo(hex[4]).lineTo(hex[5]).close().sketchOnPlane('XY').extrude(-6);let screw;
try{
 screw=shape.fuse(head);const data=cadMesh(screw),faces=screw.faces;let planarFaces;try{planarFaces=faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode);}finally{faces.forEach(f=>f.delete());}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));geometry.setIndex(data.triangles);retainCadCoordinates(geometry,data.vertices);geometry.userData.faceGroups=data.faceGroups;geometry.userData.planarFaces=planarFaces;
 const edges=bodyEdges(geometry),points=solidVertexPoints(edges),arcEnds=new Set([...edges.userData.arcEdges.values()].flatMap(arc=>[arc.points[0],arc.points.at(-1)]).map(p=>p.map(v=>Math.round(v*1e4)).join(',')));
 assert.ok(arcEnds.size>200,'actual native thread reproduces many artificial arc ends');
 assert.ok(points.length<arcEnds.size*.2,`${points.length} vertices should be much fewer than ${arcEnds.size} arc ends`);
 for(const z of [-6,0])for(const p of hex)assert.ok(points.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-z)<1e-4),'actual hex-head corners remain selectable');
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.userData.bodyId='screw';mesh.add(new THREE.LineSegments(edges));mesh.updateMatrixWorld(true);
 const camera=new THREE.OrthographicCamera(-20,20,20,-20,.1,1000);camera.position.set(70,-100,65);camera.lookAt(0,0,3);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const p=new THREE.Vector3(0,-4,6).project(camera),x=(p.x+1)*400,y=(1-p.y)*400,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);
 const vertices=screenVertexCandidates([mesh],camera,800,800,x,y),edgeHits=screenEdgeCandidates([mesh],camera,800,800,x,y),hits=allMeshHits(ray,[mesh]),features=[body,{id:'thread',kind:'cadop',name:'M10ねじ',spec,outputs:[{id:'screw',...data,planarFaces,brep:screw.serialize()}],remove:[]}],options=selectionCandidates(hits,edgeHits,{vertices,features}),groups=selectionCandidateGroups(options);
 assert.ok(edgeHits.some(e=>e.curve?.points.length>100),'the thread flank offers a continuous curve, not short arc fits');assert.ok(options.filter(c=>c.kind==='edge').length<10,'continuous thread curves keep the edge list short');
 assert.ok(vertices.length<3,'the thread flank must not offer a row of fake corner points');assert.equal(options[0].kind,'face');assert.ok(groups.primary.some(c=>c.kind==='body'));assert.ok(groups.primary.length<=10);assert.deepEqual([...groups.primary,...groups.additional],options,'folding keeps all genuine candidates accessible');
 const denseOptions=selectionCandidates(hits,screenEdgeCandidates([mesh],camera,800,800,x,y,28),{vertices,features}),dense=selectionCandidateGroups(denseOptions);assert.ok(dense.additional.length>0,'dense edge alternatives are folded');assert.equal(dense.primary.length,8);assert.deepEqual([...dense.primary,...dense.additional],denseOptions);
 const pointsOnly=selectionCandidates(hits,edgeHits,{vertices,features,pointMode:true});assert.ok(pointsOnly.every(c=>['vertex','midpoint','faceCenter'].includes(c.kind)),'measurement point selection is preserved');
 await fs.writeFile('.sites-runtime/thread-selection-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[{id:'screw',kind:'cadop',name:'M10 六角頭付き',outputs:[{id:'screw',...data,planarFaces,cadCoordinatePrecision:true,brep:screw.serialize()}],remove:[]}]}));
 console.log(JSON.stringify({arcEnds:arcEnds.size,vertices:points.length,flankVertices:vertices.length,edgeCandidates:options.filter(c=>c.kind==='edge').length,continuousCurves:options.filter(c=>c.kind==='edge'&&c.hit.curve).length,primary:groups.primary.length,additional:groups.additional.length}));
 geometry.dispose();edges.dispose();mesh.material.dispose();
}finally{screw?.delete();head.delete();shape.delete();}
console.log('PASS native M10 thread arc joins are not vertices, hex corners remain, face/body priority, folded alternatives and measurement selection');
