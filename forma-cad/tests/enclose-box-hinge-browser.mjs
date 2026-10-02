import {chromium} from 'playwright';
import {defaults,validateProject} from '../src/geometry.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

function stlPartBounds(bytes,counts){
 let first=0;
 return counts.map(count=>{
  let low=Infinity,high=-Infinity;
  for(let i=first;i<first+count;i++)for(let j=0;j<3;j++){
   const z=bytes.readFloatLE(84+i*50+12+j*12+8);
   low=Math.min(low,z);high=Math.max(high,z);
  }
  first+=count;
  return {low,high};
 });
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1200},acceptDownloads:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 const features=[{...defaults,id:'box',name:'対象',width:30,height:20,depth:20,x:0,y:0}];
 await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-enclose').evaluate(e=>e.click());
 const earlySplit=await page.locator('#cad-enclosureSplit').boundingBox(),fieldViewport=await page.locator('#cad-fields').boundingBox();
 assert.ok(earlySplit.y>=fieldViewport.y&&earlySplit.y+earlySplit.height<=fieldViewport.y+fieldViewport.height,'split plane is visible as soon as enclosure opens');
 await page.locator('#cad-enclosureSplit').selectOption('XY');
 await page.locator('#cad-splitOffset').fill('8');
 const earlyOffset=await page.locator('#cad-splitOffset').boundingBox();
 assert.ok(earlyOffset.y+earlyOffset.height<=fieldViewport.y+fieldViewport.height,'split position can be specified before hinge settings');
 await page.locator('#cad-boxMode').check();
 await page.locator('#cad-hinge').check();
 assert.equal(await page.locator('#cad-splitOffset').inputValue(),'8','turning on the hinge preserves the position chosen early');
 await page.locator('#cad-hinge').uncheck();
 await page.locator('#cad-enclosureSplit').selectOption('分割しない');
 assert.equal(await page.locator('#enclose-face-controls').isVisible(),true);
 assert.match(await page.locator('#enclose-face-status').textContent(),/閉じたBOX/);
 assert.equal(await page.locator('#enclose-hinge-options').isVisible(),true);
 await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:120000});
 assert.equal(await page.locator('#body-count').textContent(),'2','BOX without an opening or split is one closed body');
 await page.locator('#features .tree-row').last().locator('button.row-label').click();
 assert.equal(await page.locator('#cad-boxMode').isChecked(),true);
 assert.equal(await page.locator('#enclose-hinge-options').isVisible(),true);
 await page.locator('[data-view=top]').evaluate(e=>e.click());await page.locator('#fit').evaluate(e=>e.click());
 await page.locator('#enclose-pick').click();
 const canvas=await page.locator('canvas').boundingBox();await page.mouse.click(canvas.x+canvas.width/2+30,canvas.y+canvas.height/2+20);
 await page.waitForFunction(()=>document.getElementById('enclose-face-status').textContent.includes('+Z'));
 await page.locator('#enclose-pick').click();
 await page.locator('#cad-hinge').check();
 assert.equal(await page.locator('#cad-enclosureSplit').inputValue(),'XY');
 assert.deepEqual(await page.locator('#cad-hingeEdge option').allTextContents(),['-X 側','+X 側','-Y 側','+Y 側']);
 await page.locator('#cad-hingeEdge').selectOption('+Y');
 await page.locator('#enclose-print-pose').click();
 assert.equal(await page.locator('#cad-hingeAngle').inputValue(),'90');
 await page.waitForFunction(()=>document.querySelector('[data-machining-preview="enclose"]')&&document.getElementById('cad-error').textContent.includes('半透明'),{},{timeout:120000});
 await page.screenshot({path:'.sites-runtime/box-hinge-preview.png',fullPage:true});
 await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:120000});
 assert.equal(await page.locator('#body-count').textContent(),'3');
 assert.equal(await page.locator('#export-enclosure').isVisible(),true);
 await page.locator('#features .tree-row').last().locator('button.row-label').click();
 assert.equal(await page.locator('#cad-hingeAngle').inputValue(),'90');
 await page.locator('#enclose-close-lid').click();
 await page.waitForFunction(()=>document.querySelector('[data-machining-preview="enclose"]')&&document.getElementById('cad-error').textContent.includes('半透明'),{},{timeout:120000});
 await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:120000});
 assert.equal(await page.locator('#body-count').textContent(),'3');
 const saved=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(await fs.readFile(await(await saved).path(),'utf8'));validateProject(data);
 const operation=data.features.at(-1);assert.equal(operation.spec.boxMode,true);assert.equal(operation.spec.hinge,true);assert.equal(operation.spec.hingeEdge,'+Y');assert.equal(operation.spec.hingeAngle,0);assert.equal(operation.spec.faces.length,1);assert.equal(operation.outputs.length,2);
 const exported=page.waitForEvent('download');await page.locator('#export-enclosure').click();const bytes=await fs.readFile(await(await exported).path());
 const count=bytes.readUInt32LE(80);assert.equal(bytes.length,84+count*50);assert.equal(count,operation.outputs.reduce((sum,output)=>sum+output.triangles.length/3,0),'STL contains only the BOX and lid');
 let low=Infinity,high=-Infinity;for(let i=0;i<count;i++)for(let j=0;j<3;j++){const z=bytes.readFloatLE(84+i*50+12+j*12+8);low=Math.min(low,z);high=Math.max(high,z);}
 assert.ok(Math.abs(low)<1e-4,'printed assembly rests on Z=0');assert.ok(high>22,'the hinge-axis span is preserved');
 const partBounds=stlPartBounds(bytes,operation.outputs.map(output=>output.triangles.length/3));
 assert.ok(partBounds.every(part=>Math.abs(part.low)<1e-4),'both BOX and lid must touch the print bed');
 await page.locator('#undo').click();assert.equal(await page.locator('#body-count').textContent(),'3');await page.locator('#undo').click();assert.equal(await page.locator('#body-count').textContent(),'2');await page.locator('#undo').click();assert.equal(await page.locator('#body-count').textContent(),'1');await page.locator('#redo').click();await page.locator('#redo').click();await page.locator('#redo').click();assert.equal(await page.locator('#body-count').textContent(),'3');
 await page.locator('#file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='3');assert.equal(await page.locator('#export-enclosure').isVisible(),true);
 for(const plane of ['XZ','YZ']){
  await page.locator('#features .tree-row').last().locator('button.row-label').click();
  await page.locator('#cad-enclosureSplit').selectOption(plane);
  await page.locator('#cad-hingeEdge').selectOption(plane==='XZ'?'+X':'+Y');
  await page.locator('#cad-apply').click();
  await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,{},{timeout:120000});
  const exportedPlane=page.waitForEvent('download');await page.locator('#export-enclosure').click();const dataPlane=await fs.readFile(await(await exportedPlane).path());
  const triangles=dataPlane.readUInt32LE(80);let minZ=Infinity;for(let i=0;i<triangles;i++)for(let j=0;j<3;j++)minZ=Math.min(minZ,dataPlane.readFloatLE(84+i*50+12+j*12+8));
  assert.ok(Math.abs(minZ)<1e-4,plane+' print pose rests on Z=0');
  const savedPlane=page.waitForEvent('download');await page.locator('#save').click();
  const projectPlane=JSON.parse(await fs.readFile(await(await savedPlane).path(),'utf8'));
  const planeBounds=stlPartBounds(dataPlane,projectPlane.features.at(-1).outputs.map(output=>output.triangles.length/3));
  assert.ok(planeBounds.every(part=>Math.abs(part.low)<1e-4),plane+' BOX and lid both touch the print bed');
 }
 await page.locator('#features .tree-row').last().locator('button.row-label').click();
 assert.equal(await page.locator('#bodies .eye[aria-pressed="false"]').count(),2,'existing BOX and lid are temporarily hidden while selecting the source');
 await page.locator('#cad-cancel').click();
 await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);
 assert.equal(await page.locator('#bodies .eye[aria-pressed="false"]').count(),0,'cancel restores the completed bodies');
 await page.locator('#bodies .tree-row button.row-label').filter({hasText:'対象'}).click();
 assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-body-count'),'1');
 await page.keyboard.press('Delete');
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2',{},{timeout:120000});
 assert.equal(await page.locator('#export-enclosure').isVisible(),true);
 const savedWithoutSource=page.waitForEvent('download');await page.locator('#save').click();
 const projectWithoutSource=JSON.parse(await fs.readFile(await(await savedWithoutSource).path(),'utf8'));
 assert.equal(projectWithoutSource.features.at(-1).spec.type,'deleteBodies');
 const enclosureWithoutSource=projectWithoutSource.features.find(feature=>feature.spec?.type==='enclose');
 const exportedWithoutSource=page.waitForEvent('download');await page.locator('#export-enclosure').click();
 const boxStl=await fs.readFile(await(await exportedWithoutSource).path());
 const boxCounts=enclosureWithoutSource.outputs.map(output=>output.triangles.length/3);
 assert.equal(boxStl.readUInt32LE(80),boxCounts.reduce((sum,count)=>sum+count,0),'BOX and lid export after the original solid is deleted');
 assert.ok(stlPartBounds(boxStl,boxCounts).every(part=>Math.abs(part.low)<1e-4),'both remaining parts touch the print bed'); assert.deepEqual(errors,[]);
 console.log('PASS closed BOX creation, history edit to selected opening and one-click hinge, print STL, undo/redo and save/load');
}finally{await browser.close();}
