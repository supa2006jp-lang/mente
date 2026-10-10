import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const prefix='/mente/forma-cad/',root=path.resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!url.startsWith(prefix)){res.writeHead(404);return res.end();}
  let relative=url.slice(prefix.length)||'index.html';if(relative.endsWith('/'))relative+='index.html';
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#cylinder-hinge-error').textContent());}}
 async function analysis(){return page.locator('[data-cylinder-hinge]').evaluate(el=>JSON.parse(el.dataset.cylinderHinge));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#cylinder-hinge-cancel').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);}

const cylinder={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:60,depth:80};
 await load([cylinder]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await ready();
 let a=await analysis();assert.equal(a.pose,'print');assert.equal(a.angle,180);assert.equal(a.autoHollow,true);assert.ok(await page.locator('#cylinder-hinge-angle').isDisabled());
 await page.locator('#cylinder-hinge-pose').selectOption('closed');await ready();assert.equal((await analysis()).angle,0);
 await page.locator('#cylinder-hinge-pose').selectOption('open');await ready();assert.equal((await analysis()).angle,110);assert.equal(await page.locator('#cylinder-hinge-angle').isDisabled(),false);
 await page.locator('#cylinder-hinge-angle').fill('45');await ready();assert.equal((await analysis()).angle,45);
 await page.locator('#cylinder-hinge-radialGap').fill('0.1');assert.ok(await page.locator('#cylinder-hinge-apply').isDisabled());await page.locator('#cylinder-hinge-radialGap').fill('0.5');await ready();
 await page.locator('#cylinder-hinge-pose').selectOption('print');await ready();await page.locator('#cylinder-hinge-apply').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/cylinder-hinge-print.png'});
 await page.locator('#cylinder-hinge-apply').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);
 const saved=await save();const stlDownload=page.waitForEvent('download');await page.locator('#export').click();const stl=await fs.readFile(await(await stlDownload).path());const triangleCount=saved.features.at(-1).outputs.reduce((sum,o)=>sum+o.triangles.length/3,0);assert.equal(stl.readUInt32LE(80),triangleCount);assert.equal(stl.length,84+triangleCount*50,'single STL contains the captive assembly in its shared placement');assert.equal(saved.features.at(-1).spec.radialGap,.5);assert.equal(saved.features.at(-1).outputs.length,2);
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.radialGap,.5);
 await load(saved.features);await page.locator('[data-cylinder-hinge-id]').first().click();await ready();assert.equal(await page.locator('#cylinder-hinge-radialGap').inputValue(),'0.5');await page.locator('#cylinder-hinge-lidThickness').fill('3');await close();assert.equal((await save()).features.at(-1).spec.lidThickness,2.4);
 await page.locator('[data-cylinder-hinge-id]').first().click();await ready();await page.locator('#cylinder-hinge-lidThickness').fill('3');await ready();await page.locator('#cylinder-hinge-apply').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);assert.equal((await save()).features.at(-1).spec.lidThickness,3);
 console.log('PASS solid shell preview, open/closed/print poses, gap guard, create, save/reload/edit/cancel and undo/redo');
 const hollow={...defaults,id:'bore',kind:'extrusion',name:'中空',profile:'circle',operation:'cut',target:'cylinder',diameter:54,depth:80,z:4};
 await load([cylinder,hollow]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await ready();assert.equal((await analysis()).hollow,true);assert.equal((await analysis()).innerRadius,27);assert.ok(await page.locator('#cylinder-hinge-wall').isDisabled());assert.ok(await page.locator('#cylinder-hinge-floor').isDisabled());await close();
 // The generic command menu is another entry point.
 await page.locator('#advanced-tools').dispatchEvent('click');await page.locator('#cad-command').selectOption('cylinderHinge');await ready();await close();
 const box={...defaults,id:'box',kind:'extrusion',name:'箱',width:40,height:40,depth:40};
 await load([box]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await page.waitForFunction(()=>document.getElementById('cylinder-hinge-error').textContent.includes('円柱・円筒'));assert.ok(await page.locator('#cylinder-hinge-apply').isDisabled());await close();assert.equal((await save()).features.length,1);
 console.log('PASS existing hollow cavity controls, command-menu entry and non-destructive unsupported-source error');
 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
