// Run coil-joint-browser.mjs first to generate the dense joint fixture, or pass a saved fixture path.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {accelerateMeshPicking} from '../src/mesh-picking.js';
import {rangeFaceHits,rangeCrossingBodyIds} from '../src/box-selection.js';
import {cadFaceGroup} from '../src/face-selection.js';
const project=JSON.parse(await fs.readFile(process.argv[2]||'.sites-runtime/coil-selection.json','utf8')),outputs=project.features.at(-1).outputs;
const meshes=outputs.map(o=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);g.userData.faceGroups=o.faceGroups;g.userData.planarFaces=o.planarFaces;const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.userData.bodyId=o.id;return m;});
const bounds=meshes.reduce((b,m)=>b.union(new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position)),new THREE.Box3()),center=bounds.getCenter(new THREE.Vector3()),span=bounds.getSize(new THREE.Vector3()).length()*1.2,camera=new THREE.OrthographicCamera(-span/2,span/2,span/2,-span/2,.1,10000);camera.position.copy(center).add(new THREE.Vector3(110,-150,120));camera.lookAt(center);camera.updateMatrixWorld();
const rays=Array.from({length:13},(_,i)=>{const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2((i%4-1.5)*.11,(Math.floor(i/4)-1)*.13),camera);return r;}),indices=meshes.map(m=>Array.from(m.geometry.index.array)),baseline=rays.map(r=>r.intersectObjects(meshes,false).map(h=>({id:h.object.userData.bodyId,index:h.faceIndex,distance:h.distance})));
meshes.forEach(accelerateMeshPicking);meshes.forEach((m,i)=>assert.deepEqual(Array.from(m.geometry.index.array),indices[i]));
for(const [i,r] of rays.entries()){const actual=r.intersectObjects(meshes,false);assert.equal(actual.length,baseline[i].length);actual.forEach((h,j)=>{assert.equal(h.object.userData.bodyId,baseline[i][j].id);assert.equal(h.faceIndex,baseline[i][j].index);assert.ok(Math.abs(h.distance-baseline[i][j].distance)<1e-6);});}
const full={left:0,right:1000,top:0,bottom:1000,crossing:false},cross={left:450,right:650,top:350,bottom:650,crossing:true};
for(const [name,fn] of [['all faces',()=>rangeFaceHits(project.features,meshes,camera,1000,1000,full)],['crossing faces',()=>rangeFaceHits(project.features,meshes,camera,1000,1000,cross)],['crossing bodies',()=>rangeCrossingBodyIds(meshes,camera,1000,1000,cross)]]){const start=performance.now(),hits=fn(),ms=performance.now()-start;assert.ok(hits.length>0);assert.ok(ms<3000,name+': '+ms);if(name==='all faces')assert.equal(hits.length,outputs.reduce((n,o)=>n+o.faceGroups.length,0));if(name.includes('faces'))for(const h of hits)assert.ok(cadFaceGroup(h.object.geometry,h.faceIndex));console.log(name,Math.round(ms)+' ms',hits.length+' selected');}
console.log('Triangle count',outputs.reduce((n,o)=>n+o.triangles.length/3,0));meshes.forEach(m=>{m.geometry.dispose();assert.equal(m.geometry.boundsTree,null);});console.log('PASS CAD triangle IDs, all ray intersections, dense helix range response, face metadata and disposal');
