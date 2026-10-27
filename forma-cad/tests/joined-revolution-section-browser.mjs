import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {binaryStlReport} from './stl-topology.mjs';

const record=JSON.parse(await fs.readFile('tests/fixtures/joined-revolution-section-failure.forma.json','utf8')),spec=record.failure.request.spec,doc={format:'forma-cad',version:1,units:'mm',features:record.failure.request.features},root=path.resolve('dist'),out=process.env.FORMA_SECTION_TEST_OUT||'.sites-runtime/joined-revolution-section-browser';
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(url==='/'?'/index.html':decodeURIComponent(url)));if(!file.startsWith(root+path.sep))throw Error();const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1800,height:1200},acceptDownloads:true}),errors=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
async function download(button){const [event]=await Promise.all([page.waitForEvent('download'),button.click()]);return fs.readFile(await event.path());}
async function save(){return JSON.parse(await download(page.locator('#save')));}
async function load(model=doc){await page.locator('#file').setInputFiles({name:'joined-section.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(model))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
async function split(keep){await page.locator('#section-toggle').click();await page.locator('#section-target').selectOption(spec.target);await page.locator('#section-plane').selectOption(spec.plane);await page.locator('#section-offset').fill(String(spec.offset));await page.locator('#section-keep').selectOption(keep);await page.locator('#section-split').click();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sectionActive==='false'||(!document.getElementById('section-split').disabled&&document.getElementById('section-split-error').textContent));assert.equal(await page.locator('#section-panel').isVisible(),false,await page.locator('#section-split-error').textContent());return save();}
try{
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');await page.locator('#canvas-host canvas').waitFor();await load();
 const original=await save(),positive=await split('positive');assert.equal(positive.features.at(-1).outputs.length,1);assert.equal(positive.features.at(-1).spec.offset,spec.offset);assert.equal(positive.features.at(-1).spec.target,spec.target);assert.deepEqual(positive.features.slice(0,original.features.length),original.features);
 const bytes=await download(page.locator('#export')),stl=binaryStlReport(bytes);for(const key of ['boundary','nonmanifold','orientation','degenerate'])assert.equal(stl[key],0,key);await fs.writeFile(out+'/positive.stl',bytes);await fs.writeFile(out+'/positive.forma.json',JSON.stringify(positive));await page.screenshot({path:out+'/positive.png'});
 await page.locator('#undo').click();assert.deepEqual((await save()).features,original.features);await page.locator('#redo').click();assert.deepEqual((await save()).features.at(-1).spec,positive.features.at(-1).spec);await load(positive);assert.deepEqual((await save()).features.at(-1).spec,positive.features.at(-1).spec);
 await load();const both=await split('both');assert.equal(both.features.at(-1).outputs.length,2);assert.equal(await page.locator('#body-count').textContent(),'2');await load(both);assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual((await save()).features.at(-1).outputs,both.features.at(-1).outputs);await fs.writeFile(out+'/both.forma.json',JSON.stringify(both));await page.screenshot({path:out+'/both.png'});
 assert.deepEqual(errors,[]);const proof={pass:true,inputTarget:spec.target,originalFailurePosition:spec.offset,originalFailureMode:true,bothSides:true,closedStl:stl,sourceHistoryUnchanged:true,undoRedo:true,saveReload:true,errors};await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){console.error(await page.locator('#section-split-error').textContent().catch(()=>''),errors);await page.screenshot({path:out+'/failure.png'});throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
