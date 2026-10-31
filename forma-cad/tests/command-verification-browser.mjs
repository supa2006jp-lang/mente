import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {defaults} from '../src/geometry.js';
const out='.sites-runtime/command-verification';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1700,height:1100},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));page.setDefaultTimeout(90000);
async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));}
async function load(features){await page.locator('#file').setInputFiles({name:'verification.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);}
async function cut(){await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('join');await page.locator('#cad-target').selectOption('base');await page.locator('#cad-other').selectOption('tool');await page.locator('#cad-combineMode').selectOption('切り取り');await page.locator('#cad-keepTools').selectOption('削除');}
try{
 await page.addInitScript(()=>{
  window.showSaveFilePicker=undefined;
  // Retain a real worker response only in this isolated test. Mutating it after
  // the preview is displayed simulates a stale/corrupted final prepared result.
  const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);this.requests=new Map();this.addEventListener('message',event=>{const spec=this.requests.get(event.data.id);if(spec?.type==='preview'&&spec.operation?.type==='join'&&event.data.result)window.__verificationPreview=event.data.result;});}
   postMessage(data,...rest){this.requests.set(data.id,data.spec);return super.postMessage(data,...rest);}
  };
 });
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:5188/');
 const base={...defaults,id:'base',kind:'extrusion',name:'base',width:20,height:20,depth:10},tool={...base,id:'tool',name:'tool',width:4,height:4,x:40};
 await load([base,tool]);const untouched=(await save()).features;await cut();await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('重なっていません'));
 assert.match(await page.locator('#cad-failure-evidence').innerText(),/隙間.*最短距離/);assert.match(await page.locator('#cad-failure-suggestion').innerText(),/内側まで届く/);assert.deepEqual((await save()).features,untouched);await page.screenshot({path:out+'/measured-gap.png'});await page.locator('#cad-cancel').click();
 await load([base,{...tool,x:0}]);const before=(await save()).features;await cut();
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='join'&&window.__verificationPreview?.outputs[0]?.shapeMetrics);
 await page.evaluate(()=>{window.__verificationPreview.outputs[0].shapeMetrics.volume*=.5;});
 await page.locator('#cad-apply').click();await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('プレビューと確定結果が一致しない'));
 assert.match(await page.locator('#cad-failure-evidence').innerText(),/体積.*プレビュー/);assert.equal(await page.locator('#body-count').innerText(),'2');assert.deepEqual((await save()).features,before,'rejected result preserves the full original document');await page.screenshot({path:out+'/mismatch-rejected.png'});
 await page.waitForFunction(()=>/失敗時の記録（[1-3]）/.test(document.getElementById('failure-recovery-open').textContent));
 const records=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('forma-cad-failure-recovery-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{db.close();resolve(r.result.map(row=>JSON.parse(row.text)));};};}));
 assert.ok(records.some(r=>r.error.code==='preview-mismatch'&&r.document.features.length===before.length),'mismatch has a recoverable original document');
 await page.locator('#cad-cancel').click();await cut();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='join');await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);
 const after=(await save()).features;assert.equal(after.length,before.length+1);assert.equal(await page.locator('#body-count').innerText(),'1');await page.locator('#undo').click();assert.deepEqual((await save()).features,before);await page.locator('#redo').click();assert.deepEqual((await save()).features,after);assert.deepEqual(errors,[]);
 const proof={pass:true,measuredGap:true,previewMismatchRejected:true,sourceAndHistoryPreserved:true,failureRecorded:true,normalCommit:true,undoRedo:true,errors};await fs.writeFile(out+'/browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){await page.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();}
