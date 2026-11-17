import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAutomaticExtrusionProbe} from '../src/automatic-extrusion-probe.js';
import {defaults} from '../src/geometry.js';

test('automatic cut results remain ready after switching operation; geometry changes require a new probe',async()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(40,20,10)),meshes=new Map([['base',mesh]]),model=[];let calls=0;
 const matches=[{id:'base',volume:100}],probe=createAutomaticExtrusionProbe({reset(){},async run(){calls++;return {matches};}});
 const feature={...defaults,id:'os',kind:'extrusion',profile:'region',profileOffset:-2,capHoles:true,depth:-3,operation:'join',target:'base',targetAllBodies:true,joinSourceContacts:true};
 try{
  assert.deepEqual(await probe.run(model,feature,meshes,'base'),matches);
  const cut={...feature,operation:'cut',cutAllBodies:true};delete cut.joinSourceContacts;
  assert.deepEqual(probe.read(model,cut,'base',meshes),matches);
  assert.deepEqual(await probe.run(model,{...cut,operation:'join',joinSourceContacts:true,joinSelectionExact:true},meshes,'base'),matches);assert.equal(calls,1);
  for(const change of [{profileOffset:0},{depth:3},{capHoles:false},{symmetric:true}])assert.equal(probe.read(model,{...feature,...change},'base',meshes),null);
 }finally{mesh.geometry.dispose();mesh.material.dispose();}
});
