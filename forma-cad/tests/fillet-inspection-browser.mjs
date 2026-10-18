import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const outside=R.drawRoundedRectangle(120,45,22.5).sketchOnPlane().extrude(50),shell=outside.shell(2,f=>f.inPlane('XY',50));
const project={format:'forma-cad',version:1,features:[{id:'source',kind:'cadop',name:'円弧と直線のシェル',outputs:[{id:'body',brep:shell.serialize(),...shell.mesh()}],remove:[]}]};shell.delete();outside.delete();
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname,mode=pathname.split('/')[1],relative=pathname.replace(/^\/(stall-first|normal|stall)/,''),file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  let data=await fs.readFile(file);
  // Fault injection is served only by this test server. A synchronous busy
  // worker proves the main-thread watchdog really terminates native stalls.
  if(file.endsWith('kernel-worker.js')&&mode.startsWith('stall')){
   const trial=mode==='stall-first'?1:2;
   data=Buffer.concat([Buffer.from(`const testPost=self.postMessage.bind(self);let testTrials=0;self.postMessage=(value,...args)=>{testPost(value,...args);if(value.progress?.filletTrial==='start'&&++testTrials===${trial}){const start=Date.now();while(Date.now()-start<60000){}}};\n`),data]);
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),proof=[];
try{
 for(const mode of ['normal','stall','stall-first']){
  const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
  await page.addInitScript(()=>{
   window.testFilletJobs=[];window.testTerminated=[];window.testTrialStarts=[];
   const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate,Base=Worker;
   window.Worker=new Proxy(Base,{construct(Target,args){const worker=Reflect.construct(Target,args);worker.addEventListener('message',({data})=>{if(data.progress?.filletTrial==='start')window.testTrialStarts.push(performance.now());});return worker;}});
   Base.prototype.postMessage=function(payload,...args){if(payload.spec?.type==='fillet'||payload.spec?.operation?.type==='fillet')window.testFilletJobs.push(payload.spec);return post.call(this,payload,...args);};
   Base.prototype.terminate=function(){window.testTerminated.push(performance.now());return terminate.call(this);};
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+mode+'/');await page.locator('#canvas-host canvas').waitFor();
  await page.locator('#file').setInputFiles({name:'inspection.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
  await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('fillet');
  let accepted=0,guardMs=null;
  if(mode==='stall-first'){
   await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('まだ適用できる辺を確認できていません'),null,{timeout:30000});
   assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-preview'),null);await page.locator('#cad-cancel').click();
  }else{
   accepted=mode==='normal'?12:6;
   await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='fillet',null,{timeout:30000});
   assert.match(await page.locator('#cad-error').textContent(),new RegExp('一部のみ適用可能.*'+accepted+'辺'));
   if(mode==='stall')assert.match(await page.locator('#cad-error').textContent(),/時間の掛かる輪郭を保留/);
   const jobs=await page.evaluate(()=>window.testFilletJobs.length);
   await page.screenshot({path:'.sites-runtime/fillet-guard-'+mode+'.png'});
   await page.locator('#cad-apply').click();await page.locator('#partial-fillet-confirm').waitFor();
   if(mode==='stall')assert.match(await page.locator('#partial-fillet-confirm [data-budget]').textContent(),/時間上限.*18本.*未確認/);
   await page.locator('#partial-fillet-confirm [data-accept]').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);
   assert.equal(await page.evaluate(()=>window.testFilletJobs.length),jobs,'confirmation must reuse the exact completed or recovered shape');assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'true');
  }
  if(mode!=='normal'){
   const times=await page.evaluate(()=>({starts:window.testTrialStarts,ends:window.testTerminated}));assert.ok(times.ends.length>0);guardMs=times.ends[0]-times.starts.at(-1);assert.ok(guardMs>=3900&&guardMs<8000,'stuck native trial is stopped by the four-second watchdog');
  }
  const download=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
  assert.equal(saved.features.length,accepted?2:1);assert.equal(saved.features[0].outputs[0].brep,project.features[0].outputs[0].brep);
  if(accepted){const last=saved.features.at(-1);assert.equal(last.spec.partialMode,undefined);assert.equal(last.spec.radius,2);assert.equal(last.spec.edges.length,accepted);const shape=R.deserializeShape(last.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();shape.delete();}}
  assert.deepEqual(errors,[]);proof.push({mode,accepted,guardMs,errors});await context.close();
 }
 console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/fillet-guard-browser-proof.json',JSON.stringify(proof,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
