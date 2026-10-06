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
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec){window.cadJobs.push(payload.spec.type);window.latestSpec=payload.spec;}return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();





 const base={...defaults,id:'body',kind:'extrusion',name:'長方形',width:80,height:50,depth:30,z:3};
 async function load(features){await page.locator('#file').setInputFiles({name:'slide-widths.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('slide-lid-apply').disabled,null,{timeout:90000});}catch{await fs.writeFile('.sites-runtime/slide-labels-failed-spec.json',JSON.stringify(await page.evaluate(()=>window.latestSpec)));throw Error(await page.locator('#slide-lid-error').textContent());}}
 async function apply(){await page.locator('#slide-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('slide-lid-dialog').open);}
 await load([base]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();await page.locator('#slide-lid-divider').check();await ready();await page.locator('#slide-lid-dividerCompartments').selectOption('3');await ready();await page.locator('#slide-lid-filletInside').check();await ready();
 await page.locator('#slide-lid-labels').check();await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('文字を入力'));assert.ok(await page.locator('#slide-lid-apply').isDisabled());assert.equal(await page.locator('#slide-lid-label-texts input').count(),3);
 await page.locator('#slide-lid-labelText0').fill('ネジ');await ready();console.log('PASS ネジ');await page.locator('#slide-lid-labelText1').fill('小物');await ready();console.log('PASS 小物');await page.locator('#slide-lid-labelText2').fill('B');await ready();console.log('PASS B');assert.match(await page.locator('#slide-lid-label-info').textContent(),/ネジ.*小物.*B/);
 const jobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#slide-lid-transparent').check();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.cadJobs.length),jobs);assert.equal(await page.locator('[data-slide-lid-preview-transparent]').getAttribute('data-slide-lid-preview-transparent'),'true');
 await page.locator('#slide-lid-pose').selectOption('assembled');await ready();await page.locator('#slide-lid-labelText0').scrollIntoViewIfNeeded();await page.locator('[data-view=top]').dispatchEvent('click');await page.screenshot({path:'.sites-runtime/slide-lid-labels-transparent.png'});await apply();const saved=await save(),op=saved.features.at(-1);assert.equal(op.spec.labels,true);assert.deepEqual(op.spec.labelTexts,['ネジ','小物','B']);assert.equal(op.analysis.labels.length,3);assert.ok(op.spec.labelPatterns[2].regions.some(r=>r.holes.length),'B keeps enclosed holes');assert.ok(!('transparent' in op.spec));assert.equal(await page.locator('#transparent-slide-lids').getAttribute('aria-pressed'),'true');assert.deepEqual(JSON.parse(await page.locator('[data-transparent-slide-lids]').getAttribute('data-transparent-slide-lids')),[op.spec.id+'-lid']);
 await fs.writeFile('.sites-runtime/slide-labels-fixture.json',JSON.stringify(saved));await page.locator('#transparent-slide-lids').click();assert.equal(await page.locator('#transparent-slide-lids').getAttribute('aria-pressed'),'false');assert.deepEqual((await save()).features,saved.features,'display toggle leaves geometry and history unchanged');await page.locator('#transparent-slide-lids').click();await page.locator('#bodies [data-slide-lid-id]').first().click();await ready();assert.ok(await page.locator('#slide-lid-transparent').isChecked());assert.equal(await page.locator('#slide-lid-labelText0').inputValue(),'ネジ');await page.locator('#slide-lid-labelOperation').selectOption('engrave');await ready();await page.locator('#slide-lid-labelDepth').fill('2');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('1.2 mm'));assert.ok(await page.locator('#slide-lid-apply').isDisabled());await page.locator('#slide-lid-labelDepth').fill('0.6');await ready();await page.locator('#slide-lid-labelSize').fill('12');await ready();assert.match(await page.locator('#slide-lid-label-info').textContent(),/縮小/);await apply();assert.equal((await save()).features.at(-1).spec.labelOperation,'engrave');
 await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.labelOperation,'emboss');await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.labelOperation,'engrave');await load(saved.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-labelText1').inputValue(),'小物');await page.locator('#slide-lid-labels').uncheck();await ready();await apply();assert.equal((await save()).features.at(-1).analysis.labels.length,0);
 assert.deepEqual(errors,[]);console.log('PASS Japanese/Latin real floor text, holes, floating/carved letters, fit scaling, floor guard, transparent preview and model display without CAD recalc, save/edit/undo/redo/reload');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
