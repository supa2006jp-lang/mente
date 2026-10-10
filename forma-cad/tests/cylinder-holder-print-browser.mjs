import * as THREE from 'three';
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
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader error/i.test(m.text()))errors.push(m.text());});page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#cylinder-hinge-error').textContent());}}
 async function analysis(){return page.locator('[data-cylinder-hinge]').evaluate(el=>JSON.parse(el.dataset.cylinderHinge));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#cylinder-hinge-cancel').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);}

const cylinder={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:90,depth:100};
 const stlBounds=buffer=>{const count=buffer.readUInt32LE(80),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];assert.equal(buffer.length,84+count*50);for(let i=0;i<count;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++){const value=buffer.readFloatLE(84+i*50+12+j*12+k*4);min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);}return {count,min,max};};
 await load([cylinder]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await ready();
 assert.equal(await page.locator('#cylinder-hinge-printArrange').isChecked(),false);assert.ok(await page.locator('#cylinder-hinge-printMargin').isDisabled());assert.equal((await analysis()).printBounds.fits,false);
 await page.locator('#cylinder-hinge-printArrange').check();await ready();
 let a=await analysis();assert.equal(a.layout.margin,2);assert.equal(a.layout.fits,false);assert.ok(a.layout.requiredSquare>180);assert.ok((await page.locator('#cylinder-hinge-plate-info').textContent()).includes('必要なプレート'));
 await page.locator('#cylinder-hinge-printMargin').fill('0');await ready();a=await analysis();assert.equal(a.layout.fits,true);assert.equal(a.angle,90);assert.ok(a.layout.angle>0);assert.ok(Math.abs(a.printBounds.min[0]+a.printBounds.max[0])<1e-6);await page.locator('#cylinder-hinge-plate-info').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/cylinder-pair-arranged.png'});
 await page.locator('#cylinder-hinge-apply').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);
 const saved=await save();assert.equal(saved.features.at(-1).spec.printArrange,true);assert.equal(saved.features.at(-1).spec.printMargin,0);
 const download=page.waitForEvent('download');await page.locator('#export').click();const exported=stlBounds(await fs.readFile(await(await download).path()));for(const axis of [0,1])assert.ok(exported.min[axis]>=-90-1e-4&&exported.max[axis]<=90+1e-4);assert.ok(Math.abs(exported.min[2])<1e-6);assert.equal(exported.count,saved.features.at(-1).outputs.reduce((sum,o)=>sum+o.triangles.length/3,0),'STL contains two arranged components, no preview plate');
 await load(saved.features);await page.locator('[data-cylinder-hinge-id]').first().click();await ready();assert.ok(await page.locator('#cylinder-hinge-printArrange').isChecked());assert.equal(await page.locator('#cylinder-hinge-printMargin').inputValue(),'0');
 await page.locator('#cylinder-hinge-pose').selectOption('closed');await ready();assert.ok(await page.locator('#cylinder-hinge-printArrange').isDisabled());assert.equal((await analysis()).layout,null);
 await page.locator('#cylinder-hinge-fitHolder').check();await page.locator('#cylinder-hinge-holderDiameter').fill('84');await page.locator('#cylinder-hinge-holderGap').fill('0.3');await page.locator('#cylinder-hinge-lipInset').fill('1.4');await page.locator('#cylinder-hinge-lipHeight').fill('3');await ready();
 const ringDownload=page.waitForEvent('download');await page.locator('#cylinder-hinge-test-export').click();const file=await ringDownload;assert.equal(file.suggestedFilename(),'holder-fit-ring.stl');const ring=stlBounds(await fs.readFile(await file.path()));await page.waitForFunction(()=>document.getElementById('cylinder-hinge-test-status').textContent.includes('STL出力しました'));
 const test=await page.locator('[data-cylinder-holder-test]').evaluate(el=>JSON.parse(el.dataset.cylinderHolderTest));assert.equal(test.innerDiameter,84.6);assert.equal(test.lipInset,1.4);assert.equal(test.lipHeight,3);assert.equal(test.height,6);assert.ok(Math.abs(ring.min[2])<1e-6&&Math.abs(ring.max[2]-6)<1e-5);assert.ok(Math.abs(ring.min[0]+45)<.1&&Math.abs(ring.max[0]-45)<.1);assert.deepEqual((await save()).features,saved.features,'test export leaves model/history unchanged despite unsaved dialog changes');
 await page.locator('#cylinder-hinge-test-export').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/cylinder-holder-test-export.png'});
 page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());await page.locator('#cylinder-hinge-test-export').click();await page.waitForFunction(()=>document.getElementById('cylinder-hinge-test-status').textContent.includes('キャンセル'));assert.equal(await page.locator('[data-cylinder-holder-test]').count(),0);assert.equal(await page.locator('#cylinder-hinge-apply').isDisabled(),false);page.on('dialog',d=>d.accept(d.defaultValue()));
 await close();assert.deepEqual((await save()).features,saved.features);
 const legacy=structuredClone(saved.features);delete legacy.at(-1).spec.printArrange;delete legacy.at(-1).spec.printMargin;await load(legacy);await page.locator('[data-cylinder-hinge-id]').first().click();await ready();assert.equal(await page.locator('#cylinder-hinge-printArrange').isChecked(),false);assert.equal((await analysis()).layout,null);await close();
 assert.deepEqual(errors,[]);console.log('PASS grouped plate search and required size, centered STL without preview helpers, saved re-edit, unsaved-dimension ring STL, unchanged project/history, save cancellation and legacy opt-in');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
