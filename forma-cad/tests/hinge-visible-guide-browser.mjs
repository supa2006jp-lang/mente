import {chromium} from 'playwright';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source={...defaults,id:'source',name:'対象',width:30,height:20,depth:20};
const spec={type:'enclose',id:'hinge',target:'source',thickness:2,clearance:.5,boxMode:true,faces:[],enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:0};
const operation=runOperation([source],spec),body=operation.outputs[0],vertices=[];
for(let i=0;i<body.vertices.length;i+=3)vertices.push(body.vertices.slice(i,i+3));
// Measure the barrel from the actual tessellation, independently of the UI's
// algebraic hinge formula. The end cap facing the oblique camera is +X.
const barrel=vertices.filter(v=>v[1]>13&&Math.abs(v[2]-10)<5);
assert.ok(barrel.length>100,'hinge barrel vertices are present');
const capX=Math.max(...barrel.map(v=>v[0]));
const maxY=Math.max(...barrel.map(v=>v[1]));
const zRange=[Math.min(...barrel.map(v=>v[2])),Math.max(...barrel.map(v=>v[2]))];
const radius=(zRange[1]-zRange[0])/2;
const rimCenter=[capX,maxY-radius,(zRange[0]+zRange[1])/2];
const sleeveOutput=operation.outputs[1],sleeveVertices=[];
for(let i=0;i<sleeveOutput.vertices.length;i+=3)sleeveVertices.push(sleeveOutput.vertices.slice(i,i+3));
const sleeve=sleeveVertices.filter(v=>v[1]>13&&Math.abs(v[2]-10)<5);
assert.ok(sleeve.length>100,'lid sleeve vertices are present');
const sleeveZ=[Math.min(...sleeve.map(v=>v[2])),Math.max(...sleeve.map(v=>v[2]))];
const sleeveCenter=[
 Math.max(...sleeve.map(v=>v[0])),
 Math.max(...sleeve.map(v=>v[1]))-(sleeveZ[1]-sleeveZ[0])/2,
 (sleeveZ[0]+sleeveZ[1])/2
];

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1100},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'hinge-guide.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'enclosure',name:'囲み',spec,...operation}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='3');
 const project=async point=>{
  const rect=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const q=new THREE.Vector3(...point).project(camera);
  return {x:rect.x+(q.x+1)*rect.width/2,y:rect.y+(1-q.y)*rect.height/2};
 };
 const markerPosition=async selector=>page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,title:el.title};});
 const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

 // Sketch on the visible +X hinge cap, then inspect its guide in an oblique view.
 await page.locator('#plane').evaluate(el=>{el.value='YZ';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('#new-point').click();
 await page.locator('#x').fill(String(capX));
 await page.locator('#draw').click();
 await page.locator('[data-view=iso]').click();
 await page.locator('#fit').click();
 let expected=await project(rimCenter);
 await page.mouse.move(expected.x,expected.y);
 await page.waitForTimeout(180);
 const sketchGuide=page.locator('.center-marker[aria-label="ヒンジ軸中心を選択"]:visible');
 assert.equal(await sketchGuide.count(),1,'sketch mode should show the analytic hinge center guide');
 const sketchMarker=await markerPosition('.center-marker[aria-label="ヒンジ軸中心を選択"]:visible');
 assert.ok(near(sketchMarker,expected)<3,`sketch guide is ${near(sketchMarker,expected).toFixed(2)} px from rendered hinge rim center`);

 // Select the lid from above, then inspect the move tool's hinge center guide
 // in the same oblique view.
 await page.keyboard.press('Escape');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await page.locator('#move-tool').click();
 const lid=await project([0,0,22.5]);
 await page.mouse.click(lid.x,lid.y);
 await page.waitForFunction(()=>document.getElementById('move-apply')&&!document.getElementById('move-apply').disabled);
 await page.locator('[data-view=iso]').click();
 await page.locator('#move-pick-center').click();
 expected=await project(rimCenter);
 const moveGuide=page.locator('#move-center-markers [aria-label="ヒンジ軸中心を選択"]');
 const moveMarkers=await moveGuide.evaluateAll(elements=>elements.map(el=>{
  const rect=el.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,point:JSON.parse(el.dataset.point)};
 }));
 assert.ok(moveMarkers.length>0,'move tool should offer hinge-axis centers at visible rims');
 const nearest=moveMarkers.reduce((best,marker)=>near(marker,expected)<near(best,expected)?marker:best);
 assert.ok(near(nearest,expected)<3,`move guide is ${near(nearest,expected).toFixed(2)} px from rendered hinge rim center`);
 assert.ok(Math.hypot(nearest.point[1]-rimCenter[1],nearest.point[2]-rimCenter[2])<.002,'visible move guide lies on the true hinge axis');
 await page.locator('#move-pick-axis').click();
 await page.mouse.click(expected.x,expected.y);
 const preview=JSON.parse(await page.locator('#canvas-host').getAttribute('data-move-preview'));
 assert.ok(Math.hypot(preview.pivot[1]-rimCenter[1],preview.pivot[2]-rimCenter[2])<.002,'picked rotation pivot lies on the true hinge axis');
 assert.ok(Math.abs(Math.abs(preview.edgeAxis[0])-1)<1e-5&&Math.hypot(preview.edgeAxis[1],preview.edgeAxis[2])<1e-5,'picked rotation axis follows hinge X direction');

 // The lid's sleeve has its own +X circular cap. It must remain selectable
 // even while the original lid mesh is hidden behind the move preview proxy.
 await page.locator('#move-pick-center').click();
 const sleeveExpected=await project(sleeveCenter);
 const sleeveMarkers=await moveGuide.evaluateAll(elements=>elements.map(el=>{
  const rect=el.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,point:JSON.parse(el.dataset.point)};
 }));
 assert.ok(sleeveMarkers.length>0,'move tool should offer the lid sleeve center');
 const nearestSleeve=sleeveMarkers.reduce((best,marker)=>near(marker,sleeveExpected)<near(best,sleeveExpected)?marker:best);
 assert.ok(near(nearestSleeve,sleeveExpected)<3,`lid sleeve guide is ${near(nearestSleeve,sleeveExpected).toFixed(2)} px from its rendered rim center (guide=${JSON.stringify(nearestSleeve.point)}, rim=${JSON.stringify(sleeveCenter)})`);
 assert.ok(new THREE.Vector3(...nearestSleeve.point).distanceTo(new THREE.Vector3(...sleeveCenter))<.002,'lid sleeve guide has the actual cap-center coordinates');
 await page.locator('#move-pick-axis').click();
 await page.mouse.click(sleeveExpected.x,sleeveExpected.y);
 const sleevePreview=JSON.parse(await page.locator('#canvas-host').getAttribute('data-move-preview'));
 assert.ok(new THREE.Vector3(...sleevePreview.pivot).distanceTo(new THREE.Vector3(...sleeveCenter))<.002,'picked rotation pivot equals lid sleeve cap center');
 assert.ok(Math.abs(Math.abs(sleevePreview.edgeAxis[0])-1)<1e-5&&Math.hypot(sleevePreview.edgeAxis[1],sleevePreview.edgeAxis[2])<1e-5,'lid sleeve rotation axis follows hinge X direction');
 assert.deepEqual(errors,[]);
 console.log('PASS sketch, body barrel and lid sleeve guides align with rendered hinge rims; both rotation axes are selectable');
}finally{await browser.close();}
