import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeQrCode} from '../src/qr-code-solid.js';
import {qrCodeLayout} from '../src/qr-code-layout.js';
import {runOperation} from '../src/kernel.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {validateProject} from '../src/geometry.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const frame={u:[1,0,0],v:[0,1,0],n:[0,0,1]},spec={type:'qrCode',id:'qr',size:40,text:'PART-00042',point:[12,23,5],frame},layout=qrCodeLayout(spec),start=performance.now(),result=makeQrCode(spec);
const check=new (R.getOC().BRepCheck_Analyzer)(result.shape.wrapped,true,false),solids=result.shape.solids;assert.ok(check.IsValid());assert.equal(solids.length,1);check.delete();solids.forEach(s=>s.delete());assert.ok(solidMeshComplete(result.shape));
const bounds=result.shape.boundingBox;try{const [min,max]=bounds.bounds;for(const [i,expected]of [40,40,2].entries())assert.ok(Math.abs(max[i]-min[i]-expected)<1e-5);}finally{bounds.delete();}
const mesh=result.shape.mesh({tolerance:.08,angularTolerance:.15}),vertices=mesh.vertices,edges=new Map(),key=i=>vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',');
for(let i=0;i<mesh.triangles.length;i+=3){const ids=mesh.triangles.slice(i,i+3).map(key);for(let j=0;j<3;j++){const edge=[ids[j],ids[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}}
assert.ok([...edges.values()].every(count=>count===2),'QR export mesh must have exactly two triangles at every welded edge');
assert.ok(Math.abs(R.measureVolume(result.shape)-(40*40+layout.rectangles.reduce((s,r)=>s+r.width*r.height,0)))<1e-4);result.shape.delete();
console.log('QR solid generated in '+Math.round(performance.now()-start)+' ms ('+layout.rectangles.length+' raised rectangles)');
const native=runOperation([],{...spec,size:30,text:'1234',quietModules:2,frame:{u:[1,0,0],v:[0,0,-1],n:[0,1,0]}});assert.equal(native.outputs.length,1);assert.equal(native.outputs[0].id,'qr');assert.deepEqual(native.remove,[]);assert.equal(native.analysis.quietModules,2);
const doc={format:'forma-cad',version:1,features:[{kind:'cadop',id:'qr',name:'QRコード',spec:{...spec,size:30,text:'1234',quietModules:2,frame:{u:[1,0,0],v:[0,0,-1],n:[0,1,0]}},...native}]};validateProject(doc);
const restored=(await decodeProjectDocument((await encodeProjectDocument(doc,{compress:true})).text)).document;assert.equal(restored.features[0].spec.text,'1234');
const moved=runOperation(restored.features,{type:'move',id:'move',target:'qr',targets:['qr'],x:15,y:0,z:0,rotation:[0,0,0]});assert.equal(moved.outputs[0].id,'qr');
const replay=runOperation(restored.features,{type:'replay',before:restored.features,start:0});validateProject({...doc,features:replay.features});
console.log('PASS single solid, 1 mm base + 1 mm pattern, quiet zone, native mesh, arbitrary plane, independent body, movement, save and replay');
