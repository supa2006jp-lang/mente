import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';
import * as THREE from 'three';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept('hole-grid-snap-test'));
 await page.goto('http://127.0.0.1:5188');

 // The top face is offset from the world XY plane and from the model origin.
 const box={...defaults,id:'box',name:'box',width:80,height:60,depth:20,x:13,y:7,z:5};
 await page.locator('#file').setInputFiles({name:'offset-box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[box]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=iso]').click();
 await page.locator('#fit').click();
 await page.locator('#snap-step').selectOption('10');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
 const canvas=await page.locator('canvas').boundingBox();
 const state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const camera=new THREE.OrthographicCamera(-100*canvas.width/canvas.height,100*canvas.width/canvas.height,100,-100,.1,100000);
 camera.position.fromArray(state,0);camera.quaternion.fromArray(state,3);camera.zoom=state[7];
 camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const screen=(x,y,z=25)=>{const p=new THREE.Vector3(x,y,z).project(camera);return [canvas.x+(p.x+1)*canvas.width/2,canvas.y+(1-p.y)*canvas.height/2];};
 const faceIntersection=screen(20,10),worldIntersection=screen(20,10,0);
 assert.ok(Math.hypot(faceIntersection[0]-worldIntersection[0],faceIntersection[1]-worldIntersection[1])>10,'Oblique view must separate the world and face grids');
 const host=page.locator('#canvas-host');
 const position=async()=>{
  const values=(await page.locator('#hole-position').textContent()).match(/-?\d+(?:\.\d+)?/g);
  return values?.map(Number);
 };

 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='false');
 assert.equal(await host.getAttribute('data-sketch-grid-visible'),'false','No face was selected before starting the hole command');
 await page.locator('#cut-tool').click();
 assert.equal(await page.locator('#hole-panel').isVisible(),true);

 // Hover close to the visible 10 mm intersection on the offset face.
 await page.mouse.move(...screen(20.2,10.2));
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.snapKind==='grid');
 assert.equal(await host.getAttribute('data-sketch-grid-visible'),'true','Hole placement should display the top-face grid before a click');
 assert.equal(await host.getAttribute('data-sketch-grid-offset'),'25');
 assert.equal(await page.locator('#snap-icon').isVisible(),true,'The snapped intersection should have a live marker');
 const icon=await page.locator('#snap-icon').boundingBox();
 assert.ok(Math.hypot(icon.x+icon.width/2-faceIntersection[0],icon.y+icon.height/2-faceIntersection[1])<5,'Snap marker must align with the displayed face-grid intersection');
 assert.equal(await page.locator('#snap-readout').isVisible(),true,'The snapped center should have a live readout');
 assert.match(await page.locator('#snap-readout').textContent(),/交点/);
 await page.mouse.click(...screen(20.2,10.2));
 assert.deepEqual(await position(),[20,10,25]);

 // The same pointer location must remain free when snapping is disabled.
 await page.locator('#snap-enabled').uncheck();
 await page.mouse.move(...screen(23,13));
 await page.mouse.move(...screen(20.2,10.2));
 await page.mouse.click(...screen(20.2,10.2));
 assert.equal(await host.getAttribute('data-snap-kind'),'free');
 const free=await position();
 assert.ok(Math.abs(free[0]-20.2)<.03&&Math.abs(free[1]-10.2)<.03&&free[2]===25,`Snap-off center: ${free}`);

 await page.locator('#snap-enabled').check();
 await page.mouse.move(...screen(23,13));
 await page.mouse.move(...screen(20.2,10.2));
 await page.mouse.click(...screen(20.2,10.2));
 assert.deepEqual(await position(),[20,10,25]);
 await page.locator('#hole-diameter').fill('4');
 await page.locator('#hole-depth').fill('5');
 await page.locator('#hole-apply').click();
 assert.equal(await page.locator('#hole-panel').isVisible(),false,await page.locator('#hole-error').textContent());
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const data=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
 const hole=data.features.at(-1);
 assert.equal(hole.hole,true);
 assert.deepEqual([hole.x,hole.y,hole.z],[20,10,25]);
 assert.deepEqual(errors,[]);
 console.log('PASS hole hover grid/readout, offset-face intersection snap, snap toggle and saved center');
}finally{await browser.close();}

