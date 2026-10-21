import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';

const dir='outputs/mirror-slide-grid/';await fs.mkdir(dir,{recursive:true});
const rect={...defaults,kind:'sketch',id:'rect',name:'枠',profile:'rect',groupId:'g',groupNumber:1,width:12,height:8,x:24,y:8};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept(d.defaultValue()));
 await p.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:5188');
 const host=p.locator('#canvas-host'),canvas=p.locator('#canvas-host canvas'),handle=p.locator('#mirror-axis-handle'),layer=p.locator('#mirror-axis-drag');
 const frame=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 async function screen(point){await frame();const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const v=new THREE.Vector3(...point).project(c);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];}
 async function dragWorld(from,to,{shift=false,axis=false}={}){const a=await screen(from),b=await screen(to),r=await handle.boundingBox(),start=axis?a:[r.x+r.width/2,r.y+r.height/2];if(shift)await p.keyboard.down('Shift');await p.mouse.move(...start);await p.mouse.down();await p.mouse.move(start[0]+b[0]-a[0],start[1]+b[1]-a[1],{steps:8});await p.mouse.up();if(shift)await p.keyboard.up('Shift');await frame();}
 const offset=async()=>Number(await p.locator('#cad-offset').inputValue());
 async function expectSnap(value){assert(Math.abs(await offset()-value)<.001,'expected '+value+' got '+await offset()+' snap '+await layer.getAttribute('data-snapped')); assert.equal(await layer.getAttribute('data-snapped'),'true');assert.match(await handle.textContent(),/グリッド吸着/);assert.match(await handle.textContent(),new RegExp('コピー '+value+' mm'));assert.equal(await handle.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(8, 127, 85)');assert.equal(await p.locator('.mirror-axis-visible').evaluate(e=>getComputedStyle(e).stroke),'rgb(21, 153, 101)');}
 await p.locator('#file').setInputFiles({name:'mirror-snap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[rect]}))});await p.locator('#project-preview-open').click();await p.waitForFunction(()=>!document.getElementById('project-load-preview').open);await p.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await p.locator('#fit').click();await p.locator('#select-sketch-edge').click();await p.mouse.click(...await screen([18,8,0]));await p.locator('#mirror-connected-sketch').click();await p.locator('#mirror-connected-adjust').click();await handle.waitFor();await p.locator('#snap-enabled').check();await p.locator('#snap-step').selectOption('10');await frame();
 assert.match(await p.locator('#cad-offset').locator('..').textContent(),/コピーの移動距離/);assert.notEqual(await layer.getAttribute('data-snapped'),'true');const ordinary=await handle.evaluate(e=>getComputedStyle(e).backgroundColor),view=await host.getAttribute('data-camera-state');
 // Initial copy center is x=12, so the first grid is x=10 (offset=1), not x=-8.
 await dragWorld([12,8,0],[9.98,8,0]);await expectSnap(2);assert(await p.locator('#tools-dialog').evaluate(e=>e.open));await p.screenshot({path:dir+'snapped-green.png'});
 await dragWorld([10,8,0],[7,8,0]);assert(Math.abs(await offset()-5)<.01);assert.equal(await layer.getAttribute('data-snapped'),'false');assert.equal(await handle.evaluate(e=>getComputedStyle(e).backgroundColor),ordinary);await p.screenshot({path:dir+'free-orange.png'});
 await dragWorld([7,8,0],[.02,8,0]);await expectSnap(12);
 await p.locator('#snap-step').selectOption('5');await dragWorld([0,8,0],[-4.98,8,0]);await expectSnap(17);
 await p.locator('#snap-step').selectOption('1');await dragWorld([-5,8,0],[-5.995,8,0]);await expectSnap(18);
 await dragWorld([-6,8,0],[-5.6,8,0],{shift:true});assert(Math.abs(await offset()-17.96)<.01);assert.equal(await layer.getAttribute('data-snapped'),'false');
 await p.locator('#snap-enabled').uncheck();await dragWorld([-5.96,8,0],[-5.8,8,0]);assert.equal(await layer.getAttribute('data-snapped'),'false');assert(Math.abs(await offset()-17.8)<.01);
 // Dragging the actual mirror line snaps that line, independently of the copy.
 await p.locator('#cad-offset').fill('0');await p.locator('#snap-enabled').check();await p.locator('#snap-step').selectOption('10');await frame();await dragWorld([18,20,0],[20.02,20,0],{axis:true});await expectSnap(-4);
 await p.locator('#cad-offset').fill('1.234');await frame();assert.equal(await layer.getAttribute('data-snapped'),'false');assert.equal(await handle.evaluate(e=>getComputedStyle(e).backgroundColor),ordinary);
 // Commit the displayed snapped copy and check the saved world coordinate.
 await p.locator('#cad-offset').fill('0');await dragWorld([12,8,0],[9.98,8,0]);await expectSnap(2);assert.equal(await host.getAttribute('data-camera-state'),view);assert(await handle.locator('strong').isVisible());await handle.click();await p.waitForFunction(()=>!document.getElementById('tools-dialog').open);const event=p.waitForEvent('download');await p.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await event).path(),'utf8'));assert.equal(saved.features.length,2);assert.deepEqual(saved.features[0],rect);assert.equal(saved.features[1].x,10);await p.locator('#undo').click();assert.equal(await host.getAttribute('data-mirror-snapped'),null);assert.deepEqual(errors,[]);
 const proof={copySnapsEveryDisplayedGridStep:true,offGridStartAligned:true,steps1And5And10:true,axisSnapsIndependently:true,greenOnlyWhenSnapped:true,freeShiftAndDisabledRestoreColor:true,manualInputClearsSnap:true,commitMatchesPreview:true,inputMatchesControlDistance:true,iconClickConfirms:true,dragReleaseDoesNotConfirm:true,cameraStable:true,errors};await fs.writeFile(dir+'browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:dir+'failure.png'});throw error;}finally{await browser.close();}
