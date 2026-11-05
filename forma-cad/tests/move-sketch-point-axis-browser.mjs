import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';

const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async (request,response)=>{
 try{
  const pathname=new URL(request.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  assert(file.startsWith(root+path.sep));
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));
 }catch{response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

let browser;
try{
 browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1720,height:1110},acceptDownloads:true});
 const field=id=>page.locator('#'+id);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');

 // The point is on the front face and offset from the center in both X and Z.
 const features=[
  {...defaults,id:'box',name:'Box',width:38,height:20,depth:16},
  {...defaults,id:'point-axis',name:'Axis point',kind:'sketch',profile:'point',groupId:'point-axis',groupNumber:1,plane:'XZ',x:6,y:-10,z:5},
  {...defaults,id:'point-axis-end',name:'Axis point 2',kind:'sketch',profile:'point',groupId:'point-axis',groupNumber:1,plane:'XZ',x:15,y:-10,z:12},
 ];
 async function startMove(additional=[]){
  await field('file').setInputFiles({name:'point-axis.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[...features,...additional]}))});
  await field('project-preview-open').click();
  await field('project-load-preview').waitFor({state:'hidden'});
  await page.locator('[data-view=front]').dispatchEvent('keydown',{key:'Enter'});
  await field('fit').click();
  const rect=await page.locator('#canvas-host canvas').boundingBox();
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100);
  const state=JSON.parse(await field('canvas-host').getAttribute('data-camera-state'));
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const bodyCenter=new THREE.Vector3(0,-10,8).project(camera);
  await field('move-tool').click();
  await page.mouse.click(rect.x+(bodyCenter.x+1)*rect.width/2,rect.y+(1-bodyCenter.y)*rect.height/2);
  await field('move-x').fill('4');
 }
 await startMove();
 const preview=async()=>JSON.parse(await field('canvas-host').getAttribute('data-move-preview'));
 assert.equal((await preview()).position[0],4);

 async function checkRotationDrag(customAxis=false){
  const host=field('canvas-host'),rect=await page.locator('#canvas-host canvas').boundingBox();
  const view=JSON.parse(await host.getAttribute('data-camera-state'));
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100);
  camera.position.fromArray(view);camera.quaternion.fromArray(view,3);camera.zoom=view[7];
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const center=new THREE.Vector3(...(await preview()).position).project(camera);
  const x=rect.x+(center.x+1)*rect.width/2,y=rect.y+(1-center.y)*rect.height/2,radius=rect.height*(customAxis ? .1 : .15);
  const pointerAt=degrees=>{
   const angle=THREE.MathUtils.degToRad(degrees-25);
   return page.mouse.move(x+radius*Math.cos(angle),y+radius*Math.sin(angle));
  };
  async function facePixel(){
   const image=(await page.screenshot()).toString('base64');
   return page.evaluate(async({image,x,y})=>{
    const screenshot=new Image();screenshot.src='data:image/png;base64,'+image;await screenshot.decode();
    const canvas=document.createElement('canvas');canvas.width=screenshot.width;canvas.height=screenshot.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(screenshot,0,0);
    return [...ctx.getImageData(Math.round(x+12),Math.round(y+14),1,1).data];
   },{image,x,y});
  }
  const snap=()=>host.getAttribute('data-move-rotation-snap');
  const readout=field('move-rotation-readout'),stepSelect=field('move-rotation-snap-step');
  const outline=()=>host.getAttribute('data-move-rotation-outline');
  assert.equal(await stepSelect.inputValue(),'15');
  assert.equal(await readout.isVisible(),customAxis);
  assert.equal(await outline(),null);
  await pointerAt(0);await page.mouse.down();
  await pointerAt(11);
  assert.equal(Math.abs(Number(await snap())),15,JSON.stringify({snap:await snap(),preview:await preview()}));
  const orange=await facePixel();
  assert(orange[0]>orange[2]+50,'snapped preview should be orange, got '+orange);
  assert.match(await readout.textContent(),/^(−)?15° ✓ 吸着$/);
  assert.equal(await outline(),'1');
  await page.keyboard.down('Alt');
  assert.equal(await snap(),null);
  assert.match(await readout.textContent(),/° · 吸着オフ$/);
  const bypassed=await facePixel();
  assert(bypassed[2]>bypassed[0]+40,'holding Alt immediately removes the orange tint');
  await page.keyboard.up('Alt');
  assert.equal(Math.abs(Number(await snap())),15);
  assert.match(await readout.textContent(),/15° ✓ 吸着$/);
  await pointerAt(20);
  assert.equal(Math.abs(Number(await snap())),15,'small movement out of capture keeps the angle locked');
  await pointerAt(22);
  assert.equal(await snap(),null,'moving farther away releases the angle');
  assert.match(await readout.textContent(),/°$/);
  const blue=await facePixel();
  assert(blue[2]>blue[0]+40,'released preview should be blue, got '+blue);
  await pointerAt(27);
  assert.equal(Math.abs(Number(await snap())),30);
  await page.mouse.up();
  assert.equal(await snap(),null,'ending the drag removes the snap highlight');
  const ended=await facePixel();
  assert(ended[2]>ended[0]+40,'ending the drag restores the normal color, got '+ended);
  assert(await readout.isVisible());
  assert.match(await readout.textContent(),/^(−)?30°$/);
  const edit=field('move-rotation-edit');
  await readout.click();await edit.fill('22.55');await edit.press('Enter');
  assert.equal(await readout.textContent(),'22.55°');
  const adjusted=await preview();
  const previewAngle=customAxis?adjusted.hingeAngle:Math.abs(THREE.MathUtils.radToDeg(adjusted.rotation[1]));
  assert(Math.abs(previewAngle-22.55)<1e-7,JSON.stringify(adjusted));
  await readout.click();await edit.fill('42');await edit.press('Escape');
  assert.deepEqual(await preview(),adjusted);
  assert.equal(await outline(),'1','original outline remains available for comparison');
  if(customAxis){
   for(const [step,drag,expected] of [['5',8.8,10],['45',38,45]]){
    await stepSelect.selectOption(step);
    await field('move-edge-angle').fill('0');
    await pointerAt(0);await page.mouse.down();await pointerAt(drag);
    assert.equal(Math.abs(Number(await snap())),expected);
    assert((await readout.textContent()).endsWith(expected+'° ✓ 吸着'));
    await page.mouse.up();
   }
   await stepSelect.selectOption('15');
  }
 }
 await page.locator('#move-panel [data-mode=rotate]').click();
 await checkRotationDrag();
 await field('move-ry').fill('0');

 await field('move-pick-axis').click();
 const point=field('move-axis-candidates').locator('circle[data-point="[6,-10,5]"]');
 const guide=async()=>JSON.parse(await field('canvas-host').getAttribute('data-move-rotation-guide'));
 await point.hover();
 const hovered=await guide();
 assert(hovered.hover&&hovered.direction[1]>.999&&hovered.point[0]===6);
 await point.click();
 const chosen=await preview();
 assert.deepEqual(chosen.position,[6,-10,5]);
 assert(new THREE.Vector3(...chosen.edgeAxis).distanceTo(new THREE.Vector3(0,1,0))<1e-8);
 assert(await field('move-quarter-axis').isDisabled());
 assert.equal((await guide()).hover,false);
 assert.equal(await field('move-point-axis-direction').inputValue(),'normal');
 await checkRotationDrag(true);
 await field('move-edge-angle').fill('0');
 await field('move-plus90').click();
 assert.equal(Number(await field('move-edge-angle').inputValue()),90);
 const axisDirection=field('move-point-axis-direction');
 for(const [name,vector] of [['X',[1,0,0]],['Z',[0,0,1]],['Y',[0,1,0]],['normal',[0,1,0]]]){
  await axisDirection.selectOption(name);
  const switched=await preview(),visible=await guide(),axis=new THREE.Vector3(...vector);
  assert(new THREE.Vector3(...switched.position).distanceTo(new THREE.Vector3(6,-10,5))<1e-8);
  assert(new THREE.Vector3(...visible.direction).distanceTo(axis)<1e-8);
  assert.equal(Number(await field('move-edge-angle').inputValue()),90);
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...switched.rotation,'ZYX'));
  assert(Math.abs(rotation.dot(new THREE.Quaternion().setFromAxisAngle(axis,Math.PI/2)))>1-1e-8);
 }
 async function applyAndSave(){
  await field('move-apply').click();
  await field('move-panel').waitFor({state:'hidden',timeout:30000});
  const downloading=page.waitForEvent('download');
  await field('save').click();
  const saved=JSON.parse(await fs.readFile(await (await downloading).path(),'utf8'));
  return saved.features.at(-1).spec;
 }
 const spec=await applyAndSave();
 assert.equal(spec.type,'move');
 assert.equal(spec.target,'box');
 assert.deepEqual(spec.pivot,[2,-10,5]);
 assert.equal(spec.x,4);
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation.map(value=>THREE.MathUtils.degToRad(value)),'ZYX'));
 assert(new THREE.Vector3(1,0,0).applyQuaternion(q).distanceTo(new THREE.Vector3(0,0,-1))<1e-7,'saved Euler angles: '+JSON.stringify(spec.rotation));
 assert.equal(await field('canvas-host').getAttribute('data-move-rotation-guide'),null);
 assert.equal(await field('canvas-host').getAttribute('data-move-rotation-outline'),null);

 await startMove();
 await field('move-pick-axis-pair').click();
 await point.click();
 assert.deepEqual((await guide()).point,[6,-10,5]);
 assert.equal((await guide()).direction,undefined);
 const second=field('move-axis-candidates').locator('circle[data-point="[15,-10,12]"]');
 await second.hover();
 const diagonal=new THREE.Vector3(9,0,7).normalize();
 assert(new THREE.Vector3(...(await guide()).direction).distanceTo(diagonal)<1e-8);
 assert.equal((await guide()).hover,true);
 await second.click();
 assert.equal((await guide()).hover,false);
 assert(new THREE.Vector3(...(await preview()).edgeAxis).distanceTo(diagonal)<1e-8);
 assert.equal(await axisDirection.isVisible(),false);
 await field('move-edge-angle').fill('45');
 const diagonalPreview=await preview();
 const diagonalRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...diagonalPreview.rotation,'ZYX'));
 assert(Math.abs(diagonalRotation.dot(new THREE.Quaternion().setFromAxisAngle(diagonal,Math.PI/4)))>1-1e-8);
 const pairSpec=await applyAndSave();
 assert.deepEqual(pairSpec.pivot,[2,-10,5]);
 assert.equal(pairSpec.x,4);
 const savedPairRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...pairSpec.rotation.map(THREE.MathUtils.degToRad),'ZYX'));
 assert(Math.abs(savedPairRotation.dot(new THREE.Quaternion().setFromAxisAngle(diagonal,Math.PI/4)))>1-1e-8);
 assert.equal(await field('canvas-host').getAttribute('data-move-rotation-guide'),null);
 assert.equal(await field('canvas-host').getAttribute('data-move-rotation-outline'),null);
 const targetTurn=THREE.MathUtils.degToRad(30);
 await startMove([{...defaults,id:'fixed-box',name:'Fixed box',width:24,height:20,depth:16,x:-56,angle:30}]);
 await field('move-pick-axis').click();await point.click();
 const impossible=await preview(),align=field('move-align-faces');
 await align.click();
 assert.match(await field('move-hint').textContent(),/①/);
 const rect=await page.locator('#canvas-host canvas').boundingBox();
 const view=JSON.parse(await field('canvas-host').getAttribute('data-camera-state'));
 const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100);
 camera.position.fromArray(view);camera.quaternion.fromArray(view,3);camera.zoom=view[7];
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 async function pickFace(point){
  const p=point.project(camera);
  await page.mouse.click(rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2);
 }
 await pickFace(new THREE.Vector3(4,-10,8));
 assert.match(await field('move-hint').textContent(),/②/);
 const fixedFace=new THREE.Vector3(0,-10,8).applyAxisAngle(new THREE.Vector3(0,0,1),targetTurn).add(new THREE.Vector3(-56,0,0));
 await pickFace(fixedFace.clone());
 assert.match(await field('move-error').textContent(),/この回転軸では2面を平行にできません/);
 assert.deepEqual(await preview(),impossible);
 await page.keyboard.press('Escape');
 assert.equal(await align.getAttribute('aria-pressed'),'false');
 await axisDirection.selectOption('Z');
 const beforeAlignment=await preview();
 await align.click();
 await pickFace(new THREE.Vector3(4,-10,8));
 await pickFace(fixedFace);
 assert.match(await field('move-hint').textContent(),/平行にしました/);
 const aligned=await preview();
 assert.deepEqual(aligned.position,beforeAlignment.position);
 assert.deepEqual(aligned.pivot,beforeAlignment.pivot);
 assert.deepEqual(aligned.edgeAxis,beforeAlignment.edgeAxis);
 assert(Math.abs(aligned.rotation[2]-targetTurn)<1e-7);
 const alignedSpec=await applyAndSave();
 assert.deepEqual(alignedSpec.pivot,[2,-10,5]);
 assert.equal(alignedSpec.x,4);
 assert(Math.abs(alignedSpec.rotation[2]-30)<1e-7);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,sketchPointAxis:true,axisNormalTowardBody:true,offsetPoint:true,translationPreserved:true,savedRotation:true,hoverGuide:true,persistentGuide:true,directionSwitch:true,twoPointAxis:true,strongRotationSnap:true,rotationSnapColor:true,rotationReadout:true,rotationSnapSteps:true,rotationAltOverride:true,rotationOriginalOutline:true,inlineAngle:true,fixedAxisAlignment:true,impossibleAlignmentPreserved:true,errors}));
}finally{await browser?.close();server.close();}
