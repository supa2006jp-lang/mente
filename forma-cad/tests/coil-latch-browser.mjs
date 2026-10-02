import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';

// Pass a native-verified saved model to test restoration without rebuilding
// another joint. With no argument, this test also exercises native UI apply.
const fixturePath=process.argv[2],legacyFixturePath=process.argv[3],weakFixturePath=process.argv[4],browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1200},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 await page.goto('http://127.0.0.1:5188');
 const original={format:'forma-cad',version:1,features:[{...defaults,id:'body',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:30}]};
 async function load(data,name){
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(()=>document.getElementById('file').value==='');
 }
 async function save(){
  const downloaded=page.waitForEvent('download');await page.locator('#save').click();
  return JSON.parse(await fs.readFile(await(await downloaded).path(),'utf8'));
 }
 const openFold=selector=>page.locator(selector).evaluate(e=>{for(let d=e.closest('details');d;d=d.parentElement.closest('details'))d.open=true;});
 const state=()=>page.evaluate(()=>Object.fromEntries(['jointLatch','latchFirm','rimSeat','closeAngle','jointSeam','alignStop','latchGap','latchEngagement'].map(key=>{const input=document.getElementById('cad-'+key);return [key,{value:input.type==='checkbox'?input.checked:Number(input.value),disabled:input.disabled}];})));
 function forced(s){
  assert.deepEqual([s.jointLatch.value,s.rimSeat.value,s.rimSeat.disabled,s.closeAngle.disabled,s.jointSeam.value,s.jointSeam.disabled,s.alignStop.value,s.alignStop.disabled],[true,true,true,false,0,true,false,true]);
  assert.equal(s.latchGap.disabled,false);assert.equal(s.latchEngagement.disabled,false);assert.equal(s.latchFirm.disabled,false);
 }
 await load(original,'coil-latch-original.forma.json');
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-coil-joint').evaluate(e=>e.click());
 // New joints offer the ridge trial first. The existing claw tests below
 // explicitly switch back and verify saved settings still restore.
 let s=await state();assert.equal(await page.locator('#cad-latchStyle').inputValue(),'ridge');assert.equal(s.latchFirm.disabled,true);assert.equal(await page.locator('#cad-latchFirm').isHidden(),true);assert.match(await page.locator('#cad-latchEngagement').locator('xpath=..').textContent(),/山の高さ/);assert.equal(Number(await page.locator('#cad-latchEngagement').inputValue()),1.6);assert.equal(Number(await page.locator('#cad-wall').inputValue()),4.2);assert.equal(Number(await page.locator('#cad-bodyBoreWall').inputValue()),1.5);
 await page.locator('#cad-latchEngagement').fill('1.45');await page.locator('#cad-latchStyle').selectOption('claw');assert.equal(Number(await page.locator('#cad-latchEngagement').inputValue()),1.1);await page.locator('#cad-latchEngagement').fill('1');await page.locator('#cad-latchStyle').selectOption('ridge');assert.equal(Number(await page.locator('#cad-latchEngagement').inputValue()),1.45);await page.locator('#cad-latchStyle').selectOption('claw');assert.equal(Number(await page.locator('#cad-latchEngagement').inputValue()),1);await page.locator('#cad-latchStyle').selectOption('ridge');await page.locator('#cad-latchEngagement').fill('1.6');
 assert.equal(await page.locator('#coil-ridge-strength-apply').count(),0);assert.equal(Number(await page.locator('#cad-wall').inputValue()),4.2);assert.equal(Number(await page.locator('#cad-pitch').inputValue()),4.1);assert.equal(Number(await page.locator('#cad-bodyBoreWall').inputValue()),1.5);
 await openFold('#coil-preset-name');await page.locator('#coil-preset-name').fill('山と溝');await page.locator('#coil-preset-save').click();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-coil-presets-v1')).presets[0])).values.latchStyle,'ridge');
 await page.locator('#cad-latchStyle').selectOption('claw');assert.equal(await page.locator('#cad-latchFirm').isHidden(),false);
 await page.locator('#coil-preset-apply').click();assert.equal(await page.locator('#cad-latchStyle').inputValue(),'ridge');assert.equal(await page.locator('#cad-latchFirm').isHidden(),true);
 await page.locator('#coil-preset-delete').click();await page.locator('#coil-preset-fold').evaluate(e=>e.open=false);await page.locator('#cad-latchStyle').selectOption('claw');s=await state();forced(s);assert.equal(s.latchFirm.value,true);
 assert.equal(await page.locator('#coil-settings-help').getAttribute('open'),null);assert.equal(await page.locator('#coil-preset-fold').getAttribute('open'),null);assert.equal(await page.locator('#coil-calculation-details').getAttribute('open'),null);assert.equal(await page.locator('.coil-settings-group').count(),6);assert.equal(await page.locator('#coil-settings-help .coil-joint-note').count(),6);assert.ok((await page.locator('#cad-help').textContent()).length<60);
 const newFormDefaults=await page.evaluate(()=>Object.fromEntries(['wire','pitch','turns','wall','bodyBoreWall','jointGap','jointSeam','latchGap','latchEngagement','closeAngle','jointSplit'].map(key=>[key,Number(document.getElementById('cad-'+key).value)])));
 assert.deepEqual(newFormDefaults,{wire:2,pitch:4.1,turns:2,wall:4.2,bodyBoreWall:1.5,jointGap:.4,jointSeam:0,latchGap:.15,latchEngagement:1.1,closeAngle:0,jointSplit:0});
 assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),2);assert.equal(await page.locator('#cad-latchExtraFirm').isChecked(),true);await page.locator('#cad-hand').selectOption('左ねじ');await page.locator('#cad-hand').dispatchEvent('input');assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),-2);await page.locator('#cad-hand').selectOption('右ねじ');await page.locator('#cad-hand').dispatchEvent('input');assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),2);
 assert.equal(await page.locator('#cad-autoFillet').isChecked(),false);assert.equal(await page.locator('#cad-filletCapRadius').isDisabled(),true);assert.equal(await page.locator('#cad-filletCapRadius').inputValue(),'2');
 assert.equal(await page.locator('#cad-autoAdjust').isChecked(),true);assert.equal(await page.locator('#cad-jointPose').inputValue(),'分けて並べる');assert.equal(await page.locator('#cad-hand').inputValue(),'右ねじ');
 // Set up explicit legacy choices before checking backup/restoration behavior.
 await page.locator('#cad-jointLatch').uncheck();await page.locator('#cad-rimSeat').uncheck();s=await state();assert.equal(s.latchGap.disabled,true);assert.equal(s.latchEngagement.disabled,true);assert.equal(s.latchFirm.disabled,true);
 await page.locator('#cad-closeAngle').fill('-10');await page.locator('#cad-jointSeam').fill('.2');await page.locator('#cad-alignStop').check();
 await page.locator('#cad-jointLatch').check();forced(await state());
 await page.locator('#cad-jointLatch').uncheck();s=await state();
 assert.deepEqual([s.rimSeat.value,s.rimSeat.disabled,s.closeAngle.value,s.closeAngle.disabled,s.jointSeam.value,s.alignStop.value,s.alignStop.disabled],[false,false,-10,false,.2,true,false]);
 // A rim setting active before the latch must retain its own saved preferences.
 await page.locator('#cad-alignStop').uncheck();await page.locator('#cad-rimSeat').check();
 await page.locator('#cad-jointLatch').check();await page.locator('#cad-jointLatch').uncheck();
 s=await state();assert.equal(s.rimSeat.value,true);assert.equal(s.closeAngle.value,-10);
 await page.locator('#cad-rimSeat').uncheck();s=await state();assert.equal(s.jointSeam.value,.2);assert.equal(s.alignStop.value,false);
 // The upgrade action enables the latch and sets both its stiffness and fit.
 await openFold('#coil-stronger-latch');await page.locator('#coil-stronger-latch').click();forced(await state());s=await state();assert.equal(s.latchFirm.value,true);assert.equal(s.latchGap.value,.2);assert.equal(s.latchEngagement.value,.9);
 await page.locator('#cad-jointLatch').uncheck();s=await state();assert.equal(s.latchFirm.disabled,true);assert.equal(s.latchFirm.value,true);
 await page.locator('#cad-jointLatch').check();await page.locator('#cad-latchFirm').uncheck();assert.equal((await state()).latchFirm.value,false);
 await openFold('#coil-stronger-latch');await page.locator('#coil-stronger-latch').click();assert.equal((await state()).latchFirm.value,true);
 await page.locator('#cad-latchGap').fill('.4');await page.locator('#cad-latchEngagement').fill('1');
 await page.locator('#cad-autoFillet').check();assert.equal(await page.locator('#cad-filletCapRadius').isDisabled(),false);await page.locator('#cad-filletCapRadius').fill('0.8');await page.locator('#cad-filletLidTop').uncheck();
 await openFold('#coil-preset-name');await page.locator('#coil-preset-name').fill('爪の保持設定');await page.locator('#coil-preset-save').click();
 assert.match(await page.locator('#coil-preset-status').textContent(),/保存しました/);
 const preset=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-coil-presets-v1')).presets[0]);
 assert.equal(preset.values.closeAngleZero,2);assert.equal(preset.values.latchExtraFirm,false);assert.equal(preset.values.filletBodyBottom,true);assert.equal(preset.values.filletLidTop,false);assert.equal(preset.values.filletVertical,true);assert.equal(preset.values.autoFillet,true);assert.equal(preset.values.filletRadius,.8);assert.equal(preset.values.filletVerticalRadius,2);assert.equal(preset.values.filletCapRadius,.8);assert.equal(preset.values.jointLatch,true);assert.equal(preset.values.latchStyle,'claw');assert.equal(preset.values.latchFirm,true);assert.equal(preset.values.latchGap,.4);assert.equal(preset.values.latchEngagement,1);assert.equal(preset.values.rimSeat,true);assert.equal(preset.values.closeAngle,-10);assert.equal(preset.values.alignStop,false);
 await page.locator('#cad-autoFillet').uncheck();await page.locator('#cad-latchFirm').uncheck();await page.locator('#cad-jointLatch').uncheck();await page.locator('#coil-preset-apply').click();assert.equal(await page.locator('#cad-autoFillet').isChecked(),true);assert.equal(await page.locator('#cad-filletCapRadius').inputValue(),'0.8');assert.equal(await page.locator('#cad-filletCapRadius').isDisabled(),false);
 assert.equal(await page.locator('#cad-filletLidTop').isChecked(),false);forced(await state());assert.equal((await state()).latchFirm.value,true);assert.equal((await state()).latchGap.value,.4);assert.equal((await state()).latchEngagement.value,1);
 await page.locator('#cad-cancel').click();
 // Existing version-1 presets must remain callable while a latch is active.
 await page.evaluate(()=>{const values={wire:1,pitch:4,turns:1,wall:1.8,jointGap:.2,jointSeam:.2,hand:'右ねじ',autoAdjust:true,alignStop:true,closeAngle:-10};localStorage.setItem('forma-cad-coil-presets-v1',JSON.stringify({version:1,presets:[{name:'旧設定',values}]}));});
 await page.locator('#direct-coil-joint').evaluate(e=>e.click());await page.locator('#cad-jointLatch').check();
 await openFold('#coil-preset-select');await page.locator('#coil-preset-select').selectOption('旧設定');await page.locator('#coil-preset-apply').click();s=await state();assert.equal(await page.locator('#cad-latchStyle').inputValue(),'claw');assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),0);assert.equal(await page.locator('#cad-autoFillet').isChecked(),false);assert.equal(await page.locator('#cad-filletCapRadius').isDisabled(),true);assert.equal(await page.locator('#cad-filletCapRadius').inputValue(),'2');
 for(const key of ['filletBodyBottom','filletLidTop','filletVertical']){assert.equal(await page.locator('#cad-'+key).isChecked(),true);assert.equal(await page.locator('#cad-'+key).isDisabled(),true);}
 assert.deepEqual([s.jointLatch.value,s.rimSeat.value,s.closeAngle.value,s.jointSeam.value,s.alignStop.value,s.alignStop.disabled,s.latchGap.value,s.latchGap.disabled,s.latchEngagement.value],[false,false,-10,.2,true,false,.3,true,.8]);assert.equal(s.latchFirm.value,false);assert.equal(s.latchFirm.disabled,true);
 await page.locator('#cad-jointLatch').check();await page.locator('#cad-jointLatch').uncheck();s=await state();assert.equal(s.closeAngle.value,-10);assert.equal(s.alignStop.value,true);assert.equal(s.jointSeam.value,.2);
 let data;
 if(fixturePath){
  await page.locator('#cad-cancel').click();data=JSON.parse(await fs.readFile(fixturePath,'utf8'));
 }else{
  await page.locator('#cad-jointLatch').check();await page.locator('#cad-closeAngle').fill('0');
  await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:600000});
  assert.equal(await page.locator('#body-count').textContent(),'2');data=await save();
 }
 let feature=data.features.find(f=>f.spec?.type==='coilJoint'&&f.spec.jointLatch===true);const expectedFirm=feature?.spec.latchFirm===true;
 assert.ok(feature,'verified model contains a coil latch');assert.equal(feature.spec.rimSeat,true);assert.equal(feature.spec.closeAngle,0);assert.equal(feature.spec.alignStop,false);assert.equal(feature.spec.jointSeam,0);
 assert.equal(feature.spec.latchVersion,'internal-v1');assert.equal(feature.analysis.latchVersion,'internal-v1');assert.equal(feature.analysis.jointLatch,true);assert.equal(feature.analysis.latchFirm===true,feature.spec.latchFirm===true);assert.equal(feature.analysis.motion.status,'clear');assert.ok(feature.analysis.motion.latch);assert.equal(feature.outputs.length,2);
 // Loading, editing, saving, then loading again must retain the exact latch fit.
 await load(data,'coil-latch-saved.forma.json');
 const edit=async()=>{const index=data.features.findIndex(f=>f.id===feature.id);await page.getByText(`${index+1}. ${feature.name}`,{exact:true}).click();};
 await edit();assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),feature.spec.closeAngleZero??0);assert.equal(await page.locator('#cad-autoFillet').isChecked(),feature.spec.autoFillet===true);assert.equal(Number(await page.locator('#cad-filletCapRadius').inputValue()),feature.spec.filletCapRadius??(feature.spec.autoFillet?(feature.spec.filletRadius??2):((feature.spec.filletRadius??.5)===.5?2:feature.spec.filletRadius)));assert.equal(await page.locator('#cad-filletCapRadius').isDisabled(),feature.spec.autoFillet!==true);assert.doesNotMatch(await page.locator('#cad-help').textContent(),/旧型の外側/);forced(await state());s=await state();assert.equal(s.latchFirm.value,expectedFirm);assert.equal(s.latchGap.value,feature.spec.latchGap??.3);assert.equal(s.latchEngagement.value,feature.spec.latchEngagement??.8);
 assert.equal(await page.locator('#cad-closeAngle').isDisabled(),false);assert.equal(await page.locator('#cad-closeAngle').getAttribute('min'),'-10');assert.equal(await page.locator('#cad-closeAngle').getAttribute('max'),'10');assert.equal(await page.locator('#cad-latchExtraFirm').isChecked(),feature.spec.latchExtraFirm===true);
 await page.locator('#coil-correct-two-degrees').click();assert.equal(Number(await page.locator('#cad-closeAngle').inputValue()),2);await page.locator('#cad-hand').selectOption('左ねじ');await page.locator('#coil-correct-two-degrees').click();assert.equal(Number(await page.locator('#cad-closeAngle').inputValue()),0);await page.locator('#cad-hand').selectOption('右ねじ');await page.locator('#coil-correct-two-degrees').click();await page.locator('#coil-extra-stronger-latch').click();assert.equal(await page.locator('#cad-latchExtraFirm').isChecked(),true);assert.equal(await page.locator('#cad-latchFirm').isChecked(),true);assert.equal(Number(await page.locator('#cad-latchGap').inputValue()),.15);assert.equal(Number(await page.locator('#cad-latchEngagement').inputValue()),1.1);assert.equal(Number(await page.locator('#cad-wall').inputValue()),3.3);assert.equal(Number(await page.locator('#cad-closeAngle').inputValue()),2);
 await openFold('#coil-preset-name');await page.locator('#coil-preset-name').fill('角度と追加強化');await page.locator('#coil-preset-save').click();const strengthened=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-cad-coil-presets-v1')).presets.find(p=>p.name==='角度と追加強化'));assert.equal(strengthened.values.closeAngleZero,0);assert.equal(strengthened.values.closeAngle,2);assert.equal(strengthened.values.latchExtraFirm,true);await page.locator('#cad-closeAngle').fill('0');await page.locator('#cad-latchExtraFirm').uncheck();await page.locator('#coil-preset-apply').click();assert.equal(Number(await page.locator('#cad-closeAngle').inputValue()),2);assert.equal(await page.locator('#cad-latchExtraFirm').isChecked(),true);
 await page.locator('#cad-jointPose').selectOption('開閉スライダー');await page.locator('#cad-jointPose').dispatchEvent('input');
 const releaseText=await page.locator('#coil-opening-controls p:last-child').textContent();assert.match(releaseText,/開く方向に回して固定部が外れた後/);assert.match(releaseText,/たわみは表示しません/);assert.doesNotMatch(releaseText,/指掛かり|指で|外へ引/);
 await page.locator('#cad-cancel').click();data=await save();
 feature=data.features.find(f=>f.id===feature.id);assert.equal(feature.spec.jointLatch,true);assert.equal(feature.spec.latchFirm===true,expectedFirm);assert.equal(feature.analysis.latchFirm===true,expectedFirm);assert.ok(data.preview?.dataUrl?.startsWith('data:image/'));
 await load(data,'coil-latch-roundtrip.forma.json');await edit();assert.equal(await page.locator('#cad-autoFillet').isChecked(),feature.spec.autoFillet===true);assert.equal(Number(await page.locator('#cad-filletCapRadius').inputValue()),feature.spec.filletCapRadius??(feature.spec.autoFillet?(feature.spec.filletRadius??2):((feature.spec.filletRadius??.5)===.5?2:feature.spec.filletRadius)));assert.equal(await page.locator('#cad-filletCapRadius').isDisabled(),feature.spec.autoFillet!==true);assert.doesNotMatch(await page.locator('#cad-help').textContent(),/旧型の外側/);forced(await state());s=await state();assert.equal(s.latchFirm.value,expectedFirm);assert.equal(s.latchGap.value,feature.spec.latchGap??.3);assert.equal(s.latchEngagement.value,feature.spec.latchEngagement??.8);
 await page.locator('#cad-cancel').click();
 if(legacyFixturePath){
  // A stored external-claw model must remain unchanged until explicit apply.
  const legacy=JSON.parse(await fs.readFile(legacyFixturePath,'utf8')),index=legacy.features.findIndex(f=>f.spec?.type==='coilJoint'&&f.spec.jointLatch===true),old=legacy.features[index];
  assert.ok(old,'legacy fixture contains an external claw');assert.notEqual(old.analysis?.latchVersion,'internal-v1');
  await load(legacy,'coil-latch-legacy-external.forma.json');
  await page.getByText(`${index+1}. ${old.name}`,{exact:true}).click();
  const migrationText=await page.locator('#cad-help').textContent();assert.match(migrationText,/旧型の外側の爪/);assert.match(migrationText,/変更を適用/);assert.match(migrationText,/内部の爪に作り直/);assert.match(migrationText,/本体と蓋の両方を再印刷/);
  forced(await state());await page.locator('#cad-cancel').click();
  const unchanged=(await save()).features.find(f=>f.id===old.id);
  assert.deepEqual(unchanged.spec,old.spec,'cancel must not stamp a new geometry version');
  assert.deepEqual(unchanged.outputs,old.outputs,'cancel must keep all external-claw mesh and BREP data');
  assert.deepEqual(unchanged.analysis,old.analysis,'cancel must retain legacy geometry analysis');
 }
 if(weakFixturePath){
  // Previewing the upgrade and canceling must not silently strengthen an old
  // stored joint. Its saved meshes and requested dimensions remain unchanged.
  const weak=JSON.parse(await fs.readFile(weakFixturePath,'utf8')),index=weak.features.findIndex(f=>f.spec?.type==='coilJoint'&&f.spec.jointLatch===true),old=weak.features[index];
  assert.ok(old,'weak fixture contains an internal claw');assert.equal(old.analysis?.latchVersion,'internal-v1');assert.equal(old.spec.latchFirm===true,false);
  await load(weak,'coil-latch-legacy-weak.forma.json');await page.getByText(`${index+1}. ${old.name}`,{exact:true}).click();forced(await state());assert.equal((await state()).latchFirm.value,false);
  await openFold('#coil-stronger-latch');await page.locator('#coil-stronger-latch').click();forced(await state());s=await state();assert.equal(s.latchFirm.value,true);assert.equal(s.latchGap.value,.2);assert.equal(s.latchEngagement.value,.9);
  await page.locator('#cad-cancel').click();const unchanged=(await save()).features.find(f=>f.id===old.id);
  assert.deepEqual(unchanged.spec,old.spec,'cancel must not save firm settings on a weak joint');assert.deepEqual(unchanged.outputs,old.outputs,'cancel must preserve weak joint meshes and BREP');assert.deepEqual(unchanged.analysis,old.analysis,'cancel must retain the weak joint analysis');
 }
 // Rebase a verified absolute-zero fixture without changing its geometry.
 // A new relative -2 plus baseline +2 must retain those saved solids on reload.
 const rebased=structuredClone(data),rebasedFeature=rebased.features.find(f=>f.id===feature.id);
 rebasedFeature.spec.closeAngle=-2;rebasedFeature.spec.closeAngleZero=2;
 rebasedFeature.analysis.closeAngle=0;rebasedFeature.analysis.closeAngleAdjustment=-2;rebasedFeature.analysis.closeAngleZero=2;
 await load(rebased,'coil-latch-new-baseline.forma.json');await edit();
 assert.equal(Number(await page.locator('#cad-closeAngle').inputValue()),-2);
 assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),2);
 assert.match(await page.locator('#coil-angle-reference-help').textContent(),/2°補正を含む新しい基準/);
 await page.locator('#cad-cancel').click();const roundtrip=(await save()).features.find(f=>f.id===feature.id);
 assert.deepEqual(roundtrip.spec,rebasedFeature.spec);assert.deepEqual(roundtrip.outputs,rebasedFeature.outputs);assert.deepEqual(roundtrip.analysis,rebasedFeature.analysis);
 await page.locator('#direct-coil-joint').evaluate(e=>e.click());
 assert.equal(await page.locator('#cad-latchStyle').inputValue(),'ridge');assert.equal(await page.locator('#cad-latchFirm').isHidden(),true);
 assert.equal(Number(await page.locator('#cad-closeAngle').inputValue()),0);assert.equal(Number(await page.locator('#cad-closeAngleZero').inputValue()),2);
 assert.equal(await page.locator('#cad-latchExtraFirm').isChecked(),true);assert.equal(Number(await page.locator('#cad-latchGap').inputValue()),.05);assert.equal(Number(await page.locator('#cad-latchEngagement').inputValue()),1.6);assert.equal(Number(await page.locator('#cad-wall').inputValue()),4.2);assert.equal(Number(await page.locator('#cad-bodyBoreWall').inputValue()),1.5);
 await page.locator('#cad-cancel').click();
 assert.deepEqual(errors,[]);
 console.log('PASS new ridge UI and preset, claw option backups, native '+(fixturePath?'fixture':'apply')+', firm upgrade controls, presets and legacy defaults, internal version, saved model reload/edit, twist-release wording'+(legacyFixturePath?', legacy migration warning and cancel preservation':'')+(weakFixturePath?', weak-joint upgrade cancel preservation':''));
}finally{await browser.close();}
