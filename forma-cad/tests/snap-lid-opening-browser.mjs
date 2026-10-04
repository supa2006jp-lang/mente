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
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30},upper={...base,id:'lid',name:'上のボディ',z:30,depth:12};
 async function load(features){await page.locator('#file').setInputFiles({name:'lid.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('snap-lid-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#snap-lid-error').textContent());}}

 await load([base,upper]);await page.locator('#snap-lid-tool').click();await ready();assert.ok(!await page.locator('#snap-lid-openingGroove').isChecked());assert.equal(await page.locator('#snap-lid-openingWidth').inputValue(),'24');assert.equal(await page.locator('#snap-lid-openingHeight').inputValue(),'3');for(const key of ['openingWidth','openingHeight','openingDepth'])assert.ok(await page.locator('#snap-lid-'+key).isDisabled());
 await page.locator('#snap-lid-openingGroove').check();await ready();for(const key of ['openingWidth','openingHeight','openingDepth'])assert.ok(await page.locator('#snap-lid-'+key).isEnabled());assert.match(await page.locator('#snap-lid-opening-info').textContent(),/水平な爪掛け面/);
 await page.locator('#snap-lid-openingWidth').fill('28');await ready();await page.locator('#snap-lid-filletInside').check();await ready();await page.locator('#snap-lid-filletOutside').check();await ready();await page.locator('#snap-lid-pose').selectOption('assembled');await ready();await page.screenshot({path:'.sites-runtime/snap-lid-opening-preview.png'});await page.locator('#snap-lid-pose').selectOption('print');await ready();await page.screenshot({path:'.sites-runtime/snap-lid-opening-ledge-print.png'});
 await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);const saved=await save(),feature=saved.features.at(-1);assert.ok(feature.spec.openingGroove);assert.equal(feature.spec.openingWidth,28);assert.equal(feature.analysis.opening.count,2);assert.ok(feature.analysis.opening.remainingWall>=1.2);
 await load(saved.features);await page.locator('#bodies [data-snap-lid-id]').first().click();await ready();assert.ok(await page.locator('#snap-lid-openingGroove').isChecked());assert.equal(await page.locator('#snap-lid-openingWidth').inputValue(),'28');await page.locator('#snap-lid-openingGroove').uncheck();await ready();assert.ok(await page.locator('#snap-lid-openingWidth').isDisabled());assert.equal(await page.locator('#snap-lid-opening-info').textContent(),'');await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);assert.equal((await save()).features.at(-1).analysis.opening,null);
 await page.locator('#undo').click();assert.ok((await save()).features.at(-1).spec.openingGroove);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.openingGroove,false);await page.locator('#features .row-label').last().click();await ready();await page.locator('#snap-lid-openingGroove').check();await ready();await page.locator('#snap-lid-openingHeight').fill('100');await ready();assert.match(await page.locator('#snap-lid-opening-info').textContent(),/調整しました/);await page.locator('#snap-lid-openingDepth').fill('0');await page.waitForFunction(()=>document.getElementById('snap-lid-apply').disabled);assert.ok(await page.locator('#snap-lid-apply').isDisabled());await page.locator('#snap-lid-cancel').click();assert.equal((await save()).features.at(-1).spec.openingGroove,false);
 const legacy=structuredClone(saved.features);delete legacy.at(-1).spec.openingStyle;legacy.at(-1).spec.openingWidth=14;legacy.at(-1).spec.openingHeight=1;await load(legacy);await page.locator('#bodies [data-snap-lid-id]').first().click();await ready();assert.equal(await page.locator('#snap-lid-openingWidth').inputValue(),'24');assert.equal(await page.locator('#snap-lid-openingHeight').inputValue(),'3');await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);const migrated=await save();assert.equal(migrated.features.at(-1).spec.openingStyle,'ledge');assert.equal(migrated.features.at(-1).analysis.opening.pullingFace,'horizontal');
 const circular=[base,upper].map(f=>({...f,profile:'circle',diameter:60}));await load(circular);await page.locator('#snap-lid-tool').click();await ready();assert.ok(!await page.locator('#snap-lid-openingGroove').isChecked());await page.locator('#snap-lid-openingGroove').check();await page.waitForFunction(()=>document.getElementById('snap-lid-error').textContent.includes('四角'));assert.ok(await page.locator('#snap-lid-apply').isDisabled());await page.locator('#snap-lid-openingGroove').uncheck();await ready();await page.locator('#snap-lid-cancel').click();assert.deepEqual(errors,[]);
 console.log('PASS opening option, live preview with fillets, save/reload, reedit/removal, undo/redo, auto limits, invalid input and unsupported cylinder recovery');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
