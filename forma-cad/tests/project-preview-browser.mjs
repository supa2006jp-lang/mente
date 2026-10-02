import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
import {previewImageSource} from '../src/project-preview.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true}),errors=[];
 p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept(d.defaultValue()));
 await p.goto('http://127.0.0.1:5188');
 const documentData={format:'forma-cad',version:1,units:'mm',features:[{...defaults,id:'box',name:'確認する箱',width:35,height:25,depth:20},{...defaults,id:'cylinder',name:'円柱',profile:'circle',diameter:20,depth:35,x:50}]};
 const pick=async(data,name='preview.forma.json')=>{await p.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(()=>document.getElementById('file').value==='');};
 const open=async data=>{await pick(data);await p.locator('#project-preview-open').click();await p.waitForTimeout(80);};
 const save=async()=>{const next=p.waitForEvent('download');await p.locator('#save').click();return JSON.parse(await fs.readFile(await(await next).path(),'utf8'));};
 const sameCamera=(actual,expected)=>assert.ok(JSON.parse(actual).every((v,i)=>Math.abs(v-JSON.parse(expected)[i])<1e-8),'save preserves viewpoint');
 const original=await save();await pick(documentData,'old.forma.json');assert.equal(await p.locator('#project-load-preview').isVisible(),true);assert.equal(await p.locator('#project-preview-empty').isVisible(),true);assert.equal(await p.locator('#feature-count').textContent(),String(original.features.length),'no load before explicit Open');await p.locator('#project-preview-cancel').click();assert.deepEqual((await save()).features,original.features);
 await open(documentData);assert.equal(await p.locator('#body-count').textContent(),'2');await p.locator('[data-view=iso]').click();await p.waitForTimeout(500);
 const host=p.locator('#canvas-host'),camera=await host.getAttribute('data-camera-state'),saved=await save();assert.ok(previewImageSource(saved.preview));assert.equal(saved.preview.width,640);assert.equal(saved.preview.height,480);assert.ok(saved.preview.dataUrl.length<200000);sameCamera(await host.getAttribute('data-camera-state'),camera);assert.deepEqual(saved.features,documentData.features);
 await pick(saved,'box-and-cylinder.forma.json');await p.locator('#project-preview-image').evaluate(img=>img.decode());assert.equal(await p.locator('#project-preview-name').textContent(),'box-and-cylinder.forma.json');
 const imageStats=await p.locator('#project-preview-image').evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let colored=0,minX=c.width,minY=c.height,maxX=0,maxY=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(Math.min(a[i],a[i+1],a[i+2])<210){colored++;minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);}}return {colored,minX,maxX,minY,maxY};});assert.ok(imageStats.colored>5000,'rendered model, not blank');assert.ok(imageStats.minX>5&&imageStats.maxX<635&&imageStats.minY>5&&imageStats.maxY<475,'full geometry fits thumbnail');
 await p.screenshot({path:'.sites-runtime/project-load-preview.png'});await p.keyboard.press('Escape');assert.equal(await p.locator('#project-load-preview').isVisible(),false);assert.deepEqual((await save()).features,saved.features);
 // All saved bodies are pictured, even during hidden/section display. No display or camera changes.
 await p.locator('#bodies .eye').nth(1).click();await p.locator('#section-toggle').click();const clipCamera=await host.getAttribute('data-camera-state'),sectionSaved=await save();assert.equal(sectionSaved.preview.dataUrl,saved.preview.dataUrl,'section and visibility do not change saved geometry thumbnail');assert.equal(await host.getAttribute('data-section-active'),'true');assert.equal(await p.locator('#bodies .eye').nth(1).getAttribute('aria-pressed'),'false');sameCamera(await host.getAttribute('data-camera-state'),clipCamera);
 await p.keyboard.press('Escape');
 // A safe metadata failure never prevents reading real CAD data and never fetches an external URL.
 let remoteRequests=0;await p.route('https://example.invalid/**',r=>{remoteRequests++;r.abort();});await pick({...saved,preview:{...saved.preview,dataUrl:'https://example.invalid/preview.png'}});assert.equal(await p.locator('#project-preview-image').isVisible(),false);assert.equal(await p.locator('#project-preview-empty').isVisible(),true);assert.equal(remoteRequests,0);await p.locator('#project-preview-open').click();assert.equal(await p.locator('#body-count').textContent(),'2');
 await pick({...saved,preview:{...saved.preview,dataUrl:'data:image/png;base64,AAAA'}});await p.waitForFunction(()=>!document.getElementById('project-preview-empty').hidden);assert.match(await p.locator('#project-preview-empty').textContent(),/表示できません/);await p.keyboard.press('Escape');
 // Explicit Open replaces data; cancel never does. Filename text cannot become markup.
 const one={...documentData,features:[documentData.features[0]]};await pick({...one,preview:saved.preview},'<img src=x onerror=alert(1)>.json');assert.equal(await p.locator('#project-preview-name img').count(),0);await p.locator('#project-preview-open').click();assert.equal(await p.locator('#body-count').textContent(),'1');
 // Esc during asynchronous file read prevents reopening the preview or changing the design.
 await p.evaluate(()=>{window.originalText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.finishRead=()=>resolve(window.originalText.call(this));});};});await p.locator('#file').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await p.keyboard.press('Escape');await p.evaluate(()=>{window.finishRead();File.prototype.text=window.originalText;});await p.waitForFunction(()=>document.getElementById('file').value==='');assert.equal(await p.locator('#project-load-preview').isVisible(),false);assert.equal(await p.locator('#body-count').textContent(),'1');
 await pick({format:'wrong',features:[]});assert.equal(await p.locator('#project-load-preview').isVisible(),false);assert.equal(await p.locator('#body-count').textContent(),'1');
 // Image capture failure still produces a usable project.
 await p.evaluate(()=>{window.originalToDataURL=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(){throw Error('test failure');};});const fallback=await save();assert.equal(fallback.preview,undefined);assert.equal(fallback.features.length,1);await p.evaluate(()=>HTMLCanvasElement.prototype.toDataURL=window.originalToDataURL);
 // A sketch-only design receives an image too.
 await open({...one,features:[{...defaults,id:'sketch',name:'円スケッチ',kind:'sketch',profile:'circle'}]});const sketch=await save();assert.ok(previewImageSource(sketch.preview));
 assert.deepEqual(errors,[]);console.log('Project preview save/read: PASS',imageStats);
}finally{await browser.close();}
