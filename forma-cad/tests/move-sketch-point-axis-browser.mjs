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
  {...defaults,id:'point-axis',name:'Axis point',kind:'sketch',profile:'point',groupId:'point-axis',plane:'XZ',x:6,y:-10,z:5},
 ];
 await field('file').setInputFiles({name:'point-axis.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
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
 const preview=async()=>JSON.parse(await field('canvas-host').getAttribute('data-move-preview'));
 assert.equal((await preview()).position[0],4);

 await field('move-pick-axis').click();
 const point=field('move-axis-candidates').locator('circle[data-point="[6,-10,5]"]');
 await point.click();
 const chosen=await preview();
 assert.deepEqual(chosen.position,[6,-10,5]);
 assert(new THREE.Vector3(...chosen.edgeAxis).distanceTo(new THREE.Vector3(0,1,0))<1e-8);
 assert(await field('move-quarter-axis').isDisabled());
 await field('move-plus90').click();
 assert.equal(Number(await field('move-edge-angle').inputValue()),90);
 await field('move-apply').click();
 await field('move-panel').waitFor({state:'hidden',timeout:30000});
 const downloading=page.waitForEvent('download');
 await field('save').click();
 const saved=JSON.parse(await fs.readFile(await (await downloading).path(),'utf8'));
 const spec=saved.features.at(-1).spec;
 assert.equal(spec.type,'move');
 assert.equal(spec.target,'box');
 assert.deepEqual(spec.pivot,[2,-10,5]);
 assert.equal(spec.x,4);
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation.map(value=>THREE.MathUtils.degToRad(value)),'ZYX'));
 assert(new THREE.Vector3(1,0,0).applyQuaternion(q).distanceTo(new THREE.Vector3(0,0,-1))<1e-7,'saved Euler angles: '+JSON.stringify(spec.rotation));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,sketchPointAxis:true,axisNormalTowardBody:true,offsetPoint:true,translationPreserved:true,savedRotation:true,errors}));
}finally{await browser?.close();server.close();}
