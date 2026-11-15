import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation} from '../src/kernel.js';
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
 await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas[data-engine]').waitFor();



 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:60,height:40,depth:30},cavity={...defaults,id:'cavity',kind:'extrusion',name:'空洞',profile:'rect',operation:'cut',target:'body',width:55,height:35,depth:25,z:2.5};
 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('boss-joint-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#boss-joint-error').textContent());}}
 async function analysis(){return page.locator('[data-boss-joint]').evaluate(el=>JSON.parse(el.dataset.bossJoint));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#boss-joint-cancel').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);}
 await load([base]);await page.locator('#boss-joint-tool').click();await ready();
 const pinStyle=page.locator('#boss-joint-pinStyle'),ridge=page.locator('#boss-joint-snapRetentionRidge');
 const engagement=page.locator('#boss-joint-snapEngagement'),shoulder=page.locator('#boss-joint-snapShoulderOffset');
 assert.equal(await pinStyle.inputValue(),'straight');
 assert.ok(await ridge.isHidden());
 assert.equal((await analysis()).snap ?? null,null);
 await pinStyle.selectOption('snap');await ready();
 assert.equal(await engagement.inputValue(),'standard');
 assert.equal(await page.getByRole('button',{name:'ロッカーの寸法を入れる',exact:true}).count(),0);
 assert.equal(await page.locator('#boss-joint-diameter').inputValue(),'6');
 assert.equal(await page.locator('#boss-joint-length').inputValue(),'9.6');
 assert.equal(await page.locator('#boss-joint-bossHeight').inputValue(),'11.3');
 await ridge.check();await ready();
 assert.ok(await shoulder.isDisabled());
 assert.ok(Math.abs((await analysis()).snap.shoulderOffset-.87)<1e-8);
 await page.locator('#boss-joint-section').click();
 const snapPanel=page.locator('#boss-joint-section-panel');
 assert.match(await snapPanel.locator('#boss-section-play-value').textContent(),/軸方向のガタ 0.05 mm/);
 await snapPanel.locator('#boss-section-close').click();
 const comparison=page.waitForEvent('download');
 await page.locator('#boss-joint-snap-test-export').click();
 const file=await comparison;
 assert.match(file.suggestedFilename(),/^boss-engagement/);
 await ready();
 await page.getByRole('button',{name:'2番を適用',exact:true}).click();await ready();
 assert.equal(await ridge.isChecked(),true);
 await page.locator('#boss-joint-apply').click();
 await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);
 assert.equal((await save()).features.at(-1).spec.pinStyle,'snap');

 // Open a saved joint with a manual shoulder setting as well as a retention ridge.
 R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const legacy={type:'bossJoint',id:'legacy-boss',mode:'split',target:base.id,plane:'XY',offset:15,pose:'assembled',count:2,
  pinStyle:'snap',snapEngagement:'strong',snapShoulderOffset:.45,snapRetentionRidge:true,
  diameter:5,length:8,bossWall:1.6,bossHeight:10.5,clearance:.2,spacing:0,offsetU:0,offsetV:0,jointPositions:[[-12,0],[12,0]]};
 const legacyResult=runOperation([base],legacy);
 await load([base,{kind:'cadop',id:legacy.id,name:'ボス接合',spec:legacy,...legacyResult}]);
 const edit=page.locator('#bodies [data-boss-joint-id]').first();
 await edit.click();await ready();
 assert.equal(await pinStyle.inputValue(),'snap');
 assert.equal(await engagement.inputValue(),'strong');
 assert.equal(await ridge.isChecked(),true);
 assert.equal(await shoulder.inputValue(),'0.45');
 assert.equal(await page.locator('#boss-joint-apply').textContent(),'変更を適用');
 assert.deepEqual((await analysis()).positions.map(({uv})=>uv),legacy.jointPositions);
 await engagement.selectOption('light');await ready();
 await page.locator('#boss-joint-apply').click();
 await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);
 const edited=(await save()).features.at(-1);
 assert.equal(edited.spec.pinStyle,'snap');
 assert.equal(edited.spec.snapEngagement,'light');
 assert.equal(edited.spec.snapRetentionRidge,true);
 assert.equal(edited.spec.snapShoulderOffset,.45);
 console.log('PASS standard and snap creation, ridge settings, STL comparison, saved snap editing');
 await load([base]);await page.locator('#boss-joint-tool').click();await ready();assert.equal(await page.locator('#boss-joint-alignmentEnabled').isChecked(),false);for(const key of ['Height','Width','Clearance'])assert.ok(await page.locator('#boss-joint-alignment'+key).isDisabled());
 await page.locator('#boss-joint-shellEnabled').check();await ready();await page.locator('#boss-joint-alignmentEnabled').check();await ready();let a=await analysis();assert.ok(await page.locator('#boss-joint-alignmentPrintSafe').isChecked());assert.equal(a.alignment.width,1.2);assert.equal(a.alignment.outerLand,1.2);assert.equal(a.alignment.innerLand,1.2);assert.equal(a.alignment.floor,1.2);assert.ok(a.alignment.collarAddedVolume>0);await page.locator('#boss-joint-alignmentPrintSafe').uncheck();await page.locator('#boss-joint-alignmentWidth').fill('0.8');await ready();a=await analysis();assert.equal(a.alignment.height,1.5);assert.equal(a.alignment.width,.8);assert.equal(a.alignment.clearance,.25);assert.ok(a.alignment.addedVolume>100);assert.match(await page.locator('#boss-joint-info').textContent(),/位置決め/);
 const camera=await page.locator('[data-camera-state]').getAttribute('data-camera-state'),jobs=await page.evaluate(()=>cadJobs.length);await page.locator('#boss-joint-section').click();const panel=page.locator('#boss-joint-section-panel');await page.waitForFunction(()=>document.getElementById('boss-joint-section-panel').dataset.sectionReady==='true');assert.ok(await panel.isVisible());assert.equal(await panel.locator('[data-boss-section-part]').count(),2);assert.equal(await page.locator('#boss-joint-section').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-camera-state]').getAttribute('data-camera-state'),camera,'opening the section preserves the viewpoint');
 await panel.locator('[data-boss-focus=joint]').click();assert.equal(await panel.getAttribute('data-focus'),'joint');await page.screenshot({path:'.sites-runtime/boss-joint-section-joint.png'});await panel.locator('[data-boss-focus=rim]').click();assert.equal(await panel.getAttribute('data-focus'),'rim');await page.screenshot({path:'.sites-runtime/boss-joint-section-rim.png'});await page.locator('#boss-section-joint').selectOption('1');assert.equal(await panel.getAttribute('data-joint'),'1');await page.locator('#boss-section-reverse').click();assert.equal(await panel.getAttribute('data-reverse'),'true');assert.equal(await page.evaluate(()=>cadJobs.length),jobs,'section controls do not rebuild CAD geometry');
 await page.locator('#boss-joint-alignmentWidth').fill('1.4');await page.waitForFunction(()=>document.querySelector('[data-boss-joint-invalid]'));assert.ok(await page.locator('#boss-joint-apply').isDisabled());assert.match(await page.locator('#boss-joint-error').textContent(),/壁厚/);assert.equal(await panel.locator('[data-boss-section-part]').count(),0,'invalid dimensions clear the stale section');
 await page.locator('#boss-joint-alignmentWidth').fill('0.6');await ready();assert.equal(await panel.locator('[data-boss-section-part]').count(),2);await page.locator('#boss-joint-alignmentHeight').fill('2');await ready();await page.locator('#boss-joint-alignmentClearance').fill('0.2');await ready();a=await analysis();assert.equal(a.alignment.grooveDepth,2.2);assert.equal(await panel.getAttribute('data-focus'),'rim');assert.match(await page.locator('#boss-section-metrics').textContent(),/2.00/);
 await panel.locator('[data-boss-focus=all]').click();await page.locator('#boss-joint-pose').selectOption('assembled');await ready();assert.equal(await panel.locator('[data-boss-section-part]').count(),2);await page.screenshot({path:'.sites-runtime/boss-joint-section-assembled.png'});await page.locator('#boss-section-close').click();assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('#boss-joint-section').getAttribute('aria-pressed'),'false');await page.locator('#boss-joint-section').click();assert.ok(await panel.isVisible());
 await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);assert.equal(await panel.isVisible(),false);const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.spec.alignmentEnabled,true);assert.equal(joint.spec.alignmentHeight,2);assert.equal(joint.spec.alignmentWidth,.6);assert.equal(joint.spec.alignmentClearance,.2);assert.equal(joint.outputs.length,2);await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.alignmentEnabled,true);
 await load(saved.features);await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.ok(await page.locator('#boss-joint-alignmentEnabled').isChecked());assert.equal(await page.locator('#boss-joint-alignmentHeight').inputValue(),'2');assert.equal(await page.locator('#boss-joint-alignmentWidth').inputValue(),'0.6');assert.equal(await panel.isVisible(),false);await page.locator('#boss-joint-alignmentEnabled').uncheck();await ready();await page.locator('#boss-joint-section').click();assert.ok(await panel.locator('[data-boss-focus=rim]').isDisabled());await close();assert.equal(await panel.isVisible(),false);assert.equal((await save()).features.at(-1).spec.alignmentEnabled,true,'cancel keeps the saved alignment');
 await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.equal(await page.locator('#boss-joint-alignmentPrintSafe').isChecked(),false);await page.locator('#boss-joint-alignmentPrintSafe').check();await ready();assert.equal(await page.locator('#boss-joint-alignmentWidth').inputValue(),'1.2');a=await analysis();assert.ok(a.alignment.printSafe);assert.equal(a.alignment.outerLand,1.2);await page.locator('#boss-joint-section').click();await panel.locator('[data-boss-focus=rim]').click();await page.screenshot({path:'.sites-runtime/boss-joint-nozzle-safe.png'});await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);const safeSaved=await save();assert.equal(safeSaved.features.at(-1).spec.alignmentPrintSafe,true);await load(safeSaved.features);await page.locator('#bodies [data-boss-joint-id]').last().click();await ready();assert.ok(await page.locator('#boss-joint-alignmentPrintSafe').isChecked());assert.equal((await analysis()).alignment.innerLand,1.2);await page.locator('#boss-joint-alignmentPrintSafe').uncheck();await close();assert.equal((await save()).features.at(-1).spec.alignmentPrintSafe,true);
 await load([base]);await page.locator('#boss-joint-tool').click();await page.setViewportSize({width:1280,height:900});await ready();await page.locator('#boss-joint-section').click();await page.screenshot({path:'.sites-runtime/boss-joint-section-small.png'});await page.locator('#boss-joint-shellEnabled').check();await close();await page.waitForTimeout(500);assert.equal(await panel.isVisible(),false);assert.equal((await save()).features.length,1,'cancel while updating leaves the source intact');assert.deepEqual(errors,[]);console.log('PASS alignment option/dimensions, actual section/3D half, joint/rim focus, print/assembled, reverse, unchanged view/no CAD rerun, invalid recovery, save/reload/edit, undo/redo and cancellation');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
