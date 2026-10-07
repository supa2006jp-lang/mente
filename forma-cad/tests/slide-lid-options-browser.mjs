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




 const base={...defaults,id:'body',kind:'extrusion',name:'長方形',width:80,height:50,depth:30,z:3};
 async function load(features){await page.locator('#file').setInputFiles({name:'slide-options.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('slide-lid-apply').disabled,null,{timeout:90000});}catch{throw Error(await page.locator('#slide-lid-error').textContent());}}
 async function apply(){await page.locator('#slide-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('slide-lid-dialog').open);}
 await load([base]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();await page.locator('#slide-lid-clearance').fill('0.25');await page.locator('#slide-lid-railDepth').fill('1.2');await ready();
 for(const key of ['filletInside','filletOutside','divider']){assert.ok(!(await page.locator('#slide-lid-'+key).isChecked()),key+' must be opt-in');await page.locator('#slide-lid-'+key).check();await ready();}
 assert.equal(await page.locator('#slide-lid-lock').count(),0);assert.match(await page.locator('#slide-lid-info').textContent(),/開閉経路とも干渉なし/);assert.match(await page.locator('#slide-lid-fillet-info').textContent(),/本体・仕切りの内角と底：R1.00/);
 await page.locator('#slide-lid-dividerCompartments').selectOption('4');await ready();assert.equal(await page.locator('#slide-lid-divider-offsets input').count(),3);await page.locator('#slide-lid-dividerOffset0').fill('-2');await ready();await page.locator('#slide-lid-dividerOffset1').fill('1');await ready();assert.match(await page.locator('#slide-lid-divider-info').textContent(),/4分割.*蓋とのすき間 0.25 mm/);
 await page.locator('#slide-lid-dividerOffset0').fill('100');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('空間が足りません'));assert.ok(await page.locator('#slide-lid-apply').isDisabled());assert.equal((await save()).features.length,1,'invalid preview cannot commit');await page.locator('#slide-lid-divider-equal').click();await ready();assert.equal(await page.locator('#slide-lid-dividerOffset0').inputValue(),'0');
 await page.locator('#slide-lid-dividerDirection').selectOption('long');await ready();await page.locator('#slide-lid-innerFilletRadius').fill('100');await ready();assert.match(await page.locator('#slide-lid-fillet-info').textContent(),/半径を調整/);await page.locator('#slide-lid-innerFilletRadius').fill('1');await ready();await page.locator('#slide-lid-pose').selectOption('assembled');await ready();await page.locator('#slide-lid-openAmount').fill('100');await page.locator('#slide-lid-filletInside').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/slide-lid-options-preview.png'});await apply();
 const saved=await save(),op=saved.features.at(-1);assert.equal(op.spec.lock,false);assert.equal(op.spec.filletInside,true);assert.equal(op.spec.filletOutside,true);assert.equal(op.spec.divider,true);assert.equal(op.spec.dividerCompartments,4);assert.equal(op.spec.dividerDirection,'long');assert.deepEqual(op.spec.dividerOffsets,[0,0,0]);assert.equal(op.analysis.overlap,0);assert.equal(op.analysis.slidingOverlap,0);assert.equal(op.analysis.lock,null);assert.equal(op.analysis.divider.zMax,op.analysis.grooveLower);assert.equal(op.outputs.length,2);
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).analysis.divider.compartments,4);
 await load(saved.features);await page.locator('#bodies [data-slide-lid-id]').first().click();await ready();for(const key of ['filletInside','filletOutside','divider'])assert.ok(await page.locator('#slide-lid-'+key).isChecked());assert.equal(await page.locator('#slide-lid-dividerDirection').inputValue(),'long');assert.equal(await page.locator('#slide-lid-divider-offsets input').count(),3);await page.locator('#slide-lid-dividerCompartments').selectOption('3');await ready();await page.locator('#slide-lid-dividerOffset1').fill('1');await ready();await apply();const edited=await save();assert.equal(edited.features.at(-1).id,op.id);assert.equal(edited.features.at(-1).analysis.lock,null);assert.deepEqual(edited.features.at(-1).analysis.divider.offsets,[0,1]);
 await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();for(const key of ['filletInside','filletOutside','divider']){await page.locator('#slide-lid-'+key).uncheck();await ready();}assert.ok(await page.locator('#slide-lid-dividerOffset0').isDisabled());await apply();const removed=await save();for(const key of ['lock','fillet','divider'])assert.equal(removed.features.at(-1).analysis[key],null);assert.equal(removed.features.at(-1).outputs.length,2);
 // A previous version with no new option fields continues to open without enabling them.
 const legacy=structuredClone(removed.features);for(const key of ['lock','lockHeight','filletInside','filletOutside','innerFilletRadius','outerFilletRadius','divider','dividerThickness','dividerDirection','dividerCompartments','dividerOffsets'])delete legacy.at(-1).spec[key];await load(legacy);await page.locator('#features .tree-row').last().locator('.row-label').click();await ready();for(const key of ['filletInside','filletOutside','divider'])assert.ok(!(await page.locator('#slide-lid-'+key).isChecked()));await page.locator('#slide-lid-cancel').click();
 assert.deepEqual(errors,[]);console.log('PASS removed locking, inside/outside fillets, 2/3/4 adjustable dividers, equal reset, invalid preview guard, radius clamp, open preview, save/load/edit, undo/redo, disable options and legacy files');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
