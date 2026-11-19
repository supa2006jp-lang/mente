import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
const root=path.resolve('dist'),server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,file=p==='/export-dialog.js'?path.resolve('src/export-dialog.js'):path.resolve(root,'.'+(p==='/'?'/index.html':p));if(p!=='/export-dialog.js'&&!file.startsWith(root+path.sep))throw Error();const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
await fs.mkdir('.sites-runtime/support-slicing',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1900,height:1200},acceptDownloads:true}),errors=[],downloads=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d));page.on('dialog',d=>d.accept(d.defaultValue()));await page.addInitScript(()=>window.showSaveFilePicker=undefined);await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 const q=id=>page.locator('#print-support-dialog [data-id="'+id+'"]'),c=id=>page.locator('#export-'+id),doc=JSON.parse(await fs.readFile('tests/fixtures/print-support-default-frame.forma.json','utf8'));
 async function load(doc){await page.locator('#file').setInputFiles({name:'export.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function ready(){await page.waitForFunction(()=>!document.querySelector('#print-support-dialog [data-id=apply]').disabled);}
 async function choose(format='stl'){await page.locator('#export').click();await c('dialog').waitFor();await c('format').selectOption(format);}
 async function settled(){await page.waitForFunction(()=>!document.getElementById('export').disabled);}
 await load(doc);let event=page.waitForEvent('download');await choose();await c('confirm').click();let file=await event;assert.match(file.suggestedFilename(),/\.stl$/);assert(await c('dialog').isHidden());await settled();await page.keyboard.press('Escape');await load(doc);
 await page.locator('#print-support-tool').click();
 assert.equal(await q('sideGap').inputValue(),'0.5');
 await ready();await q('apply').click();await page.locator('#print-support-dialog').waitFor({state:'hidden'});
 const made=await save(),count=downloads.length;
 assert.equal(made.features.at(-1).spec.sideGap,.5);
 await choose('support3mf');assert.match(await c('contents').textContent(),/リブ/);await page.screenshot({path:'.sites-runtime/print-support-export-choice.png'});await c('cancel').click();await settled();assert.equal(downloads.length,count);assert.deepEqual((await save()).features,made.features);
 await choose();await page.keyboard.press('Escape');await settled();assert(await c('dialog').isHidden());
 await choose();event=page.waitForEvent('download');await c('confirm').click();file=await event;assert.match(file.suggestedFilename(),/\.stl$/);const stl=await fs.readFile(await file.path());assert.equal(stl.length,84+50*stl.readUInt32LE(80));await settled();await page.keyboard.press('Escape');
 await choose('support3mf');await c('target').selectOption(await c('target').getByRole('option',{name:/の形状を使う/}).getAttribute('value'));await c('confirm').click();await ready();assert.equal(await q('style').inputValue(),'walls');assert(await q('export3mf').evaluate(el=>el===document.activeElement));await page.screenshot({path:'.sites-runtime/print-support-export-route.png'});event=page.waitForEvent('download');await q('export3mf').click();file=await event;assert.match(file.suggestedFilename(),/\.3mf$/);const buffer=await fs.readFile(await file.path()),zip=unzipSync(buffer),config=strFromU8(zip['Metadata/model_settings.config']);assert.match(config,/subtype="support_blocker"/);assert.match(config,/key="layer_height" value="0.3"/);assert.doesNotMatch(config,/enable_support/);await fs.writeFile('.sites-runtime/support-slicing/guided-export.3mf',buffer);await q('cancel').click();assert.deepEqual((await save()).features,made.features,'guided export preserves history');assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual(errors,[]);
 // A stale selection cannot start a save.
 const unit=await browser.newPage();await unit.goto('http://127.0.0.1:'+server.address().port+'/export-dialog.js');
 await unit.evaluate(async()=>{
  document.body.replaceChildren();
  const {createExportDialog}=await import('/export-dialog.js');
  const dialog=createExportDialog();
  window.saved=0;window.valid=true;
  dialog.open({initial:'stl',isCurrent:()=>window.valid,choices:[{id:'stl',label:'STL',entries:[
   {label:'選択したボディ',rows:[{label:'ボディA'}],run:()=>{window.saved++;}},
  ]}]});
 });
 await unit.evaluate(()=>{window.valid=false;});
 await unit.locator('#export-confirm').click();
 assert.equal(await unit.evaluate(()=>window.saved),0);
 assert.match(await unit.locator('#export-detail').textContent(),/出力対象が変わりました/);
 await unit.close();
 await fs.writeFile('.sites-runtime/print-support-export-guidance-proof.json',JSON.stringify({checkedAt:new Date().toISOString(),pass:true,normalStl:true,cancelAndEscape:true,intentionalStl:true,guided3mf:true,blockerMetadata:true,layerHeight:.3,historyUnchanged:true,multipleSources:true,staleModelAndVisibility:true},null,2));
 console.log('PASS global STL guidance, cancel/Escape, intentional STL, guided support reedit + 3MF with blockers, unchanged history, multiple choices and stale model/visibility cancellation');
}finally{await browser.close();await new Promise(r=>server.close(r));}
