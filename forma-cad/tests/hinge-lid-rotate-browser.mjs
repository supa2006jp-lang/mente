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
const operation=runOperation([source],spec);
const frame=operation.analysis.hingeFrame;
assert.ok(frame?.a&&frame?.b&&frame?.point,'the generated BOX must carry its exact hinge frame');
const axis=new THREE.Vector3(...frame.b).sub(new THREE.Vector3(...frame.a)).normalize();
const pivot=new THREE.Vector3(...frame.point);

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'hinge-box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'enc',name:'囲み',spec,...operation}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='3');
 const host=page.locator('#canvas-host');
 const preview=async()=>JSON.parse(await host.getAttribute('data-move-preview'));
 const project=async world=>{
  const rect=await page.locator('canvas').boundingBox(),state=JSON.parse(await host.getAttribute('data-camera-state'));
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(...world).project(camera);
  return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
 };

 await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 await page.locator('#move-tool').click();
 const lidPoint=await project([0,0,22.5]);
 await page.mouse.click(lidPoint.x,lidPoint.y);
 const selected=await preview();
 assert.ok(selected.edgeAxis,'selecting the hinged lid must select its hinge axis automatically');
 assert.ok(new THREE.Vector3(...selected.edgeAxis).distanceTo(axis)<1e-5,'the selected rotation axis must be the physical hinge axis');
 assert.ok(new THREE.Vector3(...selected.pivot).distanceTo(pivot)<.05,'the rotation pivot must be on the hinge axis');
 assert.equal(await page.locator('[data-mode=rotate]').getAttribute('aria-pressed'),'true','the lid starts in hinge rotation mode');
 assert.equal(await page.locator('#move-edge-angle-label').isVisible(),true,'the hinge angle control is shown');
 assert.equal(await page.locator('#move-quarter-axis').isDisabled(),true,'the free X/Y/Z axis control is disabled');
 for(const id of ['rx','ry','rz'])assert.equal(await page.locator('#move-'+id).locator('..').isVisible(),false,'free rotation fields stay hidden');

 // Looking along the X hinge axis presents the local Z rotation ring face on.
 await page.locator('[data-view=right]').click();
 const center=await project(selected.pivot),rect=await page.locator('canvas').boundingBox();
 const radius=rect.height*.1; // TransformControls Z picker: .5 radius, size .8, orthographic factor H/4.
 const start={x:center.x+radius,y:center.y};
 await page.mouse.move(start.x,start.y);
 await page.mouse.down();
 const samples=[];
 for(let degrees=5;degrees<=175;degrees+=5){
  const radians=degrees*Math.PI/180;
  await page.mouse.move(center.x+radius*Math.cos(radians),center.y+radius*Math.sin(radians),{steps:2});
  samples.push(Number(await page.locator('#move-edge-angle').inputValue()));
 }
 await page.mouse.up();
 assert.ok(samples.length>12,'the hinge ring should be dragged through a substantial arc');
 assert.ok(Math.abs(samples[2])>2,'the local hinge ring should respond to dragging; sampled angles '+samples.slice(0,5));
 const magnitudes=samples.map(Math.abs);
 const near90=magnitudes.reduce((best,a)=>Math.min(best,Math.abs(a-90)),Infinity);
 assert.ok(near90<12,'drag should pass smoothly through 90°; nearest delta '+near90.toFixed(1)+'°');
 assert.ok(magnitudes.at(-1)>=170,'drag should reach nearly 180°, got '+magnitudes.at(-1)+'°');
 const maxStep=Math.max(...samples.slice(1).map((a,i)=>Math.abs(a-samples[i])));
 assert.ok(maxStep<20,'hinge rotation must stay continuous, largest 5 degree pointer step was '+maxStep.toFixed(1)+'°');
 assert.ok(new THREE.Vector3(...(await preview()).pivot).distanceTo(pivot)<.05,'hinge pivot remains fixed during drag');
 assert.ok(Math.abs((await preview()).hingeAngle-samples.at(-1))<.001,'preview and angle field agree throughout drag');
 const beforeOrbit=await host.getAttribute('data-camera-state'),angleBeforeOrbit=Number(await page.locator('#move-edge-angle').inputValue());
 await page.keyboard.down('Shift');await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,120);await page.keyboard.up('Shift');
 await page.waitForTimeout(100);
 assert.notEqual(await host.getAttribute('data-camera-state'),beforeOrbit,'Shift + wheel should orbit the view while the lid stays selected');
 assert.ok(Math.abs(Number(await page.locator('#move-edge-angle').inputValue())-angleBeforeOrbit)<.001,'orbiting must preserve the hinge angle');
 const orbitCamera=JSON.parse(await host.getAttribute('data-camera-state')),worldRadius=20/orbitCamera[7],continued=[];
 const ringPoint=degrees=>[pivot.x,pivot.y+worldRadius*Math.cos(degrees*Math.PI/180),pivot.z+worldRadius*Math.sin(degrees*Math.PI/180)];
 const restart=await project(ringPoint(0));
 await page.mouse.move(restart.x,restart.y);await page.mouse.down();
 for(let degrees=5;degrees<=35;degrees+=5){
  const projected=await project(ringPoint(degrees));
  await page.mouse.move(projected.x,projected.y,{steps:2});
  continued.push(Number(await page.locator('#move-edge-angle').inputValue()));
 }
 await page.mouse.up();
 assert.ok(Math.abs(continued.at(-1)-angleBeforeOrbit)>10,'the hinge ring should remain draggable after Shift + wheel');
 const resumedStep=Math.max(...continued.slice(1).map((a,i)=>Math.abs(a-continued[i])));
 assert.ok(resumedStep<20,'the hinge angle should remain continuous after orbit; largest step '+resumedStep.toFixed(1)+'°');
 assert.ok(new THREE.Vector3(...(await preview()).pivot).distanceTo(pivot)<.05,'hinge pivot remains fixed after orbit');
 assert.deepEqual(errors,[]);
 console.log('PASS hinged lid auto axis; 0→90→'+magnitudes.at(-1).toFixed(1)+'° ring drag (max step '+maxStep.toFixed(1)+'°); Shift + wheel then '+angleBeforeOrbit.toFixed(1)+'°→'+continued.at(-1).toFixed(1)+'° (max step '+resumedStep.toFixed(1)+'°)');
}finally{await browser.close();}
