import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import {strFromU8,unzipSync} from 'three/addons/libs/fflate.module.js';
import {defaults} from '../src/geometry.js';

const root=path.resolve('dist'),types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{
 const request=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(request==='/'?'/index.html':decodeURIComponent(request)));
 if(!file.startsWith(root+path.sep))throw Error('Outside build');
 res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await fs.readFile(file));
}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1500,height:950},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const box=(id,x,color)=>({...defaults,id,name:id,kind:'extrusion',width:10,height:10,depth:10,x,bodyColors:{[id]:color}});
 async function load(doc,count){
  await page.locator('#file').setInputFiles({name:'volumes.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(n=>document.getElementById('body-count').textContent===n,count);
 }
 async function download(selector){const [file]=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]);return fs.readFile(await file.path());}
 await load({format:'forma-cad',version:1,features:[box('a',0,'#cc2222'),box('b',6,'#1144bb')]},'2');
 await page.locator('[data-body-id=a] .row-label').click();await page.locator('#join-tool').click();
 await page.locator('#cad-keepTools').selectOption('削除');await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const canvas=page.locator('#canvas-host canvas');
 async function palette(){const png=(await canvas.screenshot({scale:'css'})).toString('base64');return page.evaluate(async png=>{
  const image=await createImageBitmap(await (await fetch('data:image/png;base64,'+png)).blob()),surface=new OffscreenCanvas(image.width,image.height),ctx=surface.getContext('2d');
  ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;let red=0,blue=0;
  for(let i=0;i<pixels.length;i+=4){const [r,g,b]=pixels.subarray(i,i+3);if(r>g+48&&r>b+48)red++;if(b>r+48&&b>g+38)blue++;}
  return {red,blue};
 },png);}
 const painted=await palette();assert.ok(painted.red>5000&&painted.blue>3000,JSON.stringify(painted));
 const saved=JSON.parse(await download('#save'));assert.equal(saved.features.at(-1).outputs[0].materialParts.length,2);
 await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2');
 await page.locator('#redo').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await load(saved,'1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const reopened=await palette();assert.ok(reopened.red>5000&&reopened.blue>3000,JSON.stringify(reopened));
 const colorButton=page.locator('[data-body-id=a] .body-color-button'),dialog=page.locator('#body-color-dialog');
 assert.equal(await colorButton.textContent(),'2色');
 await colorButton.click();assert.equal(await dialog.locator('h2').textContent(),'ボディ全体を単色に変更');
 await dialog.locator('input[type=color]').fill('#228822');await dialog.locator('[type=submit]').click();
 assert.equal(await colorButton.textContent(),'色');
 await colorButton.click();await dialog.locator('[data-reset]').click();assert.equal(await colorButton.textContent(),'2色');
 const zip=unzipSync(await download('#export-color-3mf')),model=strFromU8(zip['3D/3dmodel.model']);
 assert.match(model,/<components><component objectid="2"\/><component objectid="3"\/><\/components>/);
 assert.deepEqual(errors,[]);
 console.log('PASS UI join keeps both colors, undo/redo, save/reopen and grouped volume 3MF');
}finally{await browser?.close();server.close();}
