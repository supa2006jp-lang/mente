import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {defaults} from '../src/geometry.js';

const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1700,height:1200}}),errors=[];
 page.setDefaultTimeout(180000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const source={format:'forma-cad',version:1,features:[{...defaults,id:'body',name:'円柱',kind:'extrusion',profile:'circle',diameter:60,depth:80}]};
 await page.locator('#file').setInputFiles({name:'stop-face.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
 await page.locator('#project-preview-open').click();
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-coil-joint').evaluate(element=>element.click());
 const ready=()=>page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='coilJoint'&&!document.getElementById('coil-stop-face-handle').hidden&&document.getElementById('cad-error').textContent.includes('確定します'));
 await ready();
 await page.screenshot({path:'.sites-runtime/coil-stop-face-preview.png'});
 assert.equal(await page.locator('#cad-stopFaceSetback').inputValue(),'0');
 assert.equal(await page.locator('#coil-stop-face-viewport-setback').inputValue(),'0');
 await page.locator('#coil-stop-face-viewport-setback').fill('0.65');
 await ready();
 assert.equal(await page.locator('#cad-stopFaceSetback').inputValue(),'0.65');
 const start=JSON.parse(await page.locator('#canvas-host').getAttribute('data-coil-stop-face'));
 assert.equal(start.setback,.65);
 const camera=await page.locator('#canvas-host').getAttribute('data-camera-state'),handle=page.locator('#coil-stop-face-handle'),rect=await handle.boundingBox();
 const transform=await handle.evaluate(element=>element.style.transform),angle=Number(transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]??0)*Math.PI/180;
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
 await page.mouse.move(rect.x+rect.width/2+Math.cos(angle)*20,rect.y+rect.height/2+Math.sin(angle)*20,{steps:5});
 assert.equal(JSON.parse(await page.locator('#canvas-host').getAttribute('data-coil-stop-face')).dragging,true);
 assert.notEqual(Number(await page.locator('#cad-stopFaceSetback').inputValue()),.65);
 assert.equal(await page.locator('#canvas-host').getAttribute('data-camera-state'),camera);
 await page.mouse.up();await ready();
 await page.locator('#cad-latchStyle').selectOption('claw');
 await page.waitForFunction(()=>document.getElementById('coil-stop-face-handle').hidden);
 await page.locator('#cad-latchStyle').selectOption('ridge');
 await ready();
 assert.deepEqual(errors,[]);
 console.log('PASS stop-face numeric sync, drag, camera preservation, ridge/claw visibility');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
