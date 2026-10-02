import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1200},acceptDownloads:true}),errors=[];page.setDefaultTimeout(120000);
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 await page.goto('http://127.0.0.1:5188');
 const original={format:'forma-cad',version:1,features:[{...defaults,id:'body',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:30}]};
 await page.locator('#file').setInputFiles({name:'rim-test.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});
 await page.locator('#project-preview-open').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-coil-joint').evaluate(e=>e.click());
 await page.evaluate(()=>{for(const [key,value] of Object.entries({wire:1,pitch:4,turns:1,wall:1.8,jointGap:.2,jointSeam:.2,jointSplit:10,closeAngle:-30}))document.getElementById('cad-'+key).value=value;});
 assert.equal(await page.locator('#cad-closeAngle').getAttribute('min'),'-180');assert.equal(await page.locator('#cad-closeAngle').getAttribute('max'),'180');assert.equal(await page.locator('#cad-closeAngle').evaluate(e=>e.checkValidity()),true);assert.equal(await page.locator('#cad-alignStop').isChecked(),true);
 await page.locator('#cad-rimSeat').check();
 assert.equal(await page.locator('#cad-jointSeam').inputValue(),'0');assert.equal(await page.locator('#cad-jointSeam').isDisabled(),true);assert.equal(await page.locator('#cad-alignStop').isChecked(),false);assert.equal(await page.locator('#cad-alignStop').isDisabled(),true);
 await page.locator('#cad-rimSeat').uncheck();assert.equal(await page.locator('#cad-jointSeam').inputValue(),'0.2');assert.equal(await page.locator('#cad-alignStop').isChecked(),true);
 await page.locator('#cad-alignStop').uncheck();await page.locator('#cad-rimSeat').check();await page.locator('#cad-rimSeat').uncheck();assert.equal(await page.locator('#cad-alignStop').isChecked(),false);
 await page.locator('#cad-rimSeat').check();
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='coilJoint'&&document.getElementById('coil-joint-result').textContent.includes('縁の面で止めます'));
 await page.locator('#coil-section-show').click();await page.waitForFunction(()=>document.getElementById('coil-section-panel').dataset.seam==='0');assert.match(await page.locator('#coil-section-svg').textContent(),/合わせ目 0 mm/);await page.locator('#coil-section-close').click();
 await page.locator('#coil-preset-name').fill('面で止める試験');await page.locator('#coil-preset-save').click();assert.match(await page.locator('#coil-preset-status').textContent(),/保存しました/);
 const preset=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-coil-presets-v1')).presets[0]);assert.equal(preset.values.rimSeat,true);assert.equal(preset.values.closeAngle,-30);assert.equal(preset.values.jointSeam,0);
 await page.locator('#coil-preset-apply').click();assert.equal(await page.locator('#cad-closeAngle').inputValue(),'-30');assert.equal(await page.locator('#cad-rimSeat').isChecked(),true);assert.equal(await page.locator('#cad-jointSeam').inputValue(),'0');
 await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);assert.equal(await page.locator('#body-count').textContent(),'2');
 const download=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));const f=data.features.at(-1);
 assert.equal(f.spec.rimSeat,true);assert.equal(f.spec.alignStop,false);assert.equal(f.spec.jointSeam,0);assert.equal(f.spec.closeAngle,-30);assert.equal(f.analysis.motion.seating.status,'clear');
 await page.locator('#file').setInputFiles({name:'rim-saved.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>document.getElementById('file').value==='');
 await page.locator('#features .tree-row').last().locator('button.row-label').click();assert.equal(await page.locator('#cad-rimSeat').isChecked(),true);assert.equal(await page.locator('#cad-jointSeam').inputValue(),'0');assert.equal(await page.locator('#cad-closeAngle').inputValue(),'-30');assert.equal(await page.locator('#cad-alignStop').isDisabled(),true);
 await page.locator('#cad-cancel').click();
 // Old browser presets lack the new flag and keep their original behavior.
 await page.evaluate(()=>{const values={wire:1,pitch:4,turns:1,wall:1.8,jointGap:.2,jointSeam:.2,hand:'右ねじ',autoAdjust:true,alignStop:false,closeAngle:2};localStorage.setItem('forma-cad-coil-presets-v1',JSON.stringify({version:1,presets:[{name:'旧設定',values}]}));});
 await page.locator('#features .tree-row').last().locator('button.row-label').click();await page.locator('#coil-preset-select').selectOption('旧設定');await page.locator('#coil-preset-apply').click();
 assert.equal(await page.locator('#cad-rimSeat').isChecked(),false);assert.equal(await page.locator('#cad-jointSeam').inputValue(),'0.2');assert.equal(await page.locator('#cad-jointSeam').isDisabled(),false);assert.equal(await page.locator('#cad-alignStop').isDisabled(),false);assert.equal(await page.locator('#cad-closeAngle').inputValue(),'2');
 await page.locator('#cad-cancel').click();assert.deepEqual(errors,[]);
 console.log('PASS rim toggle preferences, zero seam section, preset reload/legacy migration, native apply, saved model and edit restoration');
}finally{await browser.close();}
