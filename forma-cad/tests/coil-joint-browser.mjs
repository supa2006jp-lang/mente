import {chromium} from 'playwright';
import {defaults,validateProject} from '../src/geometry.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1200},acceptDownloads:true}),errors=[];page.setDefaultTimeout(600000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));await page.goto('http://127.0.0.1:5188');
 const profile={...defaults,id:'source',name:'変換する円柱',profile:'circle',diameter:60,depth:43},project={format:'forma-cad',version:1,features:[profile]};
 const load=async data=>{await page.locator('#file').setInputFiles({name:'joint.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>Number(document.getElementById('body-count').textContent)>0);};
 const save=async()=>{const event=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(await fs.readFile(await(await event).path(),'utf8'));validateProject(data);return data;};
 const preview=()=>page.waitForFunction(()=>document.querySelector('[data-machining-preview="coilJoint"]')&&document.getElementById('cad-error').textContent.includes('半透明'),{},{timeout:600000});
 const apply=async()=>{await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:600000});};
 await load(project);await page.locator('#direct-coil-joint').evaluate(e=>e.click());assert.equal(await page.locator('#cad-command').inputValue(),'coilJoint');assert.equal(await page.locator('#cad-autoAdjust').isChecked(),true);
 await preview();assert.match(await page.locator('#coil-joint-result').textContent(),/自動調整.*全高/);assert.match(await page.locator('#coil-joint-result').textContent(),/干渉検査は.*実行/);
 await page.locator('#cad-autoAdjust').uncheck();await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('自動調整を有効'));assert.equal(await page.locator('[data-machining-preview=coilJoint]').count(),0);await page.locator('#cad-autoAdjust').check();await preview();
 await page.locator('#cad-jointPose').selectOption('1回転開く');await preview();
 await page.locator('#cad-jointPose').selectOption('分けて並べる');await preview();await fs.mkdir('.sites-runtime',{recursive:true});await page.screenshot({path:'.sites-runtime/coil-joint-preview.png',fullPage:true});
 await apply();assert.equal(await page.locator('#body-count').textContent(),'2');
 // Dense helix selection must return control promptly in face and body modes.
 await page.locator('#fit').click();const rect=await page.locator('canvas').boundingBox(),timings=[];
 const range=async(crossing=false,add=false)=>{const left=rect.x+90,right=rect.x+rect.width-90,top=rect.y+150,bottom=rect.y+rect.height-170;if(add)await page.keyboard.down('Control');await page.mouse.move(crossing?right:left,crossing?rect.y+rect.height/2-110:top);await page.mouse.down();await page.mouse.move(crossing?(left+right)/2-180:right,crossing?rect.y+rect.height/2+160:bottom,{steps:4});assert.equal(await page.locator('#selection-box').isVisible(),true);const start=performance.now();await page.mouse.up();timings.push(performance.now()-start);if(add)await page.keyboard.up('Control');};
 await range();const faces=Number(await page.locator('#canvas-host').getAttribute('data-selected-face-count'));assert.ok(faces>10);await range(false,true);assert.equal(Number(await page.locator('#canvas-host').getAttribute('data-selected-face-count')),faces,'Control range must not duplicate faces');await range(true);
 await page.locator('#selection-mode').selectOption('body');await range();assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-body-count'),'2');await range(true);assert.ok(Number(await page.locator('#canvas-host').getAttribute('data-selected-body-count'))>0);await page.keyboard.press('Escape');
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.wheel(0,-100);await page.locator('[data-view=top]').click();assert.ok(timings.every(t=>t<3000),JSON.stringify(timings));console.log('Dense helix selection ms',timings.map(t=>Math.round(t)),'faces',faces);await page.locator('#selection-mode').selectOption('auto');
 const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.spec.type,'coilJoint');assert.equal(joint.spec.jointPose,'分けて並べる');assert.deepEqual(joint.outputs.map(o=>o.id),['source',joint.id+'-lid']);assert.equal(joint.analysis.motion.status,'clear');
 // Saved parameters and stable output IDs survive editing and undo.
 await load(saved);await page.locator('#features .tree-row').last().locator('button.row-label').click();assert.equal(await page.locator('#cad-apply').textContent(),'変更を適用');assert.equal(await page.locator('#cad-jointPose').inputValue(),'分けて並べる');assert.equal(await page.locator('#cad-wire').inputValue(),'1');assert.equal(await page.locator('#cad-autoAdjust').isChecked(),true);
 await page.locator('#cad-jointPose').selectOption('閉じた状態');await preview();await apply();const changed=await save();await fs.writeFile('.sites-runtime/coil-selection.json',JSON.stringify(changed));assert.equal(changed.features.at(-1).id,joint.id);assert.equal(changed.features.at(-1).spec.jointPose,'閉じた状態');assert.deepEqual(changed.features.at(-1).outputs.map(o=>o.id),joint.outputs.map(o=>o.id));
 // Flip only the lid, preserving the closed assembly body's position.
 await page.locator('#features .tree-row').last().locator('button.row-label').click();assert.equal(await page.locator('#cad-flipLidToGrid').isChecked(),false);await page.locator('#cad-flipLidToGrid').check();await preview();await apply();const flipped=await save();assert.equal(flipped.features.at(-1).spec.flipLidToGrid,true);assert.deepEqual(flipped.features.at(-1).outputs[0].vertices,changed.features.at(-1).outputs[0].vertices);const lid=flipped.features.at(-1).outputs[1];assert.ok(Math.abs(Math.min(...lid.vertices.filter((_,i)=>i%3===2)))<1e-5);await fs.writeFile('.sites-runtime/coil-flipped.json',JSON.stringify(flipped));
 await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.flipLidToGrid,false);
 await load(flipped);await page.locator('#features .tree-row').last().locator('button.row-label').click();assert.equal(await page.locator('#cad-flipLidToGrid').isChecked(),true);await page.locator('#tools-dialog').evaluate(e=>e.close());
 const stlEvent=page.waitForEvent('download');await page.locator('#export').click();const stl=await fs.readFile(await(await stlEvent).path());assert.equal(stl.length,84+stl.readUInt32LE(80)*50);assert.ok(stl.readUInt32LE(80)>0);assert.deepEqual(errors,[]);
 console.log('PASS command discovery, paired preview, actual adjustment report, open/print poses, 1 cylinder -> 2 bodies, save/load, parameter edit/replay, stable IDs, undo and STL export, dense helix range responsiveness, lid-only grid option and saved state');
}finally{await browser.close();}
