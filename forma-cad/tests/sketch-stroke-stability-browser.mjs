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
 const context=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:Number(process.env.STROKE_DPR)||1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const host=page.locator('#canvas-host');let strokeEnds=[[-45,-25,20],[45,25,20]];
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:60,height:40,depth:20},line={...defaults,id:'line',kind:'sketch',name:'面上の線',profile:'polyline',mode:'thin',points:[[-45,-25],[45,25]],z:20,groupId:'g',groupNumber:1};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'stroke.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function sample(points){await page.mouse.move(20,20);await page.waitForTimeout(100);const a=await screen(strokeEnds[0]),b=await screen(strokeEnds[1]),length=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[(b[1]-a[1])/length,-(b[0]-a[0])/length],centers=await Promise.all(points.map(screen)),density=await page.evaluate(()=>devicePixelRatio),shot=await page.screenshot();return page.evaluate(async({data,centers,normal,density})=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return centers.map(p=>Array.from({length:41},(_,i)=>{const d=(i-20)/4;return {d,rgb:Array.from(ctx.getImageData(Math.round((p[0]+normal[0]*d)*density),Math.round((p[1]+normal[1]*d)*density),1,1).data)};}));},{data:shot.toString('base64'),centers,normal,density});}
 const blue=rgb=>rgb[2]>rgb[0]+50&&rgb[2]>rgb[1]+30&&rgb[0]<100,white=rgb=>rgb.slice(0,3).every(v=>v>218)&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<16;
 await load([box,line]);
 for(const view of ['top','iso']){await page.locator('[data-view='+view+']').click();await page.waitForTimeout(100);for(const zoom of [1,.6,1.8]){if(zoom!==1){const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,zoom<1?300:-450);await page.waitForTimeout(120);}const rows=await sample([[-20,-100/9,20],[0,0,20],[20,100/9,20],[35,175/9,20]]);for(const [i,row]of rows.entries()){assert.ok(row.some(({rgb})=>blue(rgb)),view+' '+zoom+' '+i+': blue stroke');for(const side of [-1,1]){if(!row.some(({d,rgb})=>d*side>.75&&d*side<4.3&&white(rgb))){console.log(JSON.stringify({view,zoom,i,side,row}));await page.screenshot({path:'.sites-runtime/sketch-stroke-failure.png'});}assert.ok(row.some(({d,rgb})=>d*side>.75&&d*side<4.3&&white(rgb)),view+' '+zoom+' '+i+': white border on side '+side);}}}}
 await page.screenshot({path:'.sites-runtime/sketch-stroke-stable.png'});
 await page.locator('[data-view=bottom]').dispatchEvent('keydown',{key:'Enter'});const hidden=await sample([[0,0,20]]);assert.ok(!hidden[0].some(({rgb})=>blue(rgb)||white(rgb)),'opaque body still hides rear sketch');
 await load([box,line,{...box,id:'blocker',width:12,height:12,depth:10,z:25}]);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});const covered=await sample([[0,0,20]]);assert.ok(!covered[0].some(({rgb})=>blue(rgb)||white(rgb)),'foreground body hides the entire stroke');

 const side={...line,plane:'YZ',x:30,z:0,points:[[-5,-15],[-15,15]]};strokeEnds=[[30,-15,5],[30,15,15]];await load([box,side]);for(const view of ['right','iso']){await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});const rows=await sample([[30,-6,8],[30,6,12]]);for(const row of rows){assert.ok(row.some(({rgb})=>blue(rgb)));for(const sign of [-1,1])assert.ok(row.some(({d,rgb})=>d*sign>.75&&d*sign<4.3&&white(rgb)),view+': side face border');}}
 const frame={u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]},world=([x,y])=>new THREE.Vector3(...frame.n).multiplyScalar(20).addScaledVector(new THREE.Vector3(...frame.u),x).addScaledVector(new THREE.Vector3(...frame.v),y).toArray();strokeEnds=line.points.map(world);await load([{...box,plane:'CUSTOM',frame},{...line,plane:'CUSTOM',frame,x:Math.SQRT1_2*20,z:Math.SQRT1_2*20}]);await page.locator('[data-view=iso]').click();for(const row of await sample([world([-20,-100/9]),world([20,100/9])])){assert.ok(row.some(({rgb})=>blue(rgb)));for(const sign of [-1,1])assert.ok(row.some(({d,rgb})=>d*sign>.75&&d*sign<4.3&&white(rgb)),'tilted custom plane border');}
 assert.deepEqual(errors,[]);await context.close();console.log('PASS continuous white borders on both sides across surface/air, views and zooms; rear and foreground occlusion');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
