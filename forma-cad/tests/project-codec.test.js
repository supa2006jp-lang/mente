import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';
import {createProjectFileTarget} from '../src/project-file-target.js';
import {validateProject,rebuild,volume} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([0,0,0],[40,30,20]),seed={kind:'cadop',id:'seed',name:'箱',outputs:[{id:'body',...box.mesh({tolerance:.08,angularTolerance:.15}),brep:box.serialize()}],remove:[]};
const spec={type:'fillet',id:'round',target:'body',radius:2},features=[seed,{kind:'cadop',id:'round',name:'角を丸める',spec,...runOperation([seed],spec)}];
const document={format:'forma-cad',version:1,units:'mm',features,drawing:{notes:['編集情報・寸法 1/3',.12345678901234567]},preview:{version:1,width:640,height:480,dataUrl:'data:image/jpeg;base64,'+'YWJj'.repeat(2000)}};
box.delete();
const expected=JSON.parse(JSON.stringify(document));

test('ordinary saves remain readable version-1 JSON and omit indentation',async()=>{
 const encoded=await encodeProjectDocument(document);
 assert.equal(encoded.compressed,false);assert.deepEqual(JSON.parse(encoded.text),expected);
 assert.ok(encoded.bytes<Buffer.byteLength(JSON.stringify(document,null,2)));
 assert.deepEqual((await decodeProjectDocument(JSON.stringify(document,null,2))).document,expected);
});
test('lightweight save retains every value, native shape, history and preview without modifying the source',async()=>{
 const before=JSON.stringify(document),encoded=await encodeProjectDocument(document,{compress:true});
 assert.equal(encoded.compressed,true);assert.ok(encoded.bytes<encoded.originalBytes*.65);
 const restored=await decodeProjectDocument(encoded.text);assert.equal(restored.compressed,true);assert.deepEqual(restored.document,expected);assert.equal(JSON.stringify(document),before);
 const project=validateProject(restored.document),bodies=rebuild(project);assert.ok(volume(bodies.get('body').geometry)>20000);bodies.forEach(b=>b.geometry.dispose());
 const changed={...project.at(-1).spec,radius:3},result=runOperation(project.slice(0,-1),changed);
 assert.ok(result.outputs[0].brep.length>1000,'the restored native shape supports editing the fillet');
 assert.notEqual(result.outputs[0].brep,project.at(-1).outputs[0].brep);
});
test('tiny files and browsers without compression use compact ordinary JSON',async()=>{
 const small={format:'forma-cad',version:1,features:[]};assert.equal((await encodeProjectDocument(small,{compress:true})).compressed,false);
 const original=globalThis.CompressionStream;
 try{globalThis.CompressionStream=undefined;const fallback=await encodeProjectDocument(document,{compress:true});assert.equal(fallback.compressed,false);assert.deepEqual(JSON.parse(fallback.text),expected);}
 finally{globalThis.CompressionStream=original;}
});
test('unknown or damaged lightweight files fail explicitly',async()=>{
 const packed=JSON.parse((await encodeProjectDocument(document,{compress:true})).text);
 for(const data of ['',null,'A===','!!??'])await assert.rejects(decodeProjectDocument(JSON.stringify({...packed,data})),/壊れ/);
 await assert.rejects(decodeProjectDocument(JSON.stringify({...packed,data:'AAAA'})),/展開できません/);
 await assert.rejects(decodeProjectDocument(JSON.stringify({...packed,data:packed.data.slice(0,-8)})),/展開できません/);
 await assert.rejects(decodeProjectDocument(JSON.stringify({...packed,version:2})),/対応していない/);
 await assert.rejects(decodeProjectDocument(JSON.stringify({...packed,encoding:'zip'})),/対応していない/);
 const original=globalThis.DecompressionStream;
 try{globalThis.DecompressionStream=undefined;await assert.rejects(decodeProjectDocument(JSON.stringify(packed)),/最新のChrome/);}
 finally{globalThis.DecompressionStream=original;}
});
test('overwrite writes the completed compressed snapshot and serialization failure preserves the file',async()=>{
 let saved='original',opens=0;const handle={name:'model.forma.json',async createWritable(){opens++;let pending;return {async write(text){pending=text;},async close(){saved=pending;},async abort(){}};}};
 const target=createProjectFileTarget({host:{}});target.attach(handle);
 await target.save(()=>encodeProjectDocument(document,{compress:true}));assert.deepEqual((await decodeProjectDocument(saved)).document,expected);assert.equal(opens,1);
 const before=saved,bad={...document};bad.cycle=bad;
 await assert.rejects(target.save(()=>encodeProjectDocument(bad,{compress:true})),/circular/i);assert.equal(saved,before);assert.equal(opens,1);
});
