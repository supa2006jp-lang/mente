import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sketchSolidOverlapRegions} from '../src/sketch-solid-overlap.js';
import {defaults,makeGeometry} from '../src/geometry.js';
import {basisFor,worldPoint} from '../src/frames.js';
import {regionContains} from '../src/regions.js';
import {reverseExtrusionFrame} from '../src/extrusion-direction.js';
import {regionExtrusions} from '../src/region-extrusions.js';
const base={...defaults,id:'cylinder',kind:'extrusion',profile:'circle',diameter:20,depth:10};
for(const plane of ['XY','XZ','YZ']){
 const n=basisFor({plane}).n,mesh=new THREE.Mesh(makeGeometry({...base,plane}),new THREE.MeshBasicMaterial());mesh.userData.bodyId=base.id;
 for(const offset of [0,5,10]){
  const r={id:'triangle',plane,offset,outer:[[0,0],[30,0],[30,30]],holes:[],area:450,sourceIds:['sketch']};
  const parts=sketchSolidOverlapRegions([r],[mesh]);assert.equal(parts.length,1);
  const p=parts[0];assert.ok(Math.abs(p.area-Math.PI*100/8)<.1);assert.ok(regionContains(p,[5,2]));assert.ok(!regionContains(p,[12,2]));assert.deepEqual(p.overlapTargets,['cylinder']);
  assert.deepEqual(p.overlapSource,r);assert.deepEqual(r.outer,[[0,0],[30,0],[30,30]]);
  p.overlapPoint=worldPoint(p,[5,2]).toArray();
  const reverse=reverseExtrusionFrame({...defaults,profile:'region',plane,region:p});
  assert.ok(worldPoint(reverse.region.overlapSource,reverse.region.overlapSource.outer[1]).distanceTo(worldPoint(r,r.outer.at(-2)))<1e-6);
  assert.deepEqual(reverse.region.overlapPoint,p.overlapPoint);
  assert.equal(regionExtrusions({...defaults,kind:'extrusion'},[p])[0].overlapOnly,true);
 }
 mesh.visible=false;assert.equal(sketchSolidOverlapRegions([{id:'r',plane,offset:10,outer:[[0,0],[30,0],[30,30]],holes:[],area:450}],[mesh]).length,0);
 mesh.geometry.dispose();mesh.material.dispose();
}
{const shape=new THREE.Shape([new THREE.Vector2(-10,-10),new THREE.Vector2(10,-10),new THREE.Vector2(10,10),new THREE.Vector2(-10,10)]);shape.holes.push(new THREE.Path([new THREE.Vector2(-2,-2),new THREE.Vector2(-2,2),new THREE.Vector2(2,2),new THREE.Vector2(2,-2)]));
 const g=new THREE.ExtrudeGeometry(shape,{depth:10,bevelEnabled:false}),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.userData.bodyId='holed';
 const r={id:'cover',plane:'XY',offset:10,outer:[[-20,-20],[20,-20],[20,20],[-20,20]],holes:[],area:1600};
 const parts=sketchSolidOverlapRegions([r],[mesh]);assert.equal(parts.length,1);assert.equal(parts[0].holes.length,1);assert.ok(!regionContains(parts[0],[0,0]));assert.ok(regionContains(parts[0],[5,0]));assert.equal(parts[0].area,384);
 assert.equal(sketchSolidOverlapRegions([{...r,offset:20}],[mesh]).length,0);
 assert.equal(sketchSolidOverlapRegions([{...r,outer:[[3,3],[4,3],[4,4],[3,4]],area:1}],[mesh]).length,0);
 g.dispose();mesh.material.dispose();}
console.log('PASS sketch-plane overlap picking on top, bottom and interior sections in XY/XZ/YZ; exact profile metadata and batch/reverse preservation');
