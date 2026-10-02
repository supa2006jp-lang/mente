import {chromium} from 'playwright';
import {defaults,validateProject} from '../src/geometry.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1200},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');

 const source={...defaults,id:'source',name:'収納する対象',width:30,height:20,depth:20};
 const project={format:'forma-cad',version:1,features:[source]};
 const save=async()=>{
  const download=page.waitForEvent('download');
  await page.locator('#save').click();
  const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
  validateProject(data);
  return data;
 };
 const preview=()=>page.waitForFunction(()=>document.querySelector('[data-machining-preview="enclose"]')&&document.getElementById('cad-error').textContent.includes('半透明'),{},{timeout:120000});
 const edit=()=>page.locator('#features .tree-row').last().locator('button.row-label').click();
 const apply=async()=>{
  await page.locator('#cad-apply').click();
  await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:120000});
 };

 await page.locator('#file').setInputFiles({name:'source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-enclose').evaluate(element=>element.click());
 await page.locator('#cad-boxMode').check();
 assert.equal(await page.locator('#enclose-chest-option').isVisible(),true);
 await page.locator('#cad-chestStyle').check();
 assert.equal(await page.locator('#cad-enclosureSplit').inputValue(),'XY','chest style selects a split plane');
 assert.equal(await page.locator('#cad-hinge').isChecked(),true,'chest style enables the hinge');
 assert.equal(await page.locator('#cad-snapLatch').isChecked(),true,'chest style enables the latch');
 assert.equal(await page.locator('#cad-splitOffset').inputValue(),'10','chest style centers the split on the source');
 await preview();
 await fs.mkdir('.sites-runtime',{recursive:true});
 await page.screenshot({path:'.sites-runtime/chest-preview.png',fullPage:true});
 await apply();
 assert.equal(await page.locator('#body-count').textContent(),'3','source, chest body and lid are present');
 assert.equal(await page.locator('#export-enclosure').isVisible(),true);

 const chest=await save(),chestFeature=chest.features.at(-1);
 assert.equal(chestFeature.spec.chestStyle,true);
 assert.equal(chestFeature.spec.boxMode,true);
 assert.equal(chestFeature.spec.enclosureSplit,'XY');
 assert.equal(chestFeature.spec.hinge,true);
 assert.equal(chestFeature.spec.snapLatch,true);
 assert.equal(chestFeature.outputs.length,2);

 await page.locator('#file').setInputFiles({name:'chest.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(chest))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='3');
 await edit();
 assert.equal(await page.locator('#cad-chestStyle').isChecked(),true,'saved style is restored for editing');
 await page.locator('#cad-chestStyle').uncheck();
 await preview();
 await apply();
 const ordinary=await save(),ordinaryFeature=ordinary.features.at(-1);
 assert.equal(ordinaryFeature.spec.chestStyle,false);
 assert.notEqual(ordinaryFeature.outputs[1].brep,chestFeature.outputs[1].brep,'style change regenerates the lid');
 await page.locator('#undo').click();
 const restored=await save();
 assert.equal(restored.features.at(-1).spec.chestStyle,true,'undo restores chest style');
 assert.equal(restored.features.at(-1).outputs[1].brep,chestFeature.outputs[1].brep,'undo restores chest geometry');

 const exported=page.waitForEvent('download');
 await page.locator('#export-enclosure').click();
 const stl=await fs.readFile(await(await exported).path());
 const triangles=stl.readUInt32LE(80);
 assert.equal(stl.length,84+triangles*50,'binary STL has the expected length');
 assert.equal(triangles,chestFeature.outputs.reduce((sum,part)=>sum+part.triangles.length/3,0),'print STL contains only the chest body and lid');
 let lowest=Infinity;
 for(let triangle=0;triangle<triangles;triangle++)for(let corner=0;corner<3;corner++)lowest=Math.min(lowest,stl.readFloatLE(84+triangle*50+12+corner*12+8));
 assert.ok(Math.abs(lowest)<1e-4,'the print pose rests on the build plate');
 assert.deepEqual(errors,[]);
 console.log('PASS chest preview, automatic split/hinge/latch, save/load, style edit, undo and print STL');
}finally{await browser.close();}
