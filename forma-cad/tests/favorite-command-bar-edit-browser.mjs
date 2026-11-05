import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import {moveFavoriteCommand} from '../src/favorite-command-order.js';
const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1720,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
const bar=page.locator('#favorite-commands'),menu=page.locator('#favorite-command-menu'),proxy=id=>bar.locator('[data-favorite-command="'+id+'"]');
const read=()=>page.evaluate(()=>({settings:JSON.parse(localStorage.getItem('forma-command-toolbar-v1')),usage:JSON.parse(localStorage.getItem('forma-command-usage-v1'))}));
const ids=()=>bar.locator('[data-favorite-command]').evaluateAll(buttons=>buttons.map(button=>button.dataset.favoriteCommand));
async function seed(favorites,extra={},usage={}){await page.evaluate(({favorites,extra,usage})=>{localStorage.setItem('forma-command-toolbar-v1',JSON.stringify({favorites,hidden:[],colors:{},collapsed:true,autoSort:false,...extra}));localStorage.setItem('forma-command-usage-v1',JSON.stringify(usage));},{favorites,extra,usage});await page.reload();await proxy(favorites[0]).waitFor();}
async function drag(source,target,before=false){const rect=await proxy(target).boundingBox();await proxy(source).dragTo(proxy(target),{force:true,targetPosition:{x:before?3:rect.width-3,y:rect.height/2}});}
async function right(id){await proxy(id).click({button:'right',force:true});await menu.waitFor();}
try{
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');await page.locator('#favorite-commands-open').waitFor();
 const catalog=await page.locator('.command-toolbar button[id]').evaluateAll(buttons=>buttons.map(button=>button.id));
 const initial=['solid-tool','move-tool','direct-fillet','advanced-tools'],usage={'solid-tool':5,'move-tool':3,'direct-fillet':1,'advanced-tools':0};
 await seed(initial,{autoSort:true,colors:{'solid-tool':'#00cc88'}},usage);
 await page.evaluate(()=>{window.commandClicks=0;document.querySelector('.command-toolbar').addEventListener('click',()=>window.commandClicks++,true);});
 await page.locator('.command-toolbar #solid-tool').evaluate(button=>button.disabled=true);
 await page.waitForFunction(()=>document.querySelector('#favorite-commands [data-favorite-command="solid-tool"]').disabled);
 assert.equal(await proxy('solid-tool').isDisabled(),true);assert.match(await proxy('solid-tool').getAttribute('title'),/ドラッグ.*右クリック/);
 await drag('solid-tool','direct-fillet');const reordered=['move-tool','direct-fillet','solid-tool','advanced-tools'];
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('forma-command-toolbar-v1')).autoSort===false);assert.deepEqual(await ids(),reordered);
 assert.deepEqual((await read()).usage,usage);assert.equal(await page.evaluate(()=>window.commandClicks),0);assert.equal(await proxy('solid-tool').getAttribute('data-command-color'),'#00cc88');
 const afterDrag=await read();await proxy('move-tool').dragTo(page.locator('.viewport'),{force:true,targetPosition:{x:400,y:200}});assert.deepEqual(await read(),afterDrag);assert.equal(await page.evaluate(()=>window.commandClicks),0);
 await page.reload();await proxy('move-tool').waitFor();assert.deepEqual(await ids(),reordered);
 await right('move-tool');assert.match(await menu.locator('strong').textContent(),/移動/);await menu.getByRole('button',{name:'青に変更',exact:true}).click();
 assert.equal(await proxy('move-tool').getAttribute('data-command-color'),'#2867ad');assert.equal(await menu.isVisible(),false);
 await right('move-tool');await menu.locator('input[type=color]').focus();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await menu.isVisible(),true);await menu.locator('input[type=color]').fill('#ffcc00');await menu.getByRole('button',{name:'色を適用',exact:true}).click();assert.equal(await proxy('move-tool').getAttribute('data-command-color'),'#ffcc00');
 await right('move-tool');await menu.getByRole('button',{name:'標準色に戻す',exact:true}).click();assert.equal(await proxy('move-tool').getAttribute('data-command-color'),null);
 const beforeFailure=await read();await right('solid-tool');await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='forma-command-toolbar-v1')throw Error('storage unavailable');return window.originalStorageSet.call(this,key,value);};});
 await menu.getByRole('button',{name:'赤に変更',exact:true}).click();assert.deepEqual(await read(),beforeFailure);assert.equal(await proxy('solid-tool').getAttribute('data-command-color'),'#00cc88');assert.equal(await menu.isVisible(),true);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalStorageSet);const statusBeforeEscape=await page.locator('#status').textContent();await menu.press('Escape');assert.equal(await menu.isVisible(),false);assert.equal(await page.locator('#status').textContent(),statusBeforeEscape);
 await proxy('advanced-tools').focus();await proxy('advanced-tools').press('Shift+F10');await menu.waitFor();await menu.press('Escape');
 assert.equal(await proxy('advanced-tools').evaluate(el=>el===document.activeElement),true);await proxy('advanced-tools').click();await page.locator('#tools-dialog').waitFor();await page.locator('#tools-close').click();assert.equal((await read()).usage['advanced-tools'],1);
 await right('move-tool');await menu.getByRole('button',{name:'登録解除',exact:true}).click();assert.equal(await proxy('move-tool').count(),0);assert.equal((await read()).settings.collapsed,true);
 await right('solid-tool');await page.screenshot({path:'.sites-runtime/command-bar-context-menu.png'});await page.locator('.viewport-title').click({force:true});assert.equal(await menu.isVisible(),false);
 await seed(catalog);const original=await ids(),secondRow=await bar.locator('.command-row').nth(1).locator('[data-favorite-command]').first().getAttribute('data-favorite-command');
 await drag(original[0],secondRow);assert.deepEqual(await ids(),moveFavoriteCommand(original,original[0],secondRow,false));
 await page.setViewportSize({width:900,height:760});await page.waitForTimeout(250);await bar.evaluate(el=>el.scrollLeft=0);
 const saved=await read(),start=await bar.locator('.command-row').first().locator('[data-favorite-command]').first().boundingBox(),barRect=await bar.boundingBox();
 await page.mouse.move(start.x+12,start.y+start.height/2);await page.mouse.down();await page.mouse.move(start.x+25,start.y+start.height/2,{steps:5});await page.mouse.move(barRect.x+barRect.width-5,start.y+start.height/2,{steps:12});
 await page.waitForFunction(()=>document.querySelector('#favorite-commands').scrollLeft>30);
 await page.mouse.move(450,400,{steps:8});await page.mouse.up();assert.deepEqual(await read(),saved);assert.equal(await bar.locator('.favorite-bar-dragging,.favorite-bar-before,.favorite-bar-after').count(),0);
 const scrolled=await bar.evaluate(el=>el.scrollLeft);await page.waitForTimeout(150);assert.equal(await bar.evaluate(el=>el.scrollLeft),scrolled);
 await proxy('advanced-tools').focus();await proxy('advanced-tools').press('Enter');await page.locator('#tools-dialog').waitFor();await page.locator('#tools-close').click();
 await proxy('advanced-tools').evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:898,clientY:758})));const bounds=await menu.boundingBox();assert(bounds.x>=8&&bounds.y>=8&&bounds.x+bounds.width<=900&&bounds.y+bounds.height<=760);await menu.press('Escape');
 await seed(['advanced-tools']);await right('advanced-tools');await menu.getByRole('button',{name:'登録解除',exact:true}).click();assert.equal(await bar.isVisible(),false);assert.equal(await page.locator('.command-toolbar').isVisible(),true);assert.equal((await read()).settings.collapsed,false);
 await page.reload();await page.locator('#favorite-commands-open').waitFor();assert.equal(await bar.isVisible(),false);assert.equal(await page.locator('.command-toolbar').isVisible(),true);assert.deepEqual(errors,[]);
 const report={pass:true,disabledCommandsEditable:true,directDragPersists:true,dragDoesNotInvokeCommand:true,cancelledDragPreservesSettings:true,manualOrderDisablesUsageSort:true,paletteAndCustomColors:true,standardColorReset:true,storageFailurePreservesSettings:true,keyboardMenu:true,keyboardActivationAfterDrag:true,normalClickWorks:true,unregister:true,twoRowReorder:true,horizontalDragScroll:true,outsideDropCancels:true,menuClampedToViewport:true,lastRemovalRestoresOriginalBar:true,errors};
 if(process.env.FORMA_TEST_REPORT)await fs.writeFile(process.env.FORMA_TEST_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:'.sites-runtime/command-bar-edit-failure.png'});throw error;}
finally{await browser.close();server.close();}
