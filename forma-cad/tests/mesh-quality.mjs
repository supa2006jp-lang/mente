import assert from 'node:assert/strict';
import * as THREE from 'three';
import {currentBodyMeshRecords,lightweightThreadBodies,applyThreadDisplayMeshes,THREAD_DISPLAY_MESH,threadDisplayForOperation} from '../src/mesh-quality.js';
import {stlMeshSnapshot,createPreciseStl} from '../src/stl-export-mesh.js';
const history=[{id:'thread',kind:'cadop',spec:{type:'thread',target:'a'},outputs:[{id:'a',brep:'exact',threadSource:{spec:{pitch:1.5}},vertices:[0,0,0],triangles:[]}],remove:[]}];
assert.deepEqual(lightweightThreadBodies(history),[{id:'a',brep:'exact'}]);
const next=applyThreadDisplayMeshes(history,{outputs:[{id:'a',brep:'ignore',vertices:[1,2,3],triangles:[0,0,0],displayMesh:{...THREAD_DISPLAY_MESH}}]});
assert.equal(next[0].outputs[0].brep,'exact');assert.equal(history[0].outputs[0].vertices[0],0);assert.deepEqual(next[0].outputs[0].threadSource,history[0].outputs[0].threadSource);assert.deepEqual(lightweightThreadBodies(next),[]);
for(const type of ['move','mirror','rectangular','circular','printLayout']){
 const spec={type,target:'a'},copy=[...history,{kind:'cadop',spec,outputs:[{id:'b',brep:'copy'}],remove:[]}];
 assert.equal(currentBodyMeshRecords(copy).get('b').thread,true);assert.equal(threadDisplayForOperation(history,spec,'b'),THREAD_DISPLAY_MESH);
}
const joined=[...history,{kind:'cadop',spec:{type:'join',target:'b',others:['a']},outputs:[{id:'b',brep:'joined'}],remove:['a']}];assert.ok(currentBodyMeshRecords(joined).get('b').thread);assert.ok(!currentBodyMeshRecords(joined).has('a'));
const cut=[...history,{kind:'extrusion',id:'cut',operation:'cut',target:'a'}];assert.equal(currentBodyMeshRecords(cut).get('a').output,null,'raw cuts must invalidate earlier BREP');
const mixed={type:'move',target:'a',targets:['a','plain'],copy:true,id:'copy'};assert.equal(threadDisplayForOperation(history,mixed,'copy','a'),THREAD_DISPLAY_MESH);assert.equal(threadDisplayForOperation(history,mixed,'copy-copy-1','plain'),null);
const mirrorBatch=[...history,{kind:'cadop',spec:{type:'mirror',target:'a',targets:['a','plain']},outputs:[{id:'mirror',brep:'thread-copy'},{id:'mirror-mirror-1',brep:'plain-copy'}],remove:[],analysis:{mirrors:[{bodyId:'a',outputId:'mirror'},{bodyId:'plain',outputId:'mirror-mirror-1'}]}}];
assert.equal(currentBodyMeshRecords(mirrorBatch).get('mirror').thread,true);assert.equal(currentBodyMeshRecords(mirrorBatch).get('mirror-mirror-1').thread,false,'each mirrored body retains its own display quality');
const g=new THREE.BoxGeometry(2,3,4),visible=new THREE.Mesh(g),hidden=new THREE.Mesh(g);hidden.visible=false;visible.position.x=12;
const meshes=new Map([['a',visible],['hidden',hidden]]);assert.deepEqual(stlMeshSnapshot(history,meshes),[{id:'a',brep:'exact'}]);
const fallback=stlMeshSnapshot(cut,meshes);assert.ok(!fallback[0].brep);assert.equal(Math.min(...fallback[0].vertices.filter((_,i)=>i%3===0)),11);assert.equal(fallback[0].triangles.length,g.index.count);
await assert.rejects(createPreciseStl([],()=>{throw Error('must not run');},{isCurrent:()=>false}),/モデルが変更/);
let current=true;await assert.rejects(createPreciseStl([],async()=>{current=false;return {outputs:[]};},{isCurrent:()=>current}),/モデルが変更/);
g.dispose();console.log('PASS thread lineage, immutable display replacement, exact CAD preservation, visible-only export, raw fallback and revision cancellation');
