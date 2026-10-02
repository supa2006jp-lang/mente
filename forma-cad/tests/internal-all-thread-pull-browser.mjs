import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {defaults} from '../src/geometry.js';import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const c={...defaults,id:'c',name:'テスト円柱',profile:'circle',diameter:20,depth:15},hole={...c,id:'h',diameter:10,z:15,depth:-15,operation:'cut',target:'c',hole:true},spec={type:'thread',target:'c',surfacePoint:[5,0,2],profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true},thread=runOperation([c,hole],spec);
const plug={...c,id:'plug',name:'穴から作成した別ボディ',diameter:8,depth:5,z:20,operation:'new',target:'c'};
const features=[c,hole,{kind:'cadop',id:'thread',name:'ねじ',spec,...thread},plug,{kind:'cadop',id:'move-plug',name:'移動',spec:{type:'move',target:'plug'},...runOperation([plug],{type:'move',target:'plug',rotation:[0,0,0],x:0,y:0,z:10})}],browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'thread.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 const open=async()=>{await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('pull');};
 await open();assert.equal(await page.locator('#pull-all-thread').isChecked(),true,'Thread pull must default to all turns');assert.equal(await page.locator('#pull-thread-target').inputValue(),'c');
 await page.locator('#cad-distance').fill('-.12');await page.locator('#cad-cancel').click();
 await open();await page.locator('#pull-all-thread').check();assert.equal(await page.locator('#cad-distance').inputValue(),'-0.12');
 await page.screenshot({path:'.sites-runtime/all-thread-pull-dialog.png'});
 await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:120000});
 assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const download=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),last=saved.features.at(-1);
 assert.equal(last.spec.allThreadFaces,true);assert.equal(last.spec.target,'c');assert.equal(last.spec.distance,-.12);
 assert.deepEqual(last.outputs[0].threadSource.spec.threadFaceOffsets,[-.12,-.12,-.12,0]);
 assert.ok(R.measureVolume(R.deserializeShape(last.outputs[0].brep).asShape3D())<R.measureVolume(R.deserializeShape(thread.outputs[0].brep).asShape3D()));
 await page.reload();await open();assert.equal(await page.locator('#pull-all-thread').isDisabled(),true);await page.locator('#cad-cancel').click();
 await page.locator('#file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await open();await page.locator('#pull-all-thread').check();assert.equal(await page.locator('#cad-distance').inputValue(),'-0.12');
 assert.deepEqual(errors,[]);console.log('PASS automatic thread pull without picking faces and distance remembered after reload');
}finally{await browser.close();}
