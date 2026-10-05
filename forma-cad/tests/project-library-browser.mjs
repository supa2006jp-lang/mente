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



 let saveName='箱A';page.removeAllListeners('dialog');page.on('dialog',d=>d.accept(saveName));
 const A={format:'forma-cad',version:1,features:[{...defaults,id:'box',kind:'extrusion',name:'箱A',width:40,height:30,depth:20}]},B={...A,features:[{...defaults,id:'round',kind:'extrusion',name:'円柱B',profile:'circle',diameter:30,depth:40}]};
 async function load(data,name='model.forma.json'){await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);}
 async function save(name){saveName=name;const pending=page.waitForEvent('download');await page.locator('#save').click();const dl=await pending;return JSON.parse(await fs.readFile(await dl.path(),'utf8'));}
 async function gallery(count){await page.locator('#load-images').click();await page.waitForFunction(n=>document.querySelectorAll('.project-library-card').length===n,count);}
 async function chooseCard(name){await card(name).locator('.project-library-open').click();await page.locator('#project-load-preview').waitFor({state:'visible'});}
 const card=name=>page.locator('.project-library-card').filter({has:page.locator('.project-library-name',{hasText:name})});
 await gallery(0);assert.ok(await page.locator('#project-library-empty').isVisible());await page.locator('#project-library-close').click();
 await load(A);const savedA=await save('箱A');assert.ok(savedA.preview?.dataUrl);await load(B);const savedB=await save('円柱B');assert.ok(savedB.preview?.dataUrl);await gallery(2);
 assert.equal(await page.locator('.project-library-card img').count(),2);await card('箱A.forma.json').locator('img').evaluate(img=>img.decode());
 await page.locator('#project-library-search').fill('箱A');assert.equal(await page.locator('.project-library-card').count(),1);await page.locator('#project-library-search').fill('存在しない名前');assert.ok(await page.locator('#project-library-empty').isVisible());await page.locator('#project-library-search').fill('');await page.locator('#project-library-sort').selectOption('name');assert.equal(await page.locator('.project-library-name').count(),2);
 await chooseCard('箱A.forma.json');assert.equal(await page.locator('#project-preview-name').textContent(),'箱A.forma.json');assert.equal(await page.locator('#body-count').textContent(),'1');assert.equal(await page.locator('#bodies .row-label').first().textContent(),'円柱B');await page.locator('#project-preview-cancel').click();assert.equal(await page.locator('#bodies .row-label').first().textContent(),'円柱B');
 await gallery(2);await chooseCard('箱A.forma.json');await page.locator('#project-preview-open').click();assert.equal(await page.locator('#bodies .row-label').first().textContent(),'箱A');const same=await save('箱A');assert.deepEqual(same.features,A.features);await gallery(2);assert.equal(await page.locator('.project-library-card').count(),2,'identical filename and data deduplicate');await page.locator('#project-library-close').click();
 await page.reload();await page.locator('canvas').waitFor();await gallery(2);assert.equal(await page.locator('.project-library-card img').count(),2,'history survives reload');
 await page.locator('#project-library-files').setInputFiles([{name:'古いモデル.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(A))},{name:'<img src=x onerror=alert(1)>.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...B,preview:{version:1,dataUrl:'https://example.invalid/image.png',width:640,height:480}}))},{name:'壊れた.json',mimeType:'application/json',buffer:Buffer.from('{broken')}]);
 await page.waitForFunction(()=>document.getElementById('project-library-status').textContent.includes('2 件を追加しました'));assert.equal(await page.locator('.project-library-card').count(),4);assert.equal(await card('古いモデル.forma.json').locator('img').count(),0);assert.match(await card('古いモデル.forma.json').locator('.project-library-picture').textContent(),/画像なし/);assert.equal(await card('<img').locator('img').count(),0);assert.match(await page.locator('#project-library-status').textContent(),/1 件は追加できません/);
 await page.screenshot({path:'.sites-runtime/project-library-gallery.png'});
 await page.setViewportSize({width:600,height:800});assert.ok(await page.locator('#project-library').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'gallery fits narrow view');await page.screenshot({path:'.sites-runtime/project-library-mobile.png'});await page.setViewportSize({width:1900,height:1150});
 const dir='.sites-runtime/project-library-fixtures';await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'フォルダーの箱.forma.json'),JSON.stringify({...A,preview:savedA.preview}));await fs.writeFile(path.join(dir,'読み込まない.txt'),'not CAD');
 await page.locator('#project-library-directory').setInputFiles(path.resolve(dir));await page.waitForFunction(()=>document.getElementById('project-library-status').textContent.includes('1 件を追加しました'));assert.equal(await page.locator('.project-library-card').count(),5);assert.equal(await card('フォルダーの箱').locator('img').count(),1);
 await chooseCard('古いモデル');assert.ok(await page.locator('#project-preview-empty').isVisible());await page.locator('#project-preview-open').click();assert.equal(await page.locator('#bodies .row-label').first().textContent(),'箱A');
 // Edit a model so opening another card shows the existing unsaved-change warning.
 await page.locator('#features .row-label').first().click();await page.locator('#depth').fill('25');await page.locator('#apply').click();await gallery(5);assert.ok(await page.locator('#project-library-warning').isVisible());await chooseCard('円柱B');assert.ok(await page.locator('#project-preview-warning').isVisible());await page.locator('#project-preview-cancel').click();const edited=await save('編集した箱');assert.equal(edited.features[0].depth,25);
 await gallery(6);await card('古いモデル').locator('.project-library-remove').click();await page.waitForFunction(()=>document.querySelectorAll('.project-library-card').length===5);assert.ok(await fs.stat(path.join(dir,'フォルダーの箱.forma.json')),'removing a card never deletes a file');await page.locator('#project-library-close').click();await page.reload();await page.locator('canvas').waitFor();await gallery(5);assert.equal(await card('古いモデル').count(),0,'removed entry stays removed');await page.locator('#project-library-close').click();
 // Failed IndexedDB writes preserve file download; imports remain usable in memory.
 await load(A);await page.evaluate(()=>{window.nativeTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite')throw new DOMException('quota','QuotaExceededError');return window.nativeTransaction.call(this,names,mode,...args);};});
 const fallback=await save('保存領域エラー');assert.deepEqual(fallback.features,A.features);await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('画像一覧への登録に失敗'));await gallery(5);await page.locator('#project-library-files').setInputFiles({name:'一時的に開ける.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(B))});await page.waitForFunction(()=>document.getElementById('project-library-status').textContent.includes('一時表示'));await chooseCard('一時的に開ける');await page.locator('#project-preview-open').click();assert.equal(await page.locator('#bodies .row-label').first().textContent(),'円柱B');await gallery(6);await card('一時的に開ける').locator('.project-library-remove').click();await page.waitForFunction(()=>document.querySelectorAll('.project-library-card').length===5);await page.locator('#project-library-close').click();await page.evaluate(()=>IDBDatabase.prototype.transaction=window.nativeTransaction);
 assert.deepEqual(errors,[]);console.log('PASS saved-image gallery, real thumbnails, names/search/sort, deduplication, reload persistence, file/folder import, old/malformed previews, confirmation/cancel and unsaved protection, model data, remove-only-from-list and failed storage fallback');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
