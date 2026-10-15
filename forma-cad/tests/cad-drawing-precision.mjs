import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {cadMesh} from '../src/cad-mesh.js';
import {rebuild,validateProject} from '../src/geometry.js';
import {planarFace,basisFor,worldPoint} from '../src/frames.js';
import {cadPosition,copyCadCoordinates,restoreMeshCoordinates} from '../src/cad-coordinates.js';
import {createFilletGridReference} from '../src/fillet-grid-reference.js';
import {bodyEdges} from '../src/body-edges.js';
import {solidReferencePoints} from '../src/reference-points.js';
import {solidVertexPoints} from '../src/vertex-points.js';
import {createSketchBoundarySnap} from '../src/sketch-boundary-snap.js';
import {fuseSolid} from '../src/solid-fuse.js';
import {filletSolid} from '../src/solid-fillet.js';
import {runOperation,profileSketch} from '../src/kernel.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`),x=16.389193952608,y=-4.512345678901,z=74.123456789012,body=R.makeBox([x,y,0],[x+20,y+4,z]),native=cadMesh(body);
assert.ok(solidMeshComplete(body,native));
const project={format:'forma-cad',version:1,units:'mm',features:[{kind:'cadop',id:'seed',name:'seed',outputs:[{id:'body',...native,brep:body.serialize(),cadCoordinatePrecision:true,planarFaces:body.faces.map(f=>{const id=f.hashCode;f.delete();return id;})}],remove:[]}]};
validateProject(project);const saved=JSON.parse(JSON.stringify(project)),bodies=rebuild(saved.features),geometry=bodies.get('body').geometry,p=cadPosition(geometry),index=geometry.index;
assert.ok(geometry.attributes.position.array instanceof Float32Array);assert.ok(p.array instanceof Float64Array);
let front;
for(let i=0;i<index.count;i+=3){const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+j)));if(b.sub(a).cross(c.sub(a)).normalize().y<-.99){front=planarFace(geometry,i/3);break;}}
assert.ok(front);near(front.offset,-y);for(const point of front.outer){assert.ok(Math.min(Math.abs(point[0]-x),Math.abs(point[0]-x-20))<1e-10);assert.ok(Math.min(Math.abs(point[1]),Math.abs(point[1]-z))<1e-10);}
const edges=bodyEdges(geometry),refs=solidReferencePoints(geometry,edges),vertices=solidVertexPoints(edges);
assert.equal(vertices.length,8);for(const point of vertices)assert.ok(Math.min(Math.abs(point[0]-x),Math.abs(point[0]-x-20))<1e-10);
assert.ok(refs.some(r=>Math.abs(r.point[0]-x-10)<1e-10));
const mesh=new THREE.Mesh(geometry),basis=basisFor(front),snapper=createSketchBoundarySnap(),projectPoint=p=>({x:p.dot(basis.u)*10,y:p.dot(basis.v)*10});
for(const height of [0,z/2,z]){const point=snapper.snap([mesh],basis,-y,new THREE.Vector3(x+20+.2,y,height),projectPoint);assert.ok(point);near(point.x,x+20);near(point.y,y);near(point.z,height);}
// A face-based rectangle then joins exactly at the original plate's side.
const left=Math.min(...front.outer.map(p=>p[0])),right=Math.max(...front.outer.map(p=>p[0])),region={...front,outer:[[left,z-4],[right,z-4],[right,z],[left,z]],holes:[]},sketch=profileSketch(region),cap=sketch.extrude(15),joined=fuseSolid(body,cap),nativeEdges=joined.edges;
try{for(const edge of nativeEdges)if(edge.geomType==='LINE'){const a=edge.startPoint,b=edge.endPoint;try{assert.ok(new THREE.Vector3(...a.toTuple()).distanceTo(new THREE.Vector3(...b.toTuple()))>1e-6,'joined boundary must not have a microscopic tail');}finally{a.delete();b.delete();}}}finally{nativeEdges.forEach(e=>e.delete());}
for(const radius of [.2,2]){const result=filletSolid(joined,radius,{references:[{a:[x,y,z-4],point:[x+10,y,z-4],b:[x+20,y,z-4]}]});assert.equal(result.radius,radius);assert.equal(result.edgeCount,1);result.shape.delete();}
// Old saves recover native coordinates while keeping triangle indices intact.
const legacy=[{...saved.features[0],outputs:[{id:'body',...body.mesh({tolerance:.08,angularTolerance:.15}),brep:body.serialize()}]}],recovered=runOperation(legacy,{type:'drawingCoordinates',targets:['body']}).outputs[0];
assert.ok(recovered.vertices.some(v=>v===x));
const roundSpec={type:'fillet',id:'rounded',target:'body',radius:1},roundedHistory=[...legacy,{kind:'cadop',id:'rounded',name:'fillet',spec:roundSpec,...runOperation(legacy,roundSpec)}],source=runOperation(roundedHistory,{type:'drawingCoordinates',targets:[],sources:[{bodyId:'body',index:1}]}).sources[0];
legacy[0].outputs[0].vertices=restoreMeshCoordinates(legacy[0].outputs[0].vertices,source.vertices);
const originalOutline=createFilletGridReference(),reference=originalOutline.reference({...front,bodyId:'body'},roundedHistory);assert.ok(reference.filletGridReference);for(const point of reference.outer)assert.ok(Math.min(Math.abs(point[0]-x),Math.abs(point[0]-x-20))<1e-10);originalOutline.clear();
// QR conversion and rigid transforms preserve the precision attribute too.
const nonIndexed=copyCadCoordinates(geometry,geometry.toNonIndexed());assert.equal(cadPosition(nonIndexed).count,nonIndexed.attributes.position.count);nonIndexed.dispose();
const roundtrip=rebuild(JSON.parse(JSON.stringify(project)).features);near(cadPosition(roundtrip.get('body').geometry).getX(0),x);roundtrip.get('body').geometry.dispose();
edges.dispose();geometry.dispose();mesh.material.dispose();joined.delete();cap.delete();sketch.delete();body.delete();
console.log('PASS native mesh coordinates, face plane/outline, edge endpoints/centers, boundary sections, lossless save, legacy recovery and sliver-free join/fillet');
