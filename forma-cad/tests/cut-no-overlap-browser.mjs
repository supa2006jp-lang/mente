import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1700,height:1100},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));}
try{
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:5188/');
 const a={...defaults,id:'base',name:'土台',kind:'extrusion',width:10,height:10,depth:10},doc={format:'forma-cad',version:1,features:[a,{...a,id:'tool',name:'ツール',x:30},{...defaults,kind:'sketch',id:'path',name:'経路',profile:'line',mode:'thin',width:10,x:30,z:5}]};
 await page.locator('#file').setInputFiles({name:'cut-no-overlap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);const before=(await save()).features;
 for(const type of ['join','pipe']){
  await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption(type);await page.locator('#cad-target').selectOption('base');
  if(type==='join'){await page.locator('#cad-other').selectOption('tool');await page.locator('#cad-combineMode').selectOption('切り取り');await page.locator('#cad-keepTools').selectOption('削除');}
  else{await page.locator('#cad-path').selectOption('path');await page.locator('#cad-diameter').fill('2');await page.locator('#cad-operation').selectOption('切り取り');}
  await page.locator('#cad-apply').click();await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('重なっていません'));assert.equal(await page.locator('#tools-dialog').evaluate(e=>e.open),true);assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual((await save()).features,before);await page.locator('#cad-cancel').click();
 }
 assert.deepEqual(errors,[]);await fs.mkdir('.sites-runtime/command-audit',{recursive:true});await page.screenshot({path:'.sites-runtime/command-audit/no-overlap-preserved.png'});console.log('PASS boolean/pipe cut errors are visible and preserve both bodies and saved history');
}finally{await browser.close();}
