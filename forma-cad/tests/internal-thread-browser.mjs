import {chromium} from 'playwright';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5188');
 const features=[{...defaults,id:'b',name:'plate',width:60,height:40,depth:10,x:12,y:7},{...defaults,id:'h',name:'hole',profile:'circle',diameter:16,x:12,y:7,z:10,depth:-10,operation:'cut',target:'b',hole:true}];
 await page.locator('#file').setInputFiles({name:'hole.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.locator('[data-view=iso]').click();await page.locator('#fit').click();await page.waitForTimeout(300);
 const r=await page.locator('canvas').boundingBox(),aspect=r.width/r.height,size=Math.hypot(60,40,10);
 const camera=new THREE.OrthographicCamera(-100*aspect,100*aspect,100,-100,.1,100000);
 const center=new THREE.Vector3(12,7,5);camera.up.set(0,0,1);camera.position.copy(center).addScaledVector(new THREE.Vector3(1,-1.3,1).normalize(),Math.max(size*2,180));
 camera.zoom=200/(size*1.25/Math.min(aspect,1));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const screen=new THREE.Vector3(12,15,7).project(camera);
 await page.mouse.click(r.x+(screen.x+1)*r.width/2,r.y+(1-screen.y)*r.height/2);
 assert.equal(await page.locator('#measurement-title').textContent(),'選択した穴の内壁');
 await page.screenshot({path:'.sites-runtime/internal-wall-selected.png'});
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('thread');
 assert.match(await page.locator('#thread-face').textContent(),/穴の内壁/);
 await page.locator('#thread-designation').selectOption('2');await page.screenshot({path:'.sites-runtime/thread-dialog.png'});
 await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:95000});
 assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const download=page.waitForEvent('download');await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),op=saved.features.at(-1);
 assert.equal(op.spec.type,'thread');assert.equal(op.outputs[0].id,'b');assert.ok(op.spec.surfacePoint[1]>14);
 assert.equal(await page.locator('#body-count').textContent(),'1');assert.deepEqual(errors,[]);
 await page.screenshot({path:'.sites-runtime/internal-thread-result.png'});
 for(let dx=-60;dx<=60;dx+=20)for(let dy=-60;dy<=60;dy+=20){
  await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy);
  await page.waitForTimeout(25);
  assert.ok(await page.locator('.center-marker:visible').count()<=1,'Overlapping reference icons must not accumulate');
 }
 console.log('PASS no marker clusters around threaded hole');
 console.log('PASS click inner wall, select thread, create and save internal thread');
}finally{await browser.close();}
