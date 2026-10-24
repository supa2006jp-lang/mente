import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {validateProject} from '../src/geometry.js';
import {cadMesh} from '../src/cad-mesh.js';
import {solidMeshComplete} from '../src/solid-mesh.js';

// Run enclose-arc-boundaries.mjs first to generate this synthetic legacy file.
const fixture=JSON.parse(await fs.readFile('.sites-runtime/enclose-arc-boundaries-fixture.forma.json','utf8'));
const root=path.resolve('dist'),out='.sites-runtime/enclose-arc-browser';
await fs.mkdir(out,{recursive:true});
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const data=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1900,height:1200},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
const canvas=page.locator('#canvas-host canvas');
async function load(data){await page.locator('#file').setInputFiles({name:'arc.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
const edit=()=>page.locator('[data-history-feature="enclosure"] .row-label').click();
const preview=()=>page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='enclose'&&document.getElementById('cad-error').textContent.includes('半透明'),null,{timeout:60000});
async function apply(){await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:60000});}
function valid(data){validateProject(data);const f=data.features.find(f=>f.id==='enclosure'),shape=R.deserializeShape(f.outputs[0].brep).asShape3D();try{assert(solidMeshComplete(shape,cadMesh(shape)));}finally{shape.delete();}assert.equal(data.features.find(f=>f.id==='source').cadResult.outputs[0].brep,fixture.features.find(f=>f.id==='source').cadResult.outputs[0].brep);}
try{
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await canvas.waitFor();await load(fixture);const baseline=await save();
 await edit();await preview();assert.equal(await page.locator('#cad-thickness').inputValue(),'6');assert.equal(await page.locator('#cad-clearance').inputValue(),'0');
 await page.locator('[data-view=iso]').dispatchEvent('click');await page.screenshot({path:out+'/preview.png'});await apply();const first=await save();valid(first);assert.equal(await page.locator('#body-count').textContent(),'1');
 await page.locator('#undo').click();const undone=await save();assert(JSON.stringify(undone.features)===JSON.stringify(baseline.features),'undo restores loaded history');await page.locator('#redo').click();valid(await save());
 await load(first);await edit();await page.locator('#cad-clearance').fill('.3');await page.locator('#cad-encloseRoundedCorners').check();await preview();await apply();const changed=await save();valid(changed);assert.equal(changed.features.find(f=>f.id==='enclosure').spec.clearance,.3);assert(changed.features.find(f=>f.id==='enclosure').spec.roundedCorners);
 await edit();await page.locator('#cad-thickness').fill('2');await preview();await page.locator('#cad-cancel').click();assert(JSON.stringify((await save()).features)===JSON.stringify(changed.features),'cancel preserves history');assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/result.png'});const proof={pass:true,legacyLoad:true,sharpPreviewAndCommit:true,sourceUnchanged:true,undoRedo:true,reloadAndRoundedClearanceEdit:true,cancelPreservesHistory:true,errors};await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){console.error('cad-error:',await page.locator('#cad-error').textContent().catch(()=>''),'page-errors:',errors);await page.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
