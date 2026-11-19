import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {runOperation} from '../src/kernel.js';
import {supportHistoryFeature} from '../src/print-support-batch.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const features=[];
for(const [id,x] of [['body-a',0],['body-b',35]]){
 const shape=R.makeBox([x,0,12],[x+18,18,15]);
 try{features.push({id,kind:'cadop',name:id,outputs:[{id,...cadMesh(shape),brep:serializeCadShape(shape)}],remove:[]});}
 finally{shape.delete();}
}
const supportIds=['ribs-a','ribs-b'];
for(const [i,target] of ['body-a','body-b'].entries()){
 // The history from two separate applications has no shared batch ID or cached export package.
 const spec={id:supportIds[i],type:'printSupport',target,style:'walls',mode:'auto',baseMode:'bed',wallPitch:8,layerHeight:.3,topGap:.3};
 const result=runOperation(features,{...spec,preview:true});
 assert.equal(result.supportPreview.exportStatus.ok,true);
 assert.equal(result.analysis.supportExport,undefined);
 features.push(supportHistoryFeature(spec,result));
}
function checkCombinedFile(bytes,secondRib='ribs-b'){
 const files=unzipSync(bytes),model=strFromU8(files['3D/3dmodel.model']),config=strFromU8(files['Metadata/model_settings.config']);
 const parts=[...config.matchAll(/subtype="normal_part"><metadata key="name" value="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(parts.sort(),['body-a','body-b','ribs-a',secondRib].sort());
 assert.equal(config.match(/subtype="support_blocker"/g)?.length,2);
 assert.equal(model.match(/<item objectid=/g)?.length,1,'one shared print object in one 3MF');
 assert.match(config,/key="layer_height" value="0.3"/);
}
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1900,height:1080},acceptDownloads:true});
 page.setDefaultTimeout(60000);
 const errors=[],downloads=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('download',file=>downloads.push(file));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>{
  window.savedSupportRequests=[];
  window.supportPreviewIds={};
  const send=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...args){
   if(message.spec?.type==='printSupportSavedExport')window.savedSupportRequests.push(message.spec.ids);
   if(message.spec?.type==='printSupport'&&message.spec.preview)window.supportPreviewIds[message.spec.target]=message.spec.id;
   return send.call(this,message,...args);
  };
  window.showSaveFilePicker=async()=>{
   window.pickerActivated=navigator.userActivation.isActive;
   throw new DOMException('Cancelled by the user','AbortError');
  };
 });
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#canvas-host canvas').waitFor();
 async function loadProject(history,name){
  const buffer=Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:history}));
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer});
  await page.locator('#project-preview-open').click();
  await page.locator('#project-load-preview').waitFor({state:'hidden'});
 }
 await loadProject(features,'two-ribs.forma.json');
 const choose=page.locator('#export'),picker=page.locator('#export-dialog');
 const format=page.locator('#export-format'),selected=page.locator('#export-target option:checked'),exportButton=page.locator('#export-confirm');
 async function chooseCombined(){
  await choose.click();
  await picker.waitFor();
  await format.selectOption('support3mf');
  assert.equal(await selected.textContent(),'表示中のリブをまとめる（2件）');
  const contents=await page.locator('#export-contents li').allTextContents();
  assert.equal(contents.length,5);
  assert.ok(contents.some(row=>row.includes('body-b')));
 }
 await chooseCombined();
 await exportButton.click();
 await page.waitForFunction(()=>!document.getElementById('export').disabled);
 assert.equal(await page.evaluate(()=>window.pickerActivated),true);
 assert.deepEqual(await page.evaluate(()=>window.savedSupportRequests),[]);
 assert.equal(downloads.length,0);

 await page.evaluate(()=>window.showSaveFilePicker=undefined);
 await chooseCombined();
 const [download]=await Promise.all([page.waitForEvent('download'),exportButton.click()]);
 assert.match(download.suggestedFilename(),/\.3mf$/);
 assert.deepEqual(await page.evaluate(()=>window.savedSupportRequests),[supportIds]);
 assert.equal(downloads.length,1);
 checkCombinedFile(await readFile(await download.path()));

 const dialog=page.locator('#print-support-dialog'),field=id=>dialog.locator('[data-id="'+id+'"]');
 const direct=field('export-saved-3mf');
 await page.locator('#print-support-tool').click();
 await direct.waitFor();
 assert.match(await direct.textContent(),/設定済みのリブと本体を一括3MF出力（2件）/);
 await field('close').click();
 await dialog.waitFor({state:'hidden'});
 await page.locator('[data-history-feature="ribs-a"] button').click();
 await direct.waitFor();
 await page.waitForFunction(()=>document.querySelector('#print-support-dialog [data-id="export-state"]').dataset.state==='ready');
 assert.match(await direct.textContent(),/（2件）/,'the editing preview can hide a saved mesh without excluding it');
 const previewedRibVisibility=page.locator('#bodies [data-body-id="ribs-a"] .eye');
 assert.equal(await previewedRibVisibility.getAttribute('aria-pressed'),'true');
 await previewedRibVisibility.click();
 assert.equal(await previewedRibVisibility.getAttribute('aria-pressed'),'false');
 const includeHidden=field('saved-export-include-hidden');
 assert.equal(await includeHidden.isChecked(),true);
 assert.match(await direct.textContent(),/（2件）/,'an explicitly hidden saved support is included by default');
 await includeHidden.uncheck();
 assert.match(await direct.textContent(),/（1件）/);
 await includeHidden.check();
 assert.match(await direct.textContent(),/（2件）/);
 await field('close').click();
 await dialog.waitFor({state:'hidden'});
 await choose.click();
 await picker.waitFor();
 await format.selectOption('stl');
 assert.equal((await page.locator('#export-contents li').allTextContents()).length,3,'closing the preview does not show a hidden mesh again');
 await picker.getByRole('button',{name:'閉じる'}).click();
 await page.locator('#print-support-tool').click();
 await direct.waitFor();
 assert.equal(await includeHidden.isChecked(),true);
 assert.match(await direct.textContent(),/（2件）/);
 await field('layerHeight').fill('0.24');
 await direct.click();
 assert.equal(await format.inputValue(),'support3mf');
 const [directDownload]=await Promise.all([page.waitForEvent('download'),exportButton.click()]);
 assert.match(directDownload.suggestedFilename(),/\.3mf$/);
 assert.deepEqual(await page.evaluate(()=>window.savedSupportRequests),[supportIds,supportIds]);
 assert.equal(downloads.length,2);
 const bytes=await readFile(await directDownload.path());
 checkCombinedFile(bytes);
 assert.equal(await dialog.isVisible(),true);
 await field('close').click();
 await dialog.waitFor({state:'hidden'});

 await loadProject(features.slice(0,-1),'saved-rib-and-preview.forma.json');
 await page.locator('#print-support-tool').click();
 await field('target').selectOption('body-b');
 await field('baseMode').selectOption('bed');
 await page.waitForFunction(()=>document.querySelector('#print-support-dialog [data-id="export-state"]').dataset.state==='ready');
 assert.match(await direct.textContent(),/（1件）/);
 const together=field('export-saved-and-preview-3mf');
 assert.equal(await together.count(),1,'one saved support and a valid preview can be exported together');
 assert.match(await together.textContent(),/作成済み＋プレビューを一括3MF出力（2件）/);
 const previewId=await page.evaluate(()=>window.supportPreviewIds['body-b']);
 assert.ok(previewId);
 await together.click();
 assert.match(await page.locator('#export-contents').textContent(),/body-a.*body-b.*プレビュー中のリブ/);
 const [togetherDownload]=await Promise.all([page.waitForEvent('download'),exportButton.click()]);
 assert.match(togetherDownload.suggestedFilename(),/\.3mf$/);
 assert.deepEqual(await page.evaluate(()=>window.savedSupportRequests),[supportIds,supportIds,['ribs-a']]);
 assert.equal(downloads.length,3);
 assert.equal(await page.locator('#body-count').textContent(),'3','3MF export does not create a body in the project');
 assert.equal(await page.locator('#feature-count').textContent(),'3');
 assert.equal(await dialog.isVisible(),true);
 const combinedBytes=await readFile(await togetherDownload.path());
 checkCombinedFile(combinedBytes,previewId);
 if(process.env.FORMA_TEST_3MF)await writeFile(process.env.FORMA_TEST_3MF,combinedBytes);
 assert.deepEqual(errors,[]);
 console.log('PASS saved supports from both routes, hidden parts, and one saved plus one preview in a single 3MF without changing the project');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
