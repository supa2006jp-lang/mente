import {defaults} from '../src/geometry.js';
import {encodeProjectDocument} from '../src/project-codec.js';
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
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[],downloads=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('download',download=>downloads.push(download));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{
  window.fileTest={files:{},openName:'A.forma.json',saveName:'A.forma.json',picks:0,opens:0,cancel:false,fail:false,wait:false};
  const t=window.fileTest;
  function handle(name){return {name,async getFile(){return new File([t.files[name]||'{}'],name,{type:'application/json'});},async requestPermission(){return 'granted';},async createWritable(){let value;return {async write(text){value=text;if(t.wait)await new Promise(resolve=>t.release=resolve);if(t.fail)throw Error('ディスク書込エラー');},async close(){t.files[name]=value;},async abort(){t.aborts=(t.aborts||0)+1;}};}};}
  window.showOpenFilePicker=async()=>{t.opens++;if(t.cancel)throw new DOMException('cancel','AbortError');return [handle(t.openName)];};
  window.showSaveFilePicker=async()=>{t.picks++;if(t.cancel)throw new DOMException('cancel','AbortError');return handle(t.saveName);};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+prefix);await page.locator('#canvas-host canvas').waitFor();
 async function saveStatus(state,configured,hasTime=false){
  await page.waitForFunction(expected=>document.getElementById('project-save-state').dataset.state===expected,state);
  assert.equal(await page.locator('#project-save-target').getAttribute('data-configured'),String(configured));
  assert.equal(await page.locator('#project-save-time').isVisible(),hasTime);
  if(hasTime){assert.ok(Number.isFinite(Date.parse(await page.locator('#project-save-time').getAttribute('datetime'))));assert.match(await page.locator('#project-save-time').textContent(),/\d{2}:\d{2}:\d{2}/);}
 }
 await saveStatus('unsaved',false);
 const A={format:'forma-cad',version:1,units:'mm',features:[{...defaults,id:'box',kind:'extrusion',name:'箱A',width:40,height:30,depth:20}]};
 await page.evaluate(data=>window.fileTest.files['A.forma.json']=JSON.stringify(data),A);
 async function openNative(name,confirm=true){
  await page.evaluate(name=>window.fileTest.openName=name,name);
  await page.locator('#load').click();
  await page.locator(confirm?'#project-preview-open':'#project-preview-cancel').click();
  if(confirm)await page.waitForFunction(name=>document.getElementById('project-file-name').textContent===name&&document.getElementById('project-save-state').dataset.state==='loaded',name);
 }
 async function historyButtons(canUndo,canRedo){
  await page.waitForFunction(([undo,redo])=>document.getElementById('undo').disabled===!undo&&document.getElementById('redo').disabled===!redo,[canUndo,canRedo]);
 }
 async function edit(depth){await page.locator('#features .row-label').first().click();await page.locator('#depth').fill(String(depth));await page.locator('#apply').click();}
 async function overwrite(){await page.locator('#save-overwrite').click();await page.waitForFunction(()=>!document.getElementById('save-overwrite').disabled);}
 async function saved(name){return page.evaluate(name=>JSON.parse(window.fileTest.files[name]),name);}
 async function gallery(count){await page.locator('#load-images').click();await page.waitForFunction(n=>document.querySelectorAll('.project-library-card').length===n,count);}
 // An opened file has its disk handle only after confirmation.
 await openNative('A.forma.json');await saveStatus('loaded',true);await edit(22);await saveStatus('unsaved',true);await overwrite();await saveStatus('saved',true,true);assert.match(await page.locator('#project-save-time').textContent(),/最終保存/);assert.equal((await saved('A.forma.json')).features[0].depth,22);assert.equal(await page.evaluate(()=>window.fileTest.picks),0);assert.equal(downloads.length,0);assert.ok((await saved('A.forma.json')).preview?.dataUrl);
 await gallery(1);await page.locator('#project-library-close').click();
 await edit(24);await page.keyboard.press('Control+s');await page.waitForFunction(()=>!document.getElementById('save-overwrite').disabled);assert.equal((await saved('A.forma.json')).features[0].depth,24);
 await gallery(1);await page.locator('.project-library-open').click();await page.locator('#project-preview-cancel').click(); // canceled preview retains the original handle
 await openNative('A.forma.json');await edit(25);await overwrite();await gallery(1);await page.locator('#project-library-close').click(); // reopening a disk file replaces its exact stored snapshot

 await page.evaluate(data=>window.fileTest.files['B.forma.json']=JSON.stringify(data),{...A,features:[{...A.features[0],depth:90}]});
 await openNative('B.forma.json',false);await edit(26);await overwrite();assert.equal((await saved('A.forma.json')).features[0].depth,26);assert.equal((await saved('B.forma.json')).features[0].depth,90);
 // Failed writes do not clear dirty or update gallery contents.
 const beforeFailureTime=await page.locator('#project-save-time').getAttribute('datetime');await edit(28);await page.evaluate(()=>window.fileTest.fail=true);await overwrite();await saveStatus('error',true,true);assert.equal(await page.locator('#project-save-time').getAttribute('datetime'),beforeFailureTime);assert.match(await page.locator('#project-save-state').getAttribute('title'),/ディスク書込エラー/);assert.equal((await saved('A.forma.json')).features[0].depth,26);assert.equal(await page.locator('#dirty').textContent(),'•');
 await gallery(1);await page.locator('.project-library-open').click();await page.locator('#project-preview-open').click(); // gallery snapshot is 26, and intentionally detaches disk
 await saveStatus('loaded',false);
 await historyButtons(false,false);
 await page.evaluate(()=>{window.fileTest.fail=false;window.fileTest.saveName='A.forma.json';});
 await edit(30);await overwrite();await saveStatus('saved',true,true);assert.equal(await page.evaluate(()=>window.fileTest.picks),1);assert.equal((await saved('A.forma.json')).features[0].depth,30);
 await gallery(1);await page.locator('.project-library-open').click();await page.locator('#project-preview-open').click();
 assert.equal(await page.locator('#dirty').textContent(),'');await page.locator('#features .row-label').first().click();assert.equal(await page.locator('#depth').inputValue(),'30');
 // First overwrite cancellation retains unsaved content and never overwrites the previous file.
 await page.evaluate(()=>window.fileTest.cancel=true);await edit(32);await overwrite();await saveStatus('unsaved',false);assert.equal(await page.locator('#dirty').textContent(),'•');assert.equal((await saved('A.forma.json')).features[0].depth,30);
 await page.evaluate(()=>window.fileTest.cancel=false);await overwrite();await saveStatus('saved',true,true);assert.equal((await saved('A.forma.json')).features[0].depth,32);
 // Edits made while a write waits remain dirty and are saved by the next overwrite.
 await edit(34);await page.evaluate(()=>window.fileTest.wait=true);await page.locator('#save-overwrite').click();await page.waitForFunction(()=>!!window.fileTest.release);await saveStatus('saving',true,true);await edit(36);await page.evaluate(()=>{window.fileTest.wait=false;window.fileTest.release();delete window.fileTest.release;});await page.waitForFunction(()=>!document.getElementById('save-overwrite').disabled);assert.equal((await saved('A.forma.json')).features[0].depth,34);await saveStatus('unsaved',true,true);assert.equal(await page.locator('#dirty').textContent(),'•');await overwrite();assert.equal((await saved('A.forma.json')).features[0].depth,36);
 // Save-as keeps the existing download path and detaches the old file handle.
 const pending=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');const dl=await pending;await saveStatus('downloaded',false,true);assert.match(await page.locator('#project-save-time').textContent(),/出力/);const copy=JSON.parse(await fs.readFile(await dl.path(),'utf8'));assert.equal(copy.features[0].depth,36);
 await page.evaluate(()=>window.fileTest.saveName='copy.forma.json');await edit(38);const beforePicks=await page.evaluate(()=>window.fileTest.picks);await overwrite();assert.equal(await page.evaluate(()=>window.fileTest.picks),beforePicks+1);assert.equal((await saved('A.forma.json')).features[0].depth,36);assert.equal((await saved('copy.forma.json')).features[0].depth,38);
 // New document detaches target.
 await page.locator('#clear').click();await saveStatus('unsaved',false);await page.evaluate(()=>window.fileTest.saveName='empty.forma.json');await overwrite();assert.deepEqual((await saved('empty.forma.json')).features,[]);assert.equal((await saved('copy.forma.json')).features[0].depth,38);
 // Only a confirmed open starts a new undo history, even when both models share feature IDs.
 await openNative('A.forma.json');
 const savedA=await saved('A.forma.json');
 await edit(40);await edit(42);
 await page.locator('#undo').click();await historyButtons(true,true);
 await openNative('B.forma.json',false);await historyButtons(true,true);
 await page.evaluate(()=>{window.fileTest.files['invalid.forma.json']='{';window.fileTest.openName='invalid.forma.json';});
 await page.locator('#load').click();
 await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('読み込みできません'));
 await page.keyboard.press('Control+y');await historyButtons(true,false);
 await page.keyboard.press('Control+z');await historyButtons(true,true);

 await openNative('B.forma.json');await historyButtons(false,false);
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+y');
 await page.keyboard.press('Control+s');
 await page.waitForFunction(()=>document.getElementById('project-save-state').dataset.state==='saved'&&!document.getElementById('save-overwrite').disabled);
 assert.equal((await saved('B.forma.json')).features[0].depth,90);
 await edit(92);await page.locator('#undo').click();await historyButtons(false,true);
 await overwrite();assert.equal((await saved('B.forma.json')).features[0].depth,90);
 await page.locator('#redo').click();await historyButtons(true,false);
 await overwrite();assert.equal((await saved('B.forma.json')).features[0].depth,92);
 assert.deepEqual((await saved('A.forma.json')).features,savedA.features);

 const compressed=await encodeProjectDocument(A,{compress:true});
 await page.locator('#file').setInputFiles({name:'B.forma.json',mimeType:'application/json',buffer:Buffer.from(compressed.text)});
 await page.locator('#project-preview-open').click();
 await saveStatus('loaded',false);await historyButtons(false,false);
 console.log('PASS confirmed file opens isolate Undo/Redo and overwrite, including same-name file uploads; canceled and invalid opens preserve history');

 // Unsupported direct-write still allows downloading under a chosen name.
 await page.locator('#clear').click();await page.evaluate(()=>{delete window.showSaveFilePicker;});await overwrite();assert.match(await page.locator('#toast').textContent(),/名前を付けて保存/);const fallback=page.waitForEvent('download');await page.locator('#save').click();await fallback;await saveStatus('downloaded',false,true);
 // Exercise Chromium's real FileSystemFileHandle and transactional writable stream using origin-private storage.
 await page.locator('#clear').click();
 await page.evaluate(async data=>{const dir=await navigator.storage.getDirectory();window.realProjectHandle=await dir.getFileHandle('real-project.forma.json',{create:true});const stream=await window.realProjectHandle.createWritable();await stream.write(JSON.stringify(data));await stream.close();window.showOpenFilePicker=async()=>[window.realProjectHandle];},A);
 await openNative('real-project.forma.json');await edit(42);await overwrite();
 const realSaved=await page.evaluate(async()=>JSON.parse(await(await window.realProjectHandle.getFile()).text()));assert.equal(realSaved.features[0].depth,42);assert.ok(realSaved.preview?.dataUrl);
 await edit(44);await overwrite();assert.equal(await page.evaluate(async()=>JSON.parse(await(await window.realProjectHandle.getFile()).text()).features[0].depth),44);
 for(const width of [1280,1000,600]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('body > header').evaluate(header=>{const actions=header.querySelector('.file-actions'),box=actions.getBoundingClientRect();return box.right<=innerWidth+1&&box.left>=0&&actions.scrollWidth>=actions.clientWidth;}),'file actions remain reachable at '+width);assert.ok(await page.locator('#project-save-status').isVisible());assert.ok(await page.locator('#project-save-status').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height>0;}),'save state remains visible at '+width);if(width===1000)await page.screenshot({path:'.sites-runtime/project-save-status-narrow.png'});}
 await page.setViewportSize({width:1900,height:1150});
 assert.deepEqual(errors,[]);await page.screenshot({path:'.sites-runtime/project-save-status.png'});console.log('PASS disk overwrite, open handles, cancel-safe previews, repeated writes, gallery replacement, save failure/retry, async edits, shortcuts, save-as, new document, unsupported fallback and real FileSystemFileHandle writes; explicit status, last-save timestamps, cancel/failure preservation, download distinction and responsive status display');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
