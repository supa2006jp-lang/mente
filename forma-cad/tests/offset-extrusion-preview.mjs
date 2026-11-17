import assert from 'node:assert/strict';
import * as THREE from 'three';
import {basisFor,worldPoint} from '../src/frames.js';
import {offsetExtrusionOutlinePaths,createOffsetExtrusionPreview} from '../src/offset-extrusion-preview.js';
const outer=[[-20,-10],[20,-10],[20,10],[-20,10]];
for(const plane of ['XY','XZ','YZ','CUSTOM']){
 const region={id:'r',plane,offset:7,outer,holes:[],...(plane==='CUSTOM'?{frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}:{})};
 for(const distance of [-2,0,2]){
  const paths=offsetExtrusionOutlinePaths([region],distance),basis=basisFor(region);
  assert.deepEqual(paths.source[0],outer.map(p=>worldPoint(region,p).toArray()));
  const u=paths.offset.flat().map(p=>new THREE.Vector3(...p).dot(basis.u)),v=paths.offset.flat().map(p=>new THREE.Vector3(...p).dot(basis.v));
  assert(Math.abs(Math.max(...u)-Math.min(...u)-(40+2*distance))<1e-6);assert(Math.abs(Math.max(...v)-Math.min(...v)-(20+2*distance))<1e-6);
  for(const point of paths.offset.flat())assert(Math.abs(new THREE.Vector3(...point).dot(basis.n)-7)<1e-6);
 }
}
const region={id:'r',plane:'XY',offset:0,outer,holes:[[[-4,-3],[-4,3],[4,3],[4,-3]]]};
const hole=offsetExtrusionOutlinePaths([region],1);assert.equal(hole.offset.length,2);assert.equal(hole.source.length,2);
const scene=new THREE.Scene(),host={dataset:{}},canvas={clientWidth:800,clientHeight:600},preview=createOffsetExtrusionPreview({scene,host,canvas});
preview.show([region],1);assert.equal(preview.objects.length,4);assert.equal(preview.objects[0].material.dashed,true);assert.equal(preview.objects[2].material.dashed,false);
assert(preview.objects.every(line=>line.material.depthTest===false&&line.material.depthWrite===false));
canvas.clientWidth=500;preview.update();assert.equal(preview.objects[0].material.resolution.x,500);
let disposed=0;for(const line of preview.objects)line.geometry.addEventListener('dispose',()=>disposed++);
preview.show([region],-1);assert.equal(disposed,4);assert.equal(JSON.parse(host.dataset.offsetExtrusionPreview).distance,-1);
preview.clear();assert.equal(preview.objects.length,0);assert.equal(host.dataset.offsetExtrusionPreview,undefined);assert.equal(scene.children[0].visible,false);
assert.throws(()=>preview.show([{...region,holes:[]}],-11),/領域/);assert.equal(preview.objects.length,0);
console.log('PASS OS guide distance, all planes, holes, line styles, pixel width, invalid contour guard and preview disposal');
