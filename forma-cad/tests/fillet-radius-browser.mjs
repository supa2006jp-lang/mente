import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const slab=R.makeBox([0,0,0],[20,12,2]),cube=R.makeBox([30,0,0],[40,10,10]),project={format:'forma-cad',version:1,features:[{id:'seed',kind:'cadop',name:'半径検査',outputs:[['slab',slab],['cube',cube]].map(([id,s])=>({id,brep:s.serialize(),...s.mesh()})),remove:[]}]};slab.delete();cube.delete();
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname,mode=pathname.split('/')[1],relative=pathname.replace(/^\/(normal|expand|bounded|use|stall-first|stall)/,''),file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}let data=await fs.readFile(file);
 if(file.endsWith('kernel-worker.js')&&(mode.startsWith('stall')||mode==='use'))data=Buffer.concat([Buffer.from(`let radiusRequest=false,radiusTrials=0;self.addEventListener('message',({data})=>{radiusRequest=data.spec?.type==='filletRadiusSearch';});const realPost=self.postMessage.bind(self);self.postMessage=(v,...args)=>{realPost(v,...args);if(radiusRequest&&v.progress?.filletTrial==='start'&&++radiusTrials===${mode==='stall-first'?1:4}){const start=Date.now();while(Date.now()-start<60000){}}};\n`),data]);
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),proof=[];
try{for(const mode of ['normal','expand','bounded','use','stall','stall-first']){
 const context=await browser.newContext({viewport:{width:1700,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.radiusJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec?.type==='filletRadiusSearch'||payload.spec?.type==='fillet'||payload.spec?.operation?.type==='fillet')window.radiusJobs.push(payload.spec);return post.call(this,payload,...args);};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/'+mode+'/');await page.locator('#canvas-host canvas').waitFor();
 await page.locator('#file').setInputFiles({name:'radius.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
 await page.locator('#bodies [data-body-id="slab"] .row-label').click();await page.locator('#bodies [data-body-id="cube"] .row-label').click({modifiers:['Control']});
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('fillet');assert.ok(await page.locator('#cad-selection-all').isChecked());if(['expand','bounded'].includes(mode))await page.locator('#cad-radius').fill('0.25');assert.ok(await page.locator('#fillet-radius-expand').isChecked());if(mode==='bounded')await page.locator('#fillet-radius-expand').uncheck();assert.ok(await page.locator('#fillet-radius-use').isDisabled());await page.locator('#fillet-radius-search').click();
 if(mode==='use'){await page.locator('#fillet-radius-use').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('fillet-radius-use').disabled);await page.locator('#fillet-radius-use').click();}
 await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled&&(document.getElementById('fillet-radius-status').textContent.includes('適用します')||document.getElementById('fillet-radius-status').textContent.includes('まだ確認できていません')),null,{timeout:30000});
 const save=async()=>{const download=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await download).path(),'utf8'));};
 if(mode==='stall-first'){
  assert.equal(await page.locator('#cad-radius').inputValue(),'2');assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-preview'),null);assert.ok(await page.locator('#cad-apply').isEnabled());
  await page.locator('#fillet-radius-search').click();await page.waitForFunction(()=>document.getElementById('fillet-radius-status').textContent.includes('検査しています'));await page.locator('#fillet-radius-search').click();assert.match(await page.locator('#fillet-radius-status').textContent(),/中止しました/);assert.ok(await page.locator('#cad-apply').isEnabled());
  await page.locator('#fillet-radius-search').click();await page.locator('#cad-radius').fill('1.5');assert.equal(await page.locator('#fillet-radius-status').textContent(),'');await page.locator('#cad-cancel').click();assert.equal((await save()).features.length,1);
 }else{
  const radius=Number(await page.locator('#cad-radius').inputValue());assert.equal(radius,mode==='bounded'?.25:['normal','expand'].includes(mode)?.99:.5);assert.match(await page.locator('#fillet-radius-verified').textContent(),/2ボディ・24辺/);if(mode==='stall')assert.match(await page.locator('#fillet-radius-status').textContent(),/検査上限/);
  if(mode==='use')assert.match(await page.locator('#fillet-radius-status').textContent(),/確認済みの値で検査を終了/);
  if(mode==='expand')assert.match(await page.locator('#fillet-radius-status').textContent(),/入力値を超えて/);
  if(mode!=='bounded'){const marker=JSON.parse(await page.locator('#canvas-host').getAttribute('data-fillet-radius-limit'));assert.deepEqual(marker.bodyIds,['slab']);assert.ok(marker.radius>radius);assert.match(await page.locator('#fillet-radius-limit').textContent(),/(赤|橙)/);
  const beforeToggle=await page.evaluate(()=>window.radiusJobs.length);await page.locator('#fillet-radius-show-limit').uncheck();assert.equal(await page.locator('#canvas-host').getAttribute('data-fillet-radius-limit'),null);await page.locator('#fillet-radius-show-limit').check();assert.ok(await page.locator('#canvas-host').getAttribute('data-fillet-radius-limit'));assert.equal(await page.evaluate(()=>window.radiusJobs.length),beforeToggle);}else{assert.equal(await page.locator('#canvas-host').getAttribute('data-fillet-radius-limit'),null);assert.match(await page.locator('#fillet-radius-status').textContent(),/上限 R0.25 mm以下/);}
  assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-preview'),'fillet');assert.ok(await page.locator('#cad-apply').isEnabled());if(mode==='normal'){await page.locator('#fillet-radius-limit').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/fillet-radius-improvements-preview.png'});}
  const jobs=await page.evaluate(()=>window.radiusJobs.length);await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'true');assert.equal(await page.evaluate(()=>window.radiusJobs.length),jobs);assert.equal(await page.locator('#partial-fillet-confirm').count(),0);assert.equal(await page.locator('#canvas-host').getAttribute('data-fillet-radius-limit'),null);
  const saved=await save(),last=saved.features.at(-1);assert.equal(saved.features.length,2);assert.equal(last.spec.radius,radius);assert.equal(last.analysis.partialFillet,undefined);assert.equal(last.outputs.length,2);assert.equal(saved.features[0].outputs[0].brep,project.features[0].outputs[0].brep);for(const o of last.outputs){const shape=R.deserializeShape(o.brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();shape.delete();}}
  await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.length,2);
 }
 assert.deepEqual(errors,[]);proof.push({mode,cacheApplied:mode!=='stall-first',errors});await context.close();
}console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/fillet-radius-improvements-browser-proof.json',JSON.stringify(proof,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
