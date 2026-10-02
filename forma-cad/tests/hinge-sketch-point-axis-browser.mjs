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
const enclosure=runOperation([source],spec);
// +Y hinge center: source max Y + clearance + thickness + barrel radius + web offset.
const hingeCenter=[0,10+.5+2+(Math.max(1,2*.55)+.5+Math.max(.9,2*.65))+2*.4,10];
const point={...defaults,id:'hinge-center',name:'ヒンジ中心',kind:'sketch',profile:'point',groupId:'hinge-center',x:hingeCenter[0],y:hingeCenter[1],z:hingeCenter[2]};
const features=[source,{kind:'cadop',id:'enclosure',name:'囲み',spec,...enclosure},point];

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1100},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'hinge-point.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='3');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 const canvas=page.locator('canvas'),rect=await canvas.boundingBox();
 await page.waitForTimeout(100);
 const cameraState=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
 camera.position.fromArray(cameraState);
 camera.quaternion.fromArray(cameraState,3);
 camera.zoom=cameraState[7];
 camera.updateProjectionMatrix();
 camera.updateMatrixWorld(true);
 const clickWorld=async coords=>{const q=new THREE.Vector3(...coords).project(camera);await page.mouse.click(rect.x+(q.x+1)*rect.width/2,rect.y+(1-q.y)*rect.height/2);};

 await page.locator('#move-tool').click();
 await clickWorld([0,0,22.5]);
 await page.waitForFunction(()=>document.getElementById('move-apply')&&!document.getElementById('move-apply').disabled);
 await page.locator('#move-pick-axis').click();
 await clickWorld(hingeCenter);
 const preview=JSON.parse(await page.locator('#canvas-host').getAttribute('data-move-preview'));
 assert.ok(new THREE.Vector3(...preview.pivot).distanceTo(new THREE.Vector3(...hingeCenter))<1e-4,'sketch point is the exact rotation pivot');
 assert.ok(new THREE.Vector3(...preview.edgeAxis).distanceTo(new THREE.Vector3(1,0,0))<1e-4,'hinge axis follows X');
 await page.locator('#move-plus90').click();
 assert.equal(await page.locator('#move-edge-angle').inputValue(),'90');
 await page.locator('#move-apply').click();
 await page.waitForFunction(()=>document.getElementById('move-panel').hidden,{},{timeout:120000});
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 const move=saved.features.at(-1);
 assert.equal(move.spec.type,'move');
 assert.equal(move.spec.target,'hinge-part2','the lid is rotated');
 assert.ok(new THREE.Vector3(...move.spec.pivot).distanceTo(new THREE.Vector3(...hingeCenter))<1e-4,'saved rotation keeps the selected point');
 assert.ok(Math.abs(Math.abs(move.spec.rotation[0])-90)<1e-4,'lid rotates 90 degrees around X');
 assert.ok(Math.abs(move.spec.rotation[1])<1e-4&&Math.abs(move.spec.rotation[2])<1e-4);
 assert.deepEqual(errors,[]);
 console.log('PASS sketch point picked as hinged lid axis, exact center pivot and saved 90-degree rotation');
}finally{await browser.close();}

