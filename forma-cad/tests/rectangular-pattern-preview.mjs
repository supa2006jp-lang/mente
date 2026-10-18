import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installPatternPreview} from '../src/pattern-preview.js';
const elements={};for(const id of ['tools-dialog','cad-fields','cad-command'])elements[id]=new EventTarget();elements['tools-dialog'].open=true;elements['cad-command'].value='rectangular';const inputs=[];elements['cad-fields'].querySelectorAll=()=>inputs;
const status={textContent:''},fitButton={};elements['pattern-preview-panel']={querySelector:selector=>selector==='p'?status:fitButton};
const previousDocument=globalThis.document,previousObserver=globalThis.MutationObserver;globalThis.document={getElementById:id=>elements[id]};globalThis.MutationObserver=class{observe(){}};
const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());mesh.position.set(15,25,5);scene.add(mesh);const host={dataset:{}};
let spec={type:'rectangular',distribution:'between',count:4,count2:1,target:'body',patternAnchor:[15,25,5],startPoint:[0,0,5],endPoint:[60,0,5]},disposedGeometry=false,disposedMaterial=false;mesh.geometry.addEventListener('dispose',()=>disposedGeometry=true);mesh.material.addEventListener('dispose',()=>disposedMaterial=true);
try{
 const preview=installPatternPreview({scene,host,getMesh:()=>mesh,getSpec:()=>spec});preview.update();assert.equal(mesh.visible,false);assert.equal(preview.group.children.length,4);assert.deepEqual(preview.group.children.map(copy=>copy.position.toArray()),[[0,0,5],[20,0,5],[40,0,5],[60,0,5]]);assert.deepEqual(mesh.position.toArray(),[15,25,5]);
 spec={...spec,count:3};elements['cad-fields'].dispatchEvent(new Event('input'));assert.equal(preview.group.children.length,3);assert.deepEqual(preview.group.children.map(copy=>copy.position.toArray()),[[0,0,5],[30,0,5],[60,0,5]]);
 spec={...spec,endPoint:spec.startPoint};preview.update();assert.equal(mesh.visible,true,'invalid input restores the original immediately');assert.equal(preview.group,null);
 spec={type:'rectangular',count:2,count2:2,spacing:20,spacing2:30};inputs.push({disabled:true,value:'',checkValidity:()=>true});preview.update();assert.equal(mesh.visible,true);assert.equal(preview.group.children.length,3);
 elements['cad-command'].value='circular';spec={type:'circular',count:4,angle:360,axis:'Z',origin:[0,0,0]};preview.update();assert.equal(preview.group.children.length,3);assert.match(status.textContent,/コピー 3個/);assert.ok(preview.group.children[0].position.distanceTo(new THREE.Vector3(-25,15,5))<1e-8);
 spec={...spec,count:3,origin:[10,10,0]};elements['cad-fields'].dispatchEvent(new Event('input'));assert.equal(preview.group.children.length,2);assert.match(status.textContent,/原型を含む 3個/);
 inputs.push({disabled:false,value:'',checkValidity:()=>false});preview.update();assert.equal(preview.group,null);assert.match(status.textContent,/個数・角度/);inputs.pop();preview.update();assert.equal(preview.group.children.length,2);
 elements['tools-dialog'].dispatchEvent(new Event('close'));assert.equal(preview.group,null);assert.equal(mesh.visible,true);assert.equal(disposedGeometry,false);assert.equal(disposedMaterial,false);
 console.log('PASS live count/position previews, relocated original ghost, invalid-input and cancel restoration, standard preview compatibility and shared geometry/material ownership');
}finally{globalThis.document=previousDocument;globalThis.MutationObserver=previousObserver;mesh.geometry.dispose();mesh.material.dispose();}
