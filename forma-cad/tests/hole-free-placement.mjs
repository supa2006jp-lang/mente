import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);page.on('dialog',d=>{console.log('dialog',d.message());d.accept('hole-free-placement-test');});
 await page.goto('http://127.0.0.1:5188');
 const features=[{...defaults,id:'box',name:'box',width:50,height:50,depth:20},...[[[-15,7],[-1,7]],[[-8,1],[-8,15]]].map((points,i)=>({...defaults,id:'line'+i,name:'line'+i,kind:'sketch',profile:'polyline',points,closed:false,z:20}))];
 await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const r=await page.locator('canvas').boundingBox(),scale=r.height/(Math.hypot(50,50,20)*1.25/Math.min(r.width/r.height,1));
 const p=(x,y)=>[r.x+r.width/2+x*scale,r.y+r.height/2-y*scale];
 await page.locator('#cut-tool').click();
 async function point(x,y,kind){await page.mouse.click(...p(x,y));assert.equal(await page.locator('#canvas-host').getAttribute('data-snap-kind'),kind);return (await page.locator('#hole-position').textContent()).match(/-?\d+(?:\.\d+)?/g).map(Number);}
 let v=await point(7,13,'free');assert.ok(Math.abs(v[0]-7)<.02&&Math.abs(v[1]-13)<.02);
 v=await point(10+.2,10+.2,'grid');assert.deepEqual(v,[10,10,20]);
 v=await point(-8+.2,7+.2,'intersection');assert.deepEqual(v,[-8,7,20]);
 await page.locator('#snap-enabled').uncheck();v=await point(10+.2,10+.2,'free');assert.ok(Math.abs(v[0]-10.2)<.02);
 await point(7,13,'free');await page.locator('#hole-diameter').fill('2');await page.locator('#hole-depth').fill('5');await page.locator('#hole-apply').click();
 const download=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),hole=data.features.at(-1);
 assert.equal(hole.hole,true);assert.ok(Math.abs(hole.x-7)<.02&&Math.abs(hole.y-13)<.02);assert.deepEqual(errors,[]);
 console.log('PASS free hole placement, nearby grid/intersection snap, snap toggle and saved hole center');
}finally{await browser.close();}
