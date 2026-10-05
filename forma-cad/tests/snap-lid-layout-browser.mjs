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


 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30,z:3},upper={...base,id:'lid',name:'上のボディ',z:33,depth:12};
 async function load(features){await page.locator('#file').setInputFiles({name:'divider.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('snap-lid-apply').disabled,null,{timeout:90000});}catch{throw Error(await page.locator('#snap-lid-error').textContent());}}
 async function apply(){await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);}

 await load([base,upper]);await page.locator('#snap-lid-tool').click();await ready();
 assert.equal(await page.locator('#snap-lid-clearance').inputValue(),'0.25');
 await page.locator('#snap-lid-divider').check();await ready();
 await page.locator('#snap-lid-dividerCompartments').selectOption('4');await ready();assert.equal(await page.locator('#snap-lid-divider-offsets input').count(),3);
 await page.locator('#snap-lid-dividerOffset0').fill('-3');await ready();await page.locator('#snap-lid-dividerOffset1').fill('2');await ready();
 await page.locator('#snap-lid-filletInside').check();await ready();assert.match(await page.locator('#snap-lid-divider-info').textContent(),/4分割.*各部屋の幅/);
 await page.locator('#snap-lid-dividerOffset0').fill('100');await page.waitForFunction(()=>document.getElementById('snap-lid-error').textContent.includes('空間が足りません'));assert.ok(await page.locator('#snap-lid-apply').isDisabled());await page.locator('#snap-lid-dividerOffset0').fill('-3');await ready();
 const jobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#snap-lid-preset-name').fill('PLA・4分割');await page.locator('#snap-lid-preset-name').press('Enter');assert.match(await page.locator('#snap-lid-preset-status').textContent(),/保存しました/);assert.ok(await page.locator('#snap-lid-dialog').isVisible());await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.cadJobs.length),jobs,'typing/saving a name must not recalculate geometry');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-snap-lid-presets-v1')));assert.equal(stored.presets.length,1);assert.equal(stored.presets[0].values.dividerCompartments,4);assert.deepEqual(stored.presets[0].values.dividerOffsets,[-3,2,0]);assert.ok(!('target' in stored.presets[0].values));assert.ok(!('openingFace' in stored.presets[0].values));
 await page.locator('#snap-lid-divider-equal').click();await ready();assert.equal(await page.locator('#snap-lid-dividerOffset0').inputValue(),'0');
 await page.locator('#snap-lid-dividerCompartments').selectOption('2');await ready();assert.equal(await page.locator('#snap-lid-divider-offsets input').count(),1);
 await page.locator('#snap-lid-preset-apply').click();await ready();assert.equal(await page.locator('#snap-lid-dividerCompartments').inputValue(),'4');assert.equal(await page.locator('#snap-lid-dividerOffset0').inputValue(),'-3');assert.equal(await page.locator('#snap-lid-target').inputValue(),'body');assert.equal(await page.locator('#snap-lid-lidTarget').inputValue(),'lid');assert.ok(await page.locator('#snap-lid-filletInside').isChecked());
 await page.locator('#snap-lid-dividerOffset2').fill('1');await ready();await page.locator('#snap-lid-preset-save').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-snap-lid-presets-v1')).presets.length),1,'same name updates');
 await page.locator('#snap-lid-dividerCompartments').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/snap-lid-layout-preview.png'});await apply();
 const saved=await save(),feature=saved.features.at(-1);assert.equal(feature.spec.dividerCompartments,4);assert.deepEqual(feature.spec.dividerOffsets,[-3,2,1]);assert.equal(feature.analysis.divider.compartments,4);assert.equal(feature.outputs.length,2);
 await page.locator('#undo').click();assert.equal((await save()).features.length,2);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.dividerCompartments,4);
 await load(saved.features);await page.locator('#bodies [data-snap-lid-id]').first().click();await ready();assert.equal(await page.locator('#snap-lid-dividerCompartments').inputValue(),'4');assert.equal(await page.locator('#snap-lid-dividerOffset1').inputValue(),'2');await page.locator('#snap-lid-dividerCompartments').selectOption('3');await ready();await apply();assert.equal((await save()).features.at(-1).analysis.divider.compartments,3);
 await page.reload();await page.locator('canvas').waitFor();await load([base,upper]);await page.locator('#snap-lid-tool').click();await ready();await page.locator('#snap-lid-preset-select').selectOption('PLA・4分割');await page.locator('#snap-lid-preset-apply').click();await ready();assert.equal(await page.locator('#snap-lid-dividerOffset2').inputValue(),'1');
 await page.locator('#snap-lid-preset-delete').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-snap-lid-presets-v1')).presets.length),0);assert.ok(await page.locator('#snap-lid-preset-apply').isDisabled());await page.locator('#snap-lid-cancel').click();
 // A blocked storage write is visible and preserves the values/name.
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError');};});
 await page.locator('#snap-lid-tool').click();await ready();await page.locator('#snap-lid-preset-name').fill('保存失敗テスト');await page.locator('#snap-lid-preset-save').click();assert.match(await page.locator('#snap-lid-preset-status').textContent(),/保存できません/);assert.equal(await page.locator('#snap-lid-preset-name').inputValue(),'保存失敗テスト');assert.equal(await page.locator('#snap-lid-target').inputValue(),'body');await page.locator('#snap-lid-cancel').click();
 assert.deepEqual(errors,[]);console.log('PASS 2/3/4 compartments, individual offsets, equal reset, minimum clearance guard, native fillets, presets save/update/apply/delete/reload, target preservation, storage failure, model reload/edit and undo/redo');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
