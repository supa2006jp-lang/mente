import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';

const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1800,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.shortcutJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(p,...args){if(p.spec)window.shortcutJobs.push(p.spec.type);return post.call(this,p,...args);};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),canvas=page.locator('#canvas-host canvas'),shortcut=page.locator('#face-extrude-shortcut'),panel=page.locator('#extrude-distance'),picker=page.locator('#selection-candidates');
 const box={...defaults,id:'b',kind:'extrusion',name:'平面プル確認',width:30,height:30,depth:8};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'pull.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(200);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function pull(distance,z){await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([4,-4,z]));await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.selectedFaceCount==='1');await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('pull');await page.locator('#cad-distance').fill(String(distance));await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:60000});assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());}
 function check(data,expectedVolume,top){const bodies=rebuild(data.features);try{assert.equal(bodies.size,1);const g=bodies.get('b').geometry;g.computeBoundingBox();assert.ok(Math.abs(volume(g)-expectedVolume)<.01);assert.ok(Math.abs(g.boundingBox.max.z-top)<1e-5);}finally{for(const body of bodies.values())body.geometry.dispose();}}
 await load([box]);await pull(.2,8);let data=await save();assert.equal(data.features.at(-1).spec.type,'pull');assert.equal(data.features.at(-1).spec.distance,.2);assert.equal(data.features.at(-1).spec.faces.length,1);check(data,7380,8.2);await page.screenshot({path:'.sites-runtime/positive-face-pull-preview.png'});
 await page.keyboard.press('Control+z');check(await save(),7200,8);await page.keyboard.press('Control+y');check(await save(),7380,8.2);
 await load(data.features);await pull(.2,8.2);data=await save();check(data,7560,8.4);await pull(-.2,8.4);check(await save(),7380,8.2);
 assert.deepEqual(errors,[]);const proof={positiveSelectedPlane:true,exactVolumeAndExtent:true,validSingleBody:true,savedReload:true,repeatedPositivePull:true,negativePullPreserved:true,undoRedo:true,errors};await fs.writeFile('.sites-runtime/positive-face-pull-browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
