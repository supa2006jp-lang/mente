import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {runOperation} from '../src/kernel.js';
import {qrBodyDisplays,colorQrGeometry} from '../src/qr-code-display.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const spec={type:'qrCode',id:'qr',size:35,text:'ID-42',point:[12,23,5],frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]}},initial={kind:'cadop',id:'qr',name:'QRコード',spec,...runOperation([],spec)};
function geometry(output){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));g.setIndex(output.triangles);g.setAttribute('normal',new THREE.Float32BufferAttribute(output.normals,3));g.userData.faceGroups=output.faceGroups;return g;}
function colored(history,id,output=history.at(-1).outputs.find(o=>o.id===id)){
 const source=geometry(output),before=Array.from(source.attributes.position.array),result=colorQrGeometry(source,qrBodyDisplays(history).get(id));
 assert.ok(result.userData.qrColors.blackTriangles>0);assert.ok(result.userData.qrColors.whiteTriangles>0);assert.equal(result.index,null);assert.equal(result.attributes.position.count,output.triangles.length);assert.deepEqual(Array.from(source.attributes.position.array),before);assert.equal(source.attributes.color,undefined);assert.deepEqual(result.userData.faceGroups,source.userData.faceGroups);source.dispose();return result;
}
test('completed QR has white base and black relief without changing its geometry',()=>{
 const original=JSON.stringify(initial),g=colored([initial],'qr'),p=g.attributes.position,c=g.attributes.color;
 for(let i=0;i<p.count;i+=3){const h=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3-5;assert.equal(c.getX(i),h>1.0001?0:1);assert.equal(c.getY(i),c.getX(i));assert.equal(c.getZ(i),c.getX(i));}
 assert.equal(JSON.stringify(initial),original);g.dispose();
 const ordinary=new THREE.BoxGeometry(10,10,10);assert.equal(colorQrGeometry(ordinary,undefined),ordinary);ordinary.dispose();
});

test('compact quiet zones preserve color placement and persisted settings',async()=>{
 const compact={...spec,quietModules:2,nozzle:.6},feature={kind:'cadop',id:'qr',name:'QRコード',spec:compact,...runOperation([],compact)};colored([feature],'qr').dispose();
 const saved=(await encodeProjectDocument({format:'forma-cad',version:1,features:[feature]},{compress:true})).text,loaded=(await decodeProjectDocument(saved)).document;assert.equal(loaded.features[0].spec.quietModules,2);assert.equal(qrBodyDisplays(loaded.features).get('qr')[0].layout.quiet,2);colored(loaded.features,'qr').dispose();
});
test('translated, rotated and reflected copies retain QR colors',()=>{
 const move={type:'move',id:'move',target:'qr',x:15,y:-20,z:8,rotation:[30,15,45],pivot:[12,23,5]},moved={kind:'cadop',id:'move',name:'移動',spec:move,...runOperation([initial],move)},history=[initial,moved];colored(history,'qr').dispose();
 const copy={...move,id:'copy',x:40,y:0,z:0,rotation:[0,0,0],pivot:[0,0,0],copy:true,reverseCopy:true},copied={kind:'cadop',id:'copy',name:'複製',spec:copy,...runOperation(history,copy)};
 const displays=qrBodyDisplays([...history,copied]);assert.ok(displays.has('qr'));assert.ok(displays.has('copy'));colored([...history,copied],'copy').dispose();
 const mirror={type:'mirror',id:'mirror',target:'qr',plane:'XY',offset:0},mirrored={kind:'cadop',id:'mirror',name:'ミラー',spec:mirror,...runOperation(history,mirror)};colored([...history,mirrored],'mirror').dispose();
});
test('existing plain and compressed QR saves restore colors from their history',async()=>{
 for(const compress of [false,true]){const text=(await encodeProjectDocument({format:'forma-cad',version:1,features:[initial]},{compress})).text,loaded=(await decodeProjectDocument(text)).document;colored(loaded.features,'qr').dispose();assert.equal(loaded.features[0].spec.text,'ID-42');}
 const removed={kind:'cadop',id:'delete',spec:{type:'deleteBodies'},outputs:[],remove:['qr']};assert.equal(qrBodyDisplays([initial,removed]).size,0);
});
