import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFilletRadiusHighlight} from '../src/fillet-radius-highlight.js';
const scene=new THREE.Scene(),host={dataset:{}},mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial({color:0x777777})),meshes=new Map([['body',mesh]]);scene.add(mesh);mesh.updateMatrixWorld();
const view=createFilletRadiusHighlight({scene,host,meshes}),limit={radius:1,diagnostics:{certainty:'faulty-contour',bodyIds:['body'],edges:[{bodyId:'body',points:[[0,0,0],[1,0,0],[1,1,0]]}]}};
view.show(limit);let info=JSON.parse(host.dataset.filletRadiusLimit);assert.equal(info.radius,1);assert.equal(info.edges,1);assert.deepEqual(info.bodyIds,['body']);const exact=scene.children.at(-1);assert.equal(exact.children[0].material.color.getHex(),0xef4438);assert.equal(exact.children[0].material.depthTest,false);let disposed=0;exact.children[0].geometry.addEventListener('dispose',()=>disposed++);
view.show({...limit,diagnostics:{...limit.diagnostics,certainty:'selected-edges'}});assert.equal(disposed,1);assert.equal(scene.children.at(-1).children[0].material.color.getHex(),0xe7a43b);assert.equal(mesh.material.color.getHex(),0x777777);
mesh.visible=false;view.show(limit);assert.equal(host.dataset.filletRadiusLimit,undefined);assert.equal(scene.children.length,1);mesh.visible=true;view.show(limit);view.clear();assert.equal(scene.children.length,1);assert.equal(host.dataset.filletRadiusLimit,undefined);mesh.geometry.dispose();mesh.material.dispose();
console.log('PASS failed-edge/body markers, exact versus uncertain colours, hidden-body filtering, cleanup and unchanged original material');
