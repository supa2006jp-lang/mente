import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';

const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));assert(file.startsWith(root+path.sep));res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,page;
try{
 browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1720,height:1110},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 const el=id=>page.locator('#'+id),settings=el('favorite-commands-dialog');
 await el('favorite-commands-open').click();
 const row=id=>settings.locator('[data-command="'+id+'"]');
 async function dragRow(source,target,before){
  const bounds=await row(target).boundingBox();
  await row(source).locator('.favorite-name').dragTo(row(target),{targetPosition:{x:bounds.width*.4,y:before?3:bounds.height-3}});
 }
 const registeredIds=()=>settings.locator('.favorite-row').evaluateAll(items=>items.filter(item=>item.querySelector('[data-favorite-drag]')).map(item=>item.dataset.command));
 assert.equal(await row('solid-tool').getByRole('button',{name:'を前へ',exact:false}).count(),0,'unregistered commands should offer registration instead of inactive arrows');
 await settings.getByRole('button',{name:'すべて登録',exact:true}).click();
 const all=await settings.locator('[data-command]').evaluateAll(items=>items.map(item=>item.dataset.command));assert(all.length>20);
 assert.equal(await settings.getByRole('button',{name:'を登録する',exact:false}).count(),0);
 const scrollList=settings.locator('[data-list]'),listRect=await scrollList.boundingBox(),dragStart=await row(all[0]).locator('.favorite-name').boundingBox();
 await page.mouse.move(dragStart.x+12,dragStart.y+dragStart.height/2);await page.mouse.down();await page.mouse.move(dragStart.x+24,dragStart.y+dragStart.height/2,{steps:4});
 await page.mouse.move(listRect.x+listRect.width*.4,listRect.y+listRect.height-5,{steps:12});
 await page.waitForFunction(()=>document.querySelector('#favorite-commands-dialog [data-list]').scrollTop>120);
 const heading=await settings.locator('h2').boundingBox();await page.mouse.move(heading.x+20,heading.y+10,{steps:5});await page.mouse.up();
 assert.deepEqual(await settings.locator('[data-command]').evaluateAll(items=>items.map(item=>item.dataset.command)),all,'auto-scroll followed by an outside drop must cancel the reorder');
 assert.equal(await settings.locator('.favorite-dragging,.favorite-drop-before,.favorite-drop-after').count(),0);
 await scrollList.evaluate(el=>el.scrollTop=0);
 const first=all[0],second=all[1];await row(second).getByRole('button',{name:'を前へ',exact:false}).click();
 assert.deepEqual(await settings.locator('[data-command]').evaluateAll(items=>items.slice(0,2).map(item=>item.dataset.command)),[second,first]);
 await settings.getByRole('button',{name:'すべて登録',exact:true}).click();
 assert.deepEqual(await settings.locator('[data-command]').evaluateAll(items=>items.slice(0,2).map(item=>item.dataset.command)),[second,first],'bulk registration preserves an adjusted order and does not duplicate commands');
 await settings.getByRole('button',{name:'登録をすべて解除',exact:true}).click();
 assert.match(await settings.locator('[data-order-preview]').textContent(),/まだ登録/);
 await settings.getByRole('button',{name:'キャンセル',exact:true}).click();assert.equal(await el('favorite-commands').isVisible(),false);
 await el('favorite-commands-open').click();
 for(const id of ['solid-tool','move-tool','direct-fillet'])await row(id).getByRole('button',{name:'を登録する',exact:false}).click();
 await row('move-tool').getByRole('button',{name:'を前へ',exact:false}).click();
 assert.match(await settings.locator('[data-order-preview]').textContent(),/1\. 移動/);
 await dragRow('move-tool','direct-fillet',false);assert.deepEqual(await registeredIds(),['solid-tool','direct-fillet','move-tool']);
 await dragRow('move-tool','solid-tool',true);assert.deepEqual(await registeredIds(),['move-tool','solid-tool','direct-fillet']);
 await row('move-tool').locator('.favorite-name').dragTo(settings.locator('h2'));assert.deepEqual(await registeredIds(),['move-tool','solid-tool','direct-fillet'],'a drop outside the registered list must leave its order unchanged');
 assert.equal(await settings.locator('.favorite-dragging,.favorite-drop-before,.favorite-drop-after').count(),0);
 await row('direct-chamfer').getByRole('checkbox').uncheck();
 await settings.locator('[data-collapse]').check();await settings.getByRole('button',{name:'保存',exact:true}).click();
 assert.equal(await page.locator('.command-toolbar').isVisible(),false);
 assert.deepEqual(await el('favorite-commands').locator('button').evaluateAll(items=>items.map(i=>i.dataset.favoriteCommand)),['move-tool','solid-tool','direct-fillet']);
 await el('favorite-commands-open').click();await settings.locator('[data-collapse]').uncheck();await settings.getByRole('button',{name:'保存',exact:true}).click();
 assert.equal(await page.locator('.command-toolbar').isVisible(),true);assert.equal(await el('direct-chamfer').isVisible(),false);
 await page.setViewportSize({width:1100,height:850});await page.waitForTimeout(100);assert.equal(await el('direct-chamfer').isVisible(),false);
 await page.setViewportSize({width:1720,height:1110});
 await page.reload();await el('favorite-commands-open').waitFor();
 assert.deepEqual(await el('favorite-commands').locator('button').evaluateAll(items=>items.map(i=>i.dataset.favoriteCommand)),['move-tool','solid-tool','direct-fillet']);
 assert.equal(await el('direct-chamfer').isVisible(),false);
 const favoriteRows=el('favorite-commands').locator('.command-row');await favoriteRows.first().waitFor();
 assert.equal(await favoriteRows.count(),2);const rowBounds=await favoriteRows.evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return {top:r.top,height:r.height};}));
 assert(rowBounds[1].top>=rowBounds[0].top+rowBounds[0].height,'favorite commands should occupy two distinct rows');
 assert((await page.locator('.toolbar:has(.sketch-tools)').boundingBox()).height<=52,'the sketch command row should be compact');

 const dimensions={幅:40,高さ:20,穴径:8,丸み:1};
 const rect={...defaults,id:'rect',kind:'sketch',name:'Linked rectangle',profile:'rect',groupId:'rect',groupNumber:1,width:40,height:20};
 const circle={...defaults,id:'circle',kind:'sketch',name:'Linked circle',profile:'circle',groupId:'circle',groupNumber:2,x:60,diameter:8};
 async function load(features,values=dimensions){await el('file').setInputFiles({name:'linked-dimensions.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features,namedDimensions:values}))});await el('project-preview-open').click();await el('project-load-preview').waitFor({state:'hidden'});}
 async function save(){const download=page.waitForEvent('download');await el('save').click();return JSON.parse(await fs.readFile(await (await download).path(),'utf8'));}
 async function expression(id,value){await el(id).focus();await el(id).press('=');await el('dimension-expression-text').fill(value);await el('dimension-expression-text').press('Enter');assert.equal(await el('dimension-expression-editor').isVisible(),false);}
 await load([rect,circle]);
 await page.locator('[data-history-feature=rect] button').first().click();
 await expression('width','幅');await expression('height','高さ');await el('apply').click();
 await page.locator('[data-history-feature=circle] button').first().click();
 await expression('diameter','穴径');await el('apply').click();
 const sketches=(await save()).features;
 assert.deepEqual(sketches.find(f=>f.id==='rect').dimensionLinks,{width:'幅',height:'高さ'});
 assert.deepEqual(sketches.find(f=>f.id==='circle').dimensionLinks,{diameter:'穴径'});
 const linkedRect=sketches.find(f=>f.id==='rect'),base={...defaults,id:'base',kind:'extrusion',name:'Plate',profile:'region',region:findRegions([linkedRect])[0],depth:8};
 await load([linkedRect,base]);
 // Favorite buttons invoke the original command and retain normal selection behavior.
 await el('favorite-commands').locator('[data-favorite-command=move-tool]').click();
 assert(await el('move-panel').isVisible());await el('move-cancel').click();
 // Frequency ordering counts valid clicks from both the original and favorite bars.
 await el('favorite-commands-open').click();await dragRow('move-tool','direct-fillet',false);
 await settings.locator('[data-auto-sort]').check();assert.equal((await registeredIds())[0],'move-tool');
 await settings.getByRole('button',{name:'保存',exact:true}).click();
 assert.equal(await el('favorite-commands').locator('button').first().getAttribute('data-favorite-command'),'move-tool');
 await el('direct-fillet').click();await el('cad-cancel').click();
 assert.equal(await el('favorite-commands').locator('button').first().getAttribute('data-favorite-command'),'move-tool','equal usage keeps the current order');
 await el('favorite-commands').locator('[data-favorite-command=direct-fillet]').click();await el('cad-cancel').click();
 assert.equal(await el('favorite-commands').locator('button').first().getAttribute('data-favorite-command'),'direct-fillet');
 const usage=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-command-usage-v1')));assert.equal(usage['move-tool'],1);assert.equal(usage['direct-fillet'],2);
 await page.reload();await el('favorite-commands-open').waitFor();assert.equal(await el('favorite-commands').locator('button').first().getAttribute('data-favorite-command'),'direct-fillet');
 await el('favorite-commands-open').click();assert(await settings.locator('[data-auto-sort]').isChecked());
 await dragRow('direct-fillet','solid-tool',false);assert.equal(await settings.locator('[data-auto-sort]').isChecked(),false,'manual dragging takes priority over automatic ordering');
 const manualOrder=await registeredIds();await settings.getByRole('button',{name:'保存',exact:true}).click();
 await page.reload();await el('favorite-commands-open').waitFor();assert.deepEqual(await el('favorite-commands').locator('button').evaluateAll(items=>items.map(item=>item.dataset.favoriteCommand)),manualOrder);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-command-toolbar-v1')).autoSort),false);
 await load([linkedRect,base]);
 // Bind an actual hole through its own diameter input, then create it.
 await el('cut-tool').click();
 await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await el('fit').click();
 const canvas=await page.locator('#canvas-host canvas').boundingBox();
 await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
 await expression('hole-diameter','穴径');
 await el('hole-apply').click();await el('hole-panel').waitFor({state:'hidden',timeout:60000});
 const hole=(await save()).features.find(f=>f.hole);assert.equal(hole.dimensionLinks.diameter,'穴径');
 // Add a fillet from a named radius using the normal command.
 await el('favorite-commands').locator('[data-favorite-command=direct-fillet]').click();
 await expression('cad-radius','丸み');await el('cad-apply').click();await el('tools-dialog').waitFor({state:'hidden',timeout:90000});
 let saved=await save(),fillet=saved.features.find(f=>f.spec?.type==='fillet');assert.equal(fillet.dimensionLinks.radius,'丸み');
 async function setDimensions(values){
  await el('named-dimensions-open').click();
  const dialog=el('named-dimensions-dialog');
  for(const [name,value]of Object.entries(values)){const input=dialog.getByRole('textbox',{name:'寸法名',exact:true});const count=await input.count();let found=false;for(let i=0;i<count;i++)if(await input.nth(i).inputValue()===name){await input.nth(i).locator('..').getByRole('spinbutton').fill(String(value));found=true;break;}assert(found,name);}
  await dialog.getByRole('button',{name:'適用',exact:true}).click();await dialog.waitFor({state:'hidden',timeout:90000});
 }
 await setDimensions({幅:50,高さ:24,穴径:10,丸み:.8});saved=await save();
 const updatedRect=saved.features.find(f=>f.id==='rect'),updatedBase=saved.features.find(f=>f.id==='base'),updatedHole=saved.features.find(f=>f.hole),updatedFillet=saved.features.find(f=>f.spec?.type==='fillet');
 assert.deepEqual([updatedRect.width,updatedRect.height,updatedHole.diameter,updatedFillet.spec.radius],[50,24,10,.8]);
 assert.equal(Math.max(...updatedBase.region.outer.map(p=>p[0]))-Math.min(...updatedBase.region.outer.map(p=>p[0])),50);
 assert(updatedFillet.outputs.length>0);assert(updatedFillet.outputs.every(o=>o.brep||o.shapeMetrics));
 // Reopen, retain a formula on re-edit, then detach just this radius with direct numeric input.
 await page.locator('[data-history-feature="'+updatedFillet.id+'"] button').first().click();
 await el('fillet-history-preview').uncheck();await expression('fillet-history-radius','丸み * 1.25');await el('fillet-history-radius-apply').click();await el('fillet-history-dialog').waitFor({state:'hidden',timeout:90000});
 assert.equal((await save()).features.find(f=>f.id===updatedFillet.id).dimensionLinks.radius,'丸み * 1.25');
 await page.locator('[data-history-feature="'+updatedFillet.id+'"] button').first().click();
 await el('fillet-history-radius').fill('1.2');await el('fillet-history-radius-apply').click();await el('fillet-history-dialog').waitFor({state:'hidden',timeout:90000});
 assert.equal((await save()).features.find(f=>f.id===updatedFillet.id).dimensionLinks,undefined);
 const stable=await save();await load(stable.features,stable.namedDimensions);
 await el('named-dimensions-open').click();
 const invalidDialog=el('named-dimensions-dialog'),nameInputs=invalidDialog.getByRole('textbox',{name:'寸法名',exact:true});
 for(let i=0;i<await nameInputs.count();i++)if(await nameInputs.nth(i).inputValue()==='穴径')await nameInputs.nth(i).locator('..').getByRole('spinbutton').fill('-1');
 await invalidDialog.getByRole('button',{name:'適用',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#named-dimensions-dialog [data-status]').textContent.includes('範囲外'));
 await invalidDialog.getByRole('button',{name:'閉じる',exact:true}).click();
 const unchanged=await save();assert.deepEqual(unchanged.namedDimensions,stable.namedDimensions);assert.deepEqual(unchanged.features,stable.features);
 if(process.env.FORMA_FAVORITE_SCREENSHOTS){await el('favorite-commands-open').click();await page.screenshot({path:'.sites-runtime/favorite-commands-settings.png'});await settings.getByRole('button',{name:'キャンセル',exact:true}).click();await page.screenshot({path:'.sites-runtime/favorite-commands-bar.png'});}
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,bulkRegistration:true,bulkPreservesOrder:true,registrationBeforeReorder:true,dragReorder:true,dragAutoScroll:true,cancelledDragPreservesOrder:true,usageSorting:true,usagePersistence:true,stableUsageTies:true,manualOrderOverridesAutomatic:true,twoCommandRows:true,compactSketchToolbar:true,favoriteOrder:true,favoritePersistence:true,hiddenSurvivesResize:true,favoriteInvokesOriginal:true,sketchBindings:true,holeBinding:true,filletBinding:true,downstreamReplay:true,filletHistoryBinding:true,manualInputUnlinks:true,reloadPreservesLinks:true,invalidEditPreservesDocument:true,errors}));
}catch(error){if(page)await page.screenshot({path:'.sites-runtime/favorites-named-failure.png'});throw error;}
finally{await browser?.close();server.close();}
