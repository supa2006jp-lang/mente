import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';

const root=path.resolve('dist'),out='.sites-runtime/draft-dimension-workflow';
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(request,response)=>{
 try{
  const url=new URL(request.url,'http://localhost');
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep))throw Error();
  response.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream');
  response.end(await fs.readFile(file));
 }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
page.setDefaultTimeout(30000);
const base={...defaults,id:'base',kind:'extrusion',name:'箱',width:20,height:20,depth:12,dimensionLinks:{depth:'高さ'}};
const namedDimensions={高さ:12,壁厚:1};
const doc={format:'forma-cad',version:1,features:[base],namedDimensions};
const box=page.locator('#named-dimensions-dialog');
const tools=page.locator('#tools-dialog');
async function openValues(){await page.locator('#named-dimensions-open').click();await box.waitFor({state:'visible'});}
async function valueField(name){
 const rows=box.locator('[data-rows]>div');
 for(const row of await rows.all())if(await row.locator('input').first().inputValue()===name)return row.locator('input[type=number]');
 throw Error('Missing named value '+name);
}
async function changeValue(name,value){
 await openValues();await (await valueField(name)).fill(String(value));
 await box.locator('[data-save]').click();await box.waitFor({state:'hidden'});
}
async function load(document){
 await page.locator('#file').setInputFiles({name:'named.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});
 await page.locator('#project-preview-open').click();
 await page.locator('#project-load-preview').waitFor({state:'hidden'});
}
async function save(){
 const pending=page.waitForEvent('download');
 await page.locator('#save').click();
 return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));
}
async function restoreShell(document,thickness){
 const spec={type:'shell',target:'base',thickness,direction:'内側',faces:[{bodyId:'base',point:[0,0,document.features[0].depth],normal:[0,0,1]}]};
 const record={id:crypto.randomUUID(),createdAt:Date.now()+60000,document,request:{spec},error:{message:'シェルを作成できませんでした',code:'geometry'}};
 await page.evaluate(record=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('forma-cad-failure-recovery-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('records','readwrite'),text=JSON.stringify(record);
   tx.objectStore('records').put({id:record.id,createdAt:record.createdAt,text,bytes:text.length});
   tx.oncomplete=()=>{db.close();resolve();};
   tx.onabort=()=>{db.close();reject(tx.error);};
  };
 }),record);
 await page.locator('#failure-recovery-open').click();
 await page.locator('#failure-recovery-dialog article').first().getByRole('button',{name:'モデルと入力条件を復元'}).click();
 await tools.waitFor({state:'visible'});
 assert.equal(await page.locator('#cad-thickness').inputValue(),String(thickness));
}
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await load(doc);
 await page.waitForTimeout(1000);
 await page.reload();
 await page.locator('#project-draft-open').waitFor({state:'hidden'});
 await load(doc);
 await page.locator('#features [data-history-feature="base"] .row-label').click();
 const depth=page.locator('#viewport-depth:visible,#depth:visible').first();
 await depth.press('=');
 await page.locator('#dimension-expression-text').fill('高さ + 1');
 await page.locator('#dimension-expression-text').press('Enter');
 await page.locator('#apply').click();
 await page.locator('#extrude-distance').waitFor({state:'hidden'});
 await changeValue('高さ',14);
 let saved=await save();
 assert.equal(saved.features[0].depth,15);
 assert.equal(saved.features[0].dimensionLinks.depth,'高さ + 1');
 assert.equal(saved.namedDimensions.高さ,14);
 console.log('PASS linked extrusion depth');
 await restoreShell(saved,1);
 await page.locator('#cad-thickness').press('=');
 const expression=page.locator('#dimension-expression-text');
 await expression.fill('壁厚 * 1.5');await expression.press('Enter');
 assert.equal(await page.locator('#cad-thickness').inputValue(),'1.5');
 await page.locator('#cad-apply').click();await tools.waitFor({state:'hidden'});
 saved=await save();
 assert.equal(saved.features.at(-1).dimensionLinks.thickness,'壁厚 * 1.5');
 await changeValue('壁厚',1.4);
 await page.waitForFunction(()=>document.querySelector('#project-draft-status')?.textContent==='下書き保存済み');
 assert.equal(await page.locator('#project-draft-status').textContent(),'下書き保存済み');
 await page.reload();
 await page.locator('#project-draft-open').click();
 await page.locator('#project-draft-dialog').getByRole('button',{name:'この作業を復元'}).first().click();
 await page.locator('#project-draft-dialog').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('#feature-count')?.textContent==='2');
 saved=await save();
 assert.equal(saved.namedDimensions.壁厚,1.4);
 assert.ok(Math.abs(saved.features.at(-1).spec.thickness-2.1)<1e-10);
 assert.equal(saved.features.at(-1).dimensionLinks.thickness,'壁厚 * 1.5');
 console.log('PASS formula creation, dependent shell replay, autosave and reload');
 await changeValue('壁厚',1.2);
 await page.locator('#undo').click();await page.waitForTimeout(300);
 await openValues();assert.equal(await (await valueField('壁厚')).inputValue(),'1.4');await box.locator('[data-cancel]').click();
 await page.locator('#redo').click();await page.waitForTimeout(300);
 await openValues();assert.equal(await (await valueField('壁厚')).inputValue(),'1.2');await box.locator('[data-cancel]').click();
 await openValues();await (await valueField('壁厚')).fill('20');await box.locator('[data-save]').click();
 await page.waitForFunction(()=>document.querySelector('#named-dimensions-dialog [data-status]')?.textContent.includes('シェルを作成できません'));
 await box.locator('[data-cancel]').click();
 saved=await save();assert.equal(saved.namedDimensions.壁厚,1.2);
 assert.ok(Math.abs(saved.features.at(-1).spec.thickness-1.8)<1e-10);
 console.log('PASS undo, redo and invalid dimension rollback');
 await restoreShell({...doc,features:[{...base,depth:14}],namedDimensions:{...namedDimensions,高さ:14}},12);
 await page.getByRole('button',{name:'加工できる寸法を探す'}).click();
 const candidate=page.locator('#cad-failure-actions').getByRole('button',{name:/mm をプレビュー/}).first();
 await candidate.waitFor({state:'visible'});
 const value=Number((await candidate.textContent()).split(' ')[0]);
 assert.ok(value>0&&value<12);
 assert.equal(await page.locator('#feature-count').textContent(),'1');
 await candidate.click();
 assert.equal(Number(await page.locator('#cad-thickness').inputValue()),value);
 await page.waitForFunction(()=>document.querySelector('#canvas-host')?.dataset.machiningPreviewPhase==='precise');
 await page.locator('#cad-apply').click();await tools.waitFor({state:'hidden'});
 saved=await save();
 assert.equal(saved.features.at(-1).spec.thickness,value);
 assert.ok(saved.features.at(-1).outputs.every(output=>output.brep&&output.shapeMetrics.solids===1));
 assert.deepEqual(errors,[]);
 const build=(await fs.readFile(root+'/index.html','utf8')).match(/app.js\?v=([a-f0-9]+)/)[1];
 const proof={pass:true,build,linkedDepth:true,linkedShell:true,autosave:true,undoRedo:true,rollback:true,verifiedValue:value,errors};
 await fs.writeFile(out+'/browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){
 console.log(await page.evaluate(()=>({dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.id),error:document.querySelector('#cad-error')?.textContent,status:document.querySelector('#status')?.textContent,drafts:document.querySelector('#project-draft-status')?.textContent,features:document.querySelector('#feature-count')?.textContent})),errors);
 await page.screenshot({path:out+'/failure.png'});throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
