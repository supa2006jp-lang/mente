import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const output='.sites-runtime/revolve-edit-and-point-range';
await fs.mkdir(output,{recursive:true});
const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async (request,response)=>{
 try{
  const url=new URL(request.url,'http://localhost');
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  assert(file.startsWith(root+path.sep));
  const data=await fs.readFile(file);
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);
 }catch{response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1720,height:1110},acceptDownloads:true});
 const field=id=>page.locator('#'+id);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 async function load(features){
  const model={format:'forma-cad',version:1,units:'mm',features};
  await field('file').setInputFiles({name:'test.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(model))});
  await field('project-preview-open').click();
  await field('project-load-preview').waitFor({state:'hidden'});
 }
 async function save(){
  const pending=page.waitForEvent('download');
  await field('save').click();
  return JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
 }
 async function parts(count){
  await page.locator('.revolve-join-status[data-parts="'+count+'"]').waitFor({timeout:60000});
 }
 function step(history,spec,name){
  return {kind:'cadop',id:spec.id,name,spec,...runOperation(history,spec)};
 }
 const base={...defaults,id:'base',name:'台座',kind:'extrusion',profile:'circle',diameter:70,depth:10};
 const source={...base,id:'source',name:'円柱',diameter:10,depth:4,x:23,z:10};
 const far={...base,id:'far',name:'遠い台座',z:40};
 await load([base,source,far]);
 await field('direct-revolve').click();
 await field('revolve-kind').selectOption('body');
 await field('revolve-body').selectOption('source');
 await field('revolve-axis').selectOption('Z');
 await field('revolve-operation').selectOption('join');
 await field('revolve-target').selectOption('far');
 await parts(2);
 assert.match(await field('revolve-preview-phase').textContent(),/遠い台座/);
 await field('revolve-target').selectOption('base');
 await parts(1);
 assert.match(await field('revolve-preview-phase').textContent(),/結合先 台座/);
 await field('fit').click();
 await page.screenshot({path:output+'/revolve-preview.png'});
 await field('cad-cancel').click();

 const history=[base,source];
 history.push(step(history,{id:'sweep',type:'revolve',bodySweep:true,sourceBody:'source',target:'base',operation:'join',origin:[1,0,0],axisVector:[0,0,1],angle:360,direction:'片側'},'回転'));
 history.push(step(history,{id:'move-base',type:'move',target:'base',x:12,y:0,z:0,rotation:[0,0,0]},'台座を移動'));
 history.push(step(history,{id:'move-source',type:'move',target:'source',x:0,y:20,z:0,rotation:[0,0,0]},'円柱を移動'));
 await load(history);
 const before=await save();
 const openEdit=()=>page.locator('#features [data-history-feature="sweep"] button').click();
 await openEdit();
 await page.getByRole('heading',{name:'回転を再編集'}).waitFor();
 assert.equal(await field('revolve-angle').inputValue(),'360');
 assert(await field('revolve-keep-source').isChecked());
 await field('revolve-axis').selectOption('Z');
 await field('revolve-angle').fill('180');
 await parts(1);
 await field('cad-apply').click();
 await field('tools-dialog').waitFor({state:'hidden',timeout:60000});
 const edited=await save();
 assert.equal(edited.features.length,before.features.length);
 assert.deepEqual(edited.features[2].spec.origin,[0,0,0]);
 assert.equal(edited.features[2].spec.angle,180);
 assert.notEqual(edited.features[3].outputs[0].brep,before.features[3].outputs[0].brep);
 await openEdit();
 await field('revolve-keep-source').uncheck();
 await field('cad-apply').click();
 await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('円柱を移動'),null,{timeout:60000});
 assert(await field('tools-dialog').isVisible());
 await field('cad-cancel').click();
 assert.deepEqual((await save()).features,edited.features);

 await load([]);
 await field('new-point').click();
 const canvas=await page.locator('#canvas-host canvas').boundingBox();
 const center=[canvas.x+canvas.width/2-28,canvas.y+canvas.height/2+26];
 await field('snap-enabled').uncheck();
 await page.mouse.click(center[0]-100,center[1]);
 await page.mouse.click(center[0]+100,center[1]);
 await field('snap-enabled').check();
 async function drag(a,b){
  await page.mouse.move(center[0]+a[0],center[1]+a[1]);await page.mouse.down();
  await page.mouse.move(center[0]+b[0],center[1]+b[1],{steps:6});
  await page.locator('#selection-box[data-point="true"]').waitFor();
 }
 await drag([-92,-66],[92,66]);
 assert.equal(await field('feature-count').textContent(),'2');
 await field('canvas-host').screenshot({path:output+'/point-range.png'});
 await page.mouse.up();
 assert.equal(await field('feature-count').textContent(),'3');
 await drag([70,80],[-70,-80]);
 await page.keyboard.press('Escape');
 await page.mouse.up();
 assert.equal(await field('feature-count').textContent(),'3');
 assert.equal(await field('selection-box').isVisible(),false);
 assert(await field('sketch-banner').isVisible());
 await page.keyboard.press('Escape');
 const points=(await save()).features;
 assert.equal(points.length,3);
 assert(points.every(f=>f.profile==='point'&&f.groupId===points[0].groupId));
 for(const coord of ['x','y','z'])assert(Math.abs(points[2][coord]-(points[0][coord]+points[1][coord])/2)<1e-5,coord);
 assert.deepEqual(errors,[]);
 const proof={pass:true,connectedAndSeparated:true,targetLegend:true,editAxisAndAngle:true,successorReplay:true,failedReplayRollback:true,rangeCenter:true,clickStillWorks:true,escapeCancelsRange:true,errors};
 await fs.writeFile(output+'/proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{await browser?.close();server.close();}
