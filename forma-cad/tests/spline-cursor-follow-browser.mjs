import * as THREE from 'three';
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
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);
 await page.locator('#new-spline').click();await page.locator('#snap-enabled').uncheck();
 const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2;
 const fixed=[],positions=[[-190,30],[-110,-100],[20,70],[140,-65],[230,40]].map(([x,y])=>[cx+x,cy+y]);
 async function checkTip(tip){
  await page.mouse.move(...tip);await page.waitForTimeout(120);
  assert.equal(await page.locator('#canvas-host').getAttribute('data-spline-preview-points'),String(fixed.length+1));
  const curve=new THREE.CatmullRomCurve3([...fixed,tip].map(p=>new THREE.Vector3(...p,0)),false,'centripetal');
  const centers=[.90,.93,.96].map(t=>curve.getPoint(t).toArray().slice(0,2)),shot=await page.screenshot();
  const visible=await page.evaluate(async({data,centers})=>{
   const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return centers.map(([x,y])=>{const pixels=ctx.getImageData(Math.round(x)-4,Math.round(y)-4,9,9).data;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]<60&&pixels[i+1]>70&&pixels[i+1]<170&&pixels[i+2]>120&&pixels[i+2]<220)return true;
    return false;});
  },{data:shot.toString('base64'),centers});
  if(!visible.every(Boolean))await page.screenshot({path:'.sites-runtime/spline-follow-failure.png'});
  assert.ok(visible.every(Boolean),'Rendered spline must reach cursor after '+fixed.length+' fit points: '+visible);
 }
 await page.mouse.click(...positions[0]);fixed.push(positions[0]);
 for(let i=1;i<positions.length;i++){
  await checkTip(positions[i]);
  await checkTip([positions[i][0]+25,positions[i][1]+25]);
  await checkTip(positions[i]);
  await page.mouse.click(...positions[i]);fixed.push(positions[i]);
  // Leaving the canvas shrinks the preview back to committed fit points.
  await page.mouse.move(20,20);await page.waitForTimeout(80);
 }
 await checkTip([cx+290,cy-90]);
 await page.keyboard.press('Enter');
 const pending=page.waitForEvent('download');await page.locator('#save').click();const file=await pending;
 const data=JSON.parse(await fs.readFile(await file.path(),'utf8'));
 assert.equal(data.features.length,1);assert.equal(data.features[0].points.length,fixed.length,'hover point is not committed');
 const actual=data.features[0].points,scale=Math.hypot(actual[1][0]-actual[0][0],actual[1][1]-actual[0][1])/Math.hypot(fixed[1][0]-fixed[0][0],fixed[1][1]-fixed[0][1]);
 for(let i=1;i<fixed.length;i++)assert.ok(Math.abs(Math.hypot(actual[i][0]-actual[0][0],actual[i][1]-actual[0][1])-scale*Math.hypot(fixed[i][0]-fixed[0][0],fixed[i][1]-fixed[0][1]))<.001,'clicked fit points retain position');
 assert.deepEqual(errors,[]);console.log('PASS rendered spline follows cursor through 2–6 points, repeated movement, leave/reentry and saved fit points');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
