import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,makeSketchGeometry} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {fitSketchEditView} from '../src/sketch-edit-view.js';

test('sketch reentry faces XYZ and arbitrary planes and fits every member rather than the temporary grid',()=>{
 for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const [width,height]of [[1200,750],[500,800]]){
  const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.5,.8,-.2)),frame=plane==='CUSTOM'?Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3().setComponent(i,1).transformDirection(rotation).toArray()])):undefined;
  const a={...defaults,id:'a',kind:'sketch',profile:'rect',plane,frame,x:300,y:-120,z:70,width:60,height:40},b=basisFor(a),second=new THREE.Vector3(a.x,a.y,a.z).addScaledVector(b.u,140),features=[a,{...a,id:'b',profile:'circle',diameter:30,x:second.x,y:second.y,z:second.z}],before=structuredClone(features),camera=new THREE.OrthographicCamera(-100*width/height,100*width/height,100,-100,.1,50000);
  const target=fitSketchEditView(camera,features,width,height);assert.ok(target);assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(b.n)<-.999999);assert.ok(camera.up.distanceTo(b.v)<1e-9);
  for(const f of features){const g=makeSketchGeometry(f);for(let i=0;i<g.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).project(camera);assert.ok(Math.abs(p.x)<.81&&Math.abs(p.y)<.67);assert.ok(p.z>=-1&&p.z<=1);}g.dispose();}
  assert.deepEqual(features,before);
 }
});
test('empty and zero-size viewports leave the camera alone, while a point gets a usable finite zoom',()=>{
 const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,50000),before=camera.toJSON();
 assert.equal(fitSketchEditView(camera,[],900,700),null);assert.equal(fitSketchEditView(camera,[{...defaults,kind:'sketch'}],0,700),null);assert.deepEqual(camera.toJSON(),before);
 assert.ok(fitSketchEditView(camera,[{...defaults,kind:'sketch',profile:'point'}],900,700));assert.ok(Number.isFinite(camera.zoom)&&camera.zoom>0);
});
