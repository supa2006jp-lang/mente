import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {defaults} from '../src/geometry.js';
const out='.sites-runtime/adaptive-workflow',root=path.resolve('dist');await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
try{
 await page.route('**/model-rebuild-worker.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nconst run=self.onmessage;self.onmessage=e=>setTimeout(()=>run(e),700);'});});
 await page.addInitScript(()=>{window.jobs=[];window.stages=[];const Original=window.Worker;window.Worker=class extends Original{constructor(url,options){super(url,options);this.url=String(url);this.addEventListener('message',event=>{if(event.data.progress?.stage)window.stages.push(event.data.progress.stage);});}postMessage(m,...rest){window.jobs.push({worker:this.url,type:m.spec?.type,operation:m.spec?.operation,angle:m.spec?.angle,id:m.spec?.id,start:performance.now()});return super.postMessage(m,...rest);}};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('.navigation .precision-preview-mode').waitFor({state:'visible'});
 const put=features=>page.locator('#file').setInputFiles({name:'precision.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))}),open=async()=>{await page.locator('#project-preview-open').click();await page.locator('#project-load-preview').waitFor({state:'hidden'});},load=async features=>{await put(features);await open();},save=async()=>{const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));};
 const first={...defaults,kind:'extrusion',id:'legacy',name:'base',width:20,height:20,depth:12},cut={...first,name:'cut',id:'cut',operation:'cut',target:'legacy',width:8,height:8,depth:6,z:6},legacy=[first,cut];
 await put(legacy);await page.waitForFunction(()=>window.jobs.some(j=>j.type==='legacyDisplayRebuild'));const frameMs=await page.evaluate(async()=>{const start=performance.now();await new Promise(r=>setTimeout(r,20));return performance.now()-start;});assert.ok(frameMs<350,'main event loop delay '+frameMs);await open();assert.equal(await page.locator('#body-count').textContent(),'1');assert.deepEqual((await save()).features,legacy);rows.push({case:'legacy-load',backgroundWorker:true,frameMs,inputHistoryPreserved:true});
 await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='0');await page.locator('#redo').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');assert.deepEqual((await save()).features,legacy);
 const alternate=[{...defaults,kind:'sketch',id:'replacement',name:'replacement',groupId:'replace-group',groupNumber:1,groupHidden:false}];await page.evaluate(()=>window.jobs=[]);await put([{...first,width:24},cut]);await page.waitForFunction(()=>window.jobs.some(j=>j.type==='legacyDisplayRebuild'));await load(alternate);await page.waitForTimeout(1000);assert.deepEqual((await save()).features,alternate);rows.push({case:'stale-legacy-load',ignored:true,undoRedo:true});
 const boxes=[{...defaults,id:'a',name:'A',width:10,height:10,depth:10},{...defaults,id:'b',name:'B',width:10,height:10,depth:10,x:5}];await load(boxes);
 await page.locator('.navigation .precision-preview-mode').selectOption('manual');await page.locator('#join-tool').click();await page.locator('#cad-target').selectOption('a');await page.locator('#cad-other').selectOption('b');await page.locator('#cad-combineMode').selectOption('切り取り');await page.waitForFunction(()=>document.querySelector('#tools-dialog .precision-preview-confirm:not([disabled])'));await page.evaluate(()=>window.jobs=[]);await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.jobs.filter(j=>j.type==='preview'||j.type==='meshCombinePreview').length),0);
 await page.locator('#tools-dialog .precision-preview-confirm').click();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreviewPhase==='precise',null,{timeout:30000});assert.ok(await page.evaluate(()=>window.jobs.some(j=>j.type==='preview')));await page.locator('#cad-cutClearance').fill('.2');await page.waitForTimeout(900);const shapeJobs=await page.evaluate(()=>window.jobs.filter(j=>j.type==='preview').length);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.jobs.filter(j=>j.type==='preview').length),shapeJobs);assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-preview-phase'),'draft');
 await page.screenshot({path:out+'/manual-preview.png'});await page.locator('#cad-cancel').click();rows.push({case:'manual-mode',noAutomaticExactJobs:true,explicitConfirmation:true,settingChangesReturnToDraft:true});
 // A manual-mode commit is a real operation and must work without confirming a preview.
 await page.locator('#join-tool').click();await page.locator('#cad-command').selectOption('revolve');await page.locator('#revolve-kind').selectOption('body');await page.locator('#revolve-body').selectOption('b');await page.locator('#revolve-axis').selectOption('Z');await page.locator('#revolve-angle').fill('90');await page.waitForTimeout(700);await page.evaluate(()=>window.jobs=[]);await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:30000});assert.equal(await page.locator('#body-count').textContent(),'3');assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'false');assert.equal(await page.evaluate(()=>window.jobs.filter(j=>j.type==='revolve').length),1);rows.push({case:'manual-commit',realOperationRuns:true});
 const supportDoc=JSON.parse(await fs.readFile('.sites-runtime/support-multiface-selected.forma.json'));await load(supportDoc.features.slice(0,1));await page.locator('#print-support-tool').click();await page.waitForFunction(()=>document.querySelector('#print-support-dialog .precision-preview-confirm:not([disabled])'));await page.evaluate(()=>window.jobs=[]);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.jobs.filter(j=>j.type==='printSupport').length),0);await page.locator('#print-support-dialog .precision-preview-confirm').click();await page.waitForFunction(()=>document.querySelector('#print-support-dialog [data-id=export-state]')?.dataset.state==='ready',null,{timeout:120000});await page.locator('#print-support-dialog [data-id=cancel]').click();rows.push({case:'manual-rib-support',noAutomaticCalculation:true,explicitConfirmation:true});
 await page.locator('.navigation .precision-preview-mode').selectOption('automatic');
 for(const operation of ['new','join','cut']){
  await load(boxes);await page.locator('#join-tool').click();await page.locator('#cad-command').selectOption('revolve');await page.locator('#revolve-kind').selectOption('body');await page.locator('#revolve-body').selectOption('b');await page.locator('#revolve-axis').selectOption('Z');await page.locator('#revolve-operation').selectOption(operation);if(operation!=='new')await page.locator('#revolve-target').selectOption('a');await page.locator('#revolve-angle').fill('90');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.revolvePreview==='90',null,{timeout:45000});const before=await page.evaluate(()=>window.jobs.filter(j=>j.type==='revolve').length);await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:30000});assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'true');assert.equal(await page.evaluate(()=>window.jobs.filter(j=>j.type==='revolve').length),before);const saved=await save();assert.equal(saved.features.at(-1).spec.operation,operation);assert.ok(saved.features.at(-1).outputs.every(o=>o.brep));assert.ok(saved.features.at(-1).outputs.every(o=>!o.id.startsWith('revolve-preview')));rows.push({case:'revolve-'+operation,exactResultReused:true,noCommitRecalculation:true});
 }

 const fixtures=[
  {type:'shell',target:'a',thickness:1.5,direction:'内側',faces:[{bodyId:'a',point:[0,0,10],normal:[0,0,1]}]},
  {type:'fillet',target:'a',radius:1.5,edges:[{bodyId:'a',point:[0,-5,10],a:[-5,-5,10],b:[5,-5,10]}]},
  {type:'revolve',sourceBody:'b',bodySweep:true,origin:[1,0,0],axisVector:[0,0,1],angle:75,direction:'片側',operation:'new',target:'a'}
 ];
 for(const spec of fixtures){
  const record={id:'recovery-'+spec.type,createdAt:Date.now()+60000,document:{format:'forma-cad',version:1,features:boxes},request:{spec:{type:'preview',operation:spec},features:boxes},calculation:{stage:'形状・隙間検査中…',stageElapsedMs:2100},error:{message:'試験用の形状エラー'}};
  await page.evaluate(record=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('forma-cad-failure-recovery-v1',1);
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('records','readwrite'),rows=tx.objectStore('records');
    const data=JSON.stringify(record);rows.put({id:record.id,createdAt:record.createdAt,bytes:data.length,text:data});
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
   };
  }),record);
  await page.locator('#failure-recovery-open').click();
  const entry=page.locator('#failure-recovery-dialog article').first();
  assert.match(await entry.textContent(),/最後の計算段階：形状・隙間検査中/);
  await page.evaluate(()=>{window.jobs=[];window.stages=[];});
  await entry.getByRole('button',{name:'モデルと入力条件を復元'}).click();
  await page.locator('#tools-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#cad-command').inputValue(),spec.type);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>window.jobs.filter(j=>j.type==='preview'||j.type==='revolve').length),0);
  if(spec.type==='revolve'){
   assert.equal(await page.locator('#revolve-angle').inputValue(),'75');
   assert.equal(await page.locator('#revolve-body').inputValue(),'b');
   await page.locator('#revolve-angle').fill('60');
  }else{
   assert.equal(await page.locator('#cad-target').inputValue(),'a');
   const field=page.locator(spec.type==='shell'?'#cad-thickness':'#cad-radius');
   assert.equal(await field.inputValue(),'1.5');await field.fill('1');
  }
  await page.locator('#cad-apply').click();
  await page.locator('#tools-dialog').waitFor({state:'hidden',timeout:30000});
  const result=(await save()).features.at(-1).spec;
  if(spec.type==='shell')assert.deepEqual(result.faces,spec.faces);
  if(spec.type==='fillet')assert.deepEqual(result.edges,spec.edges);
  if(spec.type==='revolve'){assert.deepEqual(result.origin,spec.origin);assert.deepEqual(result.axisVector,spec.axisVector);}
  const stages=await page.evaluate(()=>window.stages);
  for(const expected of ['表示データ作成','形状・隙間検査','保存用データ作成'])assert.ok(stages.some(stage=>stage.includes(expected)),JSON.stringify(stages));
  rows.push({case:'failure-restore-'+spec.type,noAutomaticCalculation:true,selectionPreserved:true,stages});
 }
 await page.reload();assert.equal(await page.locator('.navigation .precision-preview-mode').inputValue(),'automatic');await page.locator('.navigation .precision-preview-mode').selectOption('manual');await page.reload();assert.equal(await page.locator('.navigation .precision-preview-mode').inputValue(),'manual');assert.deepEqual(errors,[]);
 const proof={pass:true,build:(await fs.readFile(root+'/index.html','utf8')).match(/app.js\?v=([a-f0-9]+)/)[1],rows,preferencePersists:true,errors};await fs.writeFile(out+'/browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){await page.screenshot({path:out+'/failure.png'});console.log(await page.evaluate(()=>({error:document.getElementById('error')?.textContent,cadError:document.getElementById('cad-error')?.textContent,phase:document.getElementById('canvas-host')?.dataset,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),jobs:window.jobs?.slice(-16)})),errors);throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
