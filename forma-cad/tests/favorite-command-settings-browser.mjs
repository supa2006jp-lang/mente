import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1720,height:1000},acceptDownloads:true}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const dialog=page.locator('#favorite-commands-dialog'),row=id=>dialog.locator('[data-command="'+id+'"]'),proxy=id=>page.locator('#favorite-commands [data-favorite-command="'+id+'"]');
const open=async()=>page.locator('#favorite-commands-open').click(),save=async()=>dialog.getByRole('button',{name:'保存',exact:true}).click(),cancel=async()=>dialog.getByRole('button',{name:'キャンセル',exact:true}).click();
const read=()=>page.evaluate(()=>({settings:JSON.parse(localStorage.getItem('forma-command-toolbar-v1')),usage:JSON.parse(localStorage.getItem('forma-command-usage-v1'))}));
async function load(value){await dialog.locator('[data-settings-file]').setInputFiles({name:'command-settings.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});}
async function exported(){const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'設定を書き出す',exact:true}).click();return JSON.parse(await fs.readFile(await (await downloading).path(),'utf8'));}
try{
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');await open();
 for(const id of ['solid-tool','move-tool','direct-fillet'])await row(id).getByRole('button',{name:'を登録する',exact:false}).click();
 await dialog.locator('[data-collapse]').check();await row('direct-chamfer').getByRole('checkbox',{name:'を元のバーに表示',exact:false}).uncheck();
 for(const id of ['solid-tool','move-tool'])await row(id).locator('[data-bulk-select]').check();
 await dialog.locator('[data-bulk-colors] input[type=color]').fill('#00cc88');await dialog.locator('[data-apply-color]').click();
 assert.equal(await row('direct-fillet').locator('input[type=color]').inputValue(),'#202c3a');
 await row('move-tool').getByRole('button',{name:'を前へ',exact:false}).click();assert.equal(await row('move-tool').locator('[data-bulk-select]').isChecked(),true);await save();
 for(const id of ['solid-tool','move-tool'])assert.equal(await proxy(id).getAttribute('data-command-color'),'#00cc88');assert.equal(await proxy('direct-fillet').getAttribute('data-command-color'),null);
 const original=await read();await open();assert.equal(await dialog.locator('[data-apply-color]').isDisabled(),true);
 await dialog.locator('[data-select-registered]').click();assert.equal(await dialog.locator('[data-bulk-select]:checked').count(),3);await dialog.locator('[data-select-clear]').click();
 await row('solid-tool').locator('[data-bulk-select]').check();await dialog.locator('[data-reset-colors]').click();assert.equal(await row('solid-tool').locator('input[type=color]').inputValue(),'#202c3a');assert.equal(await row('move-tool').locator('input[type=color]').inputValue(),'#00cc88');
 await cancel();assert.deepEqual(await read(),original);
 await open();const file=await exported();assert.deepEqual(file.settings,original.settings);assert.deepEqual(file.usage,original.usage);
 await load('{}');await page.waitForFunction(()=>document.querySelector('#favorite-commands-dialog [data-status]').textContent.includes('読み込めません'));assert.deepEqual(await read(),original);
 await load('x'.repeat(65537));await page.waitForFunction(()=>document.querySelector('#favorite-commands-dialog [data-status]').textContent.includes('64 KB'));assert.deepEqual(await read(),original);
 const imported=structuredClone(file);imported.settings.colors['solid-tool']='#223366';imported.settings.autoSort=true;imported.usage={'solid-tool':12,'move-tool':4,'direct-fillet':0};imported.settings.favorites.push('retired-command');
 await load(imported);await page.waitForFunction(()=>document.querySelector('#favorite-commands-dialog [data-status]').textContent.includes('未対応の1コマンド'));assert.deepEqual(await read(),original);await cancel();
 await open();assert.equal(await row('solid-tool').locator('input[type=color]').inputValue(),'#00cc88');
 await load(imported);await page.waitForFunction(()=>document.querySelector('#favorite-commands-dialog [data-status]').textContent.includes('設定を読み込みました'));await save();
 assert.equal(await proxy('solid-tool').getAttribute('data-command-color'),'#223366');assert.deepEqual(await page.locator('#favorite-commands [data-favorite-command]').evaluateAll(buttons=>buttons.map(button=>button.dataset.favoriteCommand)),['solid-tool','move-tool','direct-fillet']);
 await page.reload();await proxy('solid-tool').waitFor();await open();const roundTrip=await exported();assert.equal(roundTrip.settings.colors['solid-tool'],'#223366');assert.deepEqual(roundTrip.usage,imported.usage);assert.equal(roundTrip.settings.hidden.includes('direct-chamfer'),true);await cancel();
 const metrics=[];
 for(const viewport of [{width:1720,height:1000},{width:1120,height:820},{width:900,height:700},{width:640,height:800}]){
  await page.setViewportSize(viewport);await open();
  await dialog.getByRole('button',{name:'すべて登録',exact:true}).click();await page.waitForTimeout(150);
  const layout=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),list=el.querySelector('[data-list]').getBoundingClientRect(),footer=el.querySelector('.editor-actions:last-child').getBoundingClientRect();return {width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,listHeight:list.height,footerBottom:footer.bottom,horizontalOverflow:el.scrollWidth>el.clientWidth,scrollingList:el.querySelector('[data-list]').scrollHeight>list.height};});
  assert(layout.left>=0&&layout.right<=viewport.width&&layout.top>=0&&layout.bottom<=viewport.height,JSON.stringify(layout));assert(layout.footerBottom<=layout.bottom&&layout.listHeight>=100);assert.equal(layout.horizontalOverflow,false);assert.equal(layout.scrollingList,true);metrics.push({viewport,...layout});
  await page.screenshot({path:'.sites-runtime/command-settings-'+viewport.width+'.png'});await cancel();
 }
 await page.setViewportSize({width:1720,height:1000});await page.waitForTimeout(250);
 const favoriteHeight=await page.locator('#favorite-commands').evaluate(el=>el.getBoundingClientRect().height);assert(favoriteHeight<50,'short favorites use one row');
 await open();await dialog.getByRole('button',{name:'すべて登録',exact:true}).click();await save();await page.waitForTimeout(250);
 const rows=await page.locator('#favorite-commands .command-row').evaluateAll(rows=>rows.map(el=>el.getBoundingClientRect().height));assert(rows.every(height=>height>=30),'large favorites keep two rows');
 await page.screenshot({path:'.sites-runtime/command-workspace-compact.png'});assert.deepEqual(errors,[]);
 const report={pass:true,bulkColorSelection:true,bulkReset:true,selectionPersistsAfterReorder:true,exportImportRoundTrip:true,usagePreserved:true,invalidImportPreservesSettings:true,importCancelPreservesSettings:true,unknownCommandsSkipped:true,compactSingleRow:true,twoRowsForManyCommands:true,dialogMetrics:metrics,errors};
 if(process.env.FORMA_TEST_REPORT)await fs.writeFile(process.env.FORMA_TEST_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:'.sites-runtime/command-settings-failure.png'});throw error;}
finally{await browser.close();server.close();}
