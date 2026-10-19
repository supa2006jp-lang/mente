import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const fixture=await fs.readFile('.sites-runtime/section-thread-cap-fixture.forma.json');
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1800,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.sectionJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(p,...args){if(p.spec)window.sectionJobs.push(p.spec.type);return post.call(this,p,...args);};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');const host=page.locator('#canvas-host'),canvas=page.locator('#canvas-host canvas');
 await page.locator('#file').setInputFiles({name:'thread-section.forma.json',mimeType:'application/json',buffer:fixture});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),camera=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);camera.position.fromArray(s);camera.quaternion.fromArray(s,3);camera.zoom=s[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(camera);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 const before=(await save()).features,preview=page.locator('#section-preview'),reverse=page.locator('#section-reverse'),keep=page.locator('#section-keep');
 await page.locator('[data-view=front]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(250);await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([0,-8.660254,5]));await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.selectedFaceCount==='1');const jobs=await page.evaluate(()=>window.sectionJobs.length);
 await page.locator('#section-toggle').click();assert.equal(await preview.isChecked(),false);assert.equal(await reverse.isEnabled(),true);assert.equal(await page.locator('#section-body-identify').isChecked(),true);assert.equal(await keep.inputValue(),await reverse.isChecked()?'negative':'positive');assert.equal(await page.locator('#section-plane').inputValue(),'XZ');assert.equal(Number(await page.locator('#section-offset').inputValue()),0);assert.equal(await host.getAttribute('data-section-active'),'true');assert.equal(await host.getAttribute('data-section-preview'),'false');assert.ok(Number(await host.getAttribute('data-section-segments'))>100);
 await page.screenshot({path:'.sites-runtime/section-thread-cap-preview.png'});
 // Explicit split previews remain available; reopening returns to inspection.
 await preview.check();await keep.selectOption('both');assert.equal(await host.getAttribute('data-section-preview'),'true');await page.locator('#section-close').click();await page.locator('#section-toggle').click();assert.equal(await preview.isChecked(),false);assert.equal(await keep.inputValue(),await reverse.isChecked()?'negative':'positive');assert.equal(await reverse.isEnabled(),true);
 await reverse.setChecked(!await reverse.isChecked());assert.equal(await keep.inputValue(),await reverse.isChecked()?'negative':'positive');await page.locator('#section-close').click();assert.equal(await host.getAttribute('data-section-active'),'false');
 assert.equal(await page.evaluate(()=>window.sectionJobs.length),jobs,'section inspection requires no CAD calculation');assert.deepEqual((await save()).features,before);assert.deepEqual(errors,[]);
 const proof={previewDefault:false,identifyDefault:true,visibleSideDefault:true,selectedFaceOrientation:true,centeredSection:true,reopenResetsPreview:true,reverseUpdatesRetainedSide:true,noCadJobs:true,sourceUnchanged:true,errors};console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/section-display-defaults-browser-proof.json',JSON.stringify(proof,null,2));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
