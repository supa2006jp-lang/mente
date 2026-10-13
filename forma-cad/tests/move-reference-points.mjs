import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bodyEdges} from '../src/body-edges.js';
import {solidReferencePoints} from '../src/reference-points.js';
import {moveBodyPointReferences} from '../src/move-reference-points.js';
import {defaults,rebuild} from '../src/geometry.js';
import {featureCircularEdges} from '../src/circular-edges.js';
function body(geometry){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()),edges=bodyEdges(geometry);mesh.add(new THREE.LineSegments(edges));mesh.userData.references=solidReferencePoints(geometry,edges);return mesh;}
const cylinder=body(new THREE.CylinderGeometry(20,20,10,96)),circleRefs=moveBodyPointReferences(cylinder);
assert.equal(circleRefs.filter(r=>r.kind==='vertex').length,0,'closed rims have no sampled vertex targets');
assert.equal(circleRefs.length,2,'only the two circular cap centers remain');
const shape=new THREE.Shape();shape.moveTo(20,0);shape.absarc(0,0,20,0,Math.PI,false);shape.closePath();
const half=body(new THREE.ExtrudeGeometry(shape,{depth:15,bevelEnabled:false,curveSegments:64})),halfRefs=moveBodyPointReferences(half),vertices=halfRefs.filter(r=>r.kind==='vertex');
assert.equal(vertices.length,4,'a half cylinder keeps its four actual cut corners');
for(const ref of vertices){assert.ok(Math.abs(Math.abs(ref.point[0])-20)<1e-4);assert.ok(Math.abs(ref.point[1])<1e-4);assert.ok(Math.abs(ref.point[2])<1e-4||Math.abs(ref.point[2]-15)<1e-4);}
assert.ok(halfRefs.some(r=>r.kind==='center'&&Math.hypot(r.point[0],r.point[1])<1e-4),'cut arc center remains selectable');
assert.ok(halfRefs.length<20,'a densely tessellated rim has only geometric reference targets');
const box=body(new THREE.BoxGeometry(20,20,10));assert.equal(moveBodyPointReferences(box).filter(r=>r.kind==='vertex').length,8,'straight corners are retained');
const stepped=body(rebuild([{...defaults,id:'c',kind:'extrusion',profile:'circle',diameter:40,depth:30},{...defaults,id:'cut',kind:'extrusion',profile:'rect',width:40,height:60,depth:25,x:20,z:10,operation:'cut',target:'c'}]).get('c').geometry),stepRefs=moveBodyPointReferences(stepped);
assert.equal(stepRefs.filter(r=>r.kind==='vertex').length,4,'the stepped cylinder keeps only four cut corners');
for(const ref of stepRefs.filter(r=>r.kind==='vertex'))assert.ok(Math.abs(ref.point[0])<1e-4&&Math.abs(Math.abs(ref.point[1])-20)<1e-4,'no arc subdivision is offered as a corner');
for(const ref of stepRefs)if(Math.abs(Math.hypot(ref.point[0],ref.point[1])-20)<1e-3)assert.ok(Math.abs(ref.point[0])<1e-4,'points on the stepped circular rim are actual cut endpoints');
stepped.children[0].geometry.userData.circularEdges=featureCircularEdges([{...defaults,id:'c',profile:'circle',diameter:40,depth:30}],'c',stepped.children[0].geometry);
assert.equal(moveBodyPointReferences(stepped).filter(r=>r.kind==='vertex').length,4,'restored full-rim metadata does not expose a vertical tessellation seam endpoint');
half.position.set(40,25,5);half.rotation.z=Math.PI/2;half.updateMatrixWorld(true);const moved=moveBodyPointReferences(half).filter(r=>r.kind==='vertex');
for(const ref of moved){assert.equal(ref.owner,half.uuid);assert.ok(Math.abs(ref.point[0]-40)<1e-4);assert.ok(Math.abs(Math.abs(ref.point[1]-25)-20)<1e-4);}
const duplicate=new Set(halfRefs.map(r=>r.point.map(v=>v.toFixed(4)).join(',')));assert.equal(duplicate.size,halfRefs.length,'coincident face/arc centers are not duplicated');
for(const mesh of [cylinder,half,box,stepped]){mesh.geometry.dispose();mesh.children[0].geometry.dispose();}
console.log('PASS full/partial circular rims exclude tessellation points, real arc endpoints and centers remain, straight corners, deduplication and moved previews');
