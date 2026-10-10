import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const prefix='/mente/forma-cad/',root=path.resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!url.startsWith(prefix)){res.writeHead(404);return res.end();}
  let relative=url.slice(prefix.length)||'index.html';if(relative.endsWith('/'))relative+='index.html';
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1700,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const host=page.locator('#canvas-host'),picker=page.locator('#selection-candidates');
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'cut-entry.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}


 const fixture={"format":"forma-cad","version":1,"features":[{"profile":"rect","mode":"solid","side":"inside","plane":"XY","operation":"new","target":"","width":10,"height":10,"diameter":30,"depth":10,"wall":2,"x":100,"y":0,"z":0,"angle":0,"taperAngle":0,"id":"far","name":"unaffected body","kind":"extrusion"},{"profile":"rect","mode":"solid","side":"inside","plane":"CUSTOM","operation":"new","target":"","width":50,"height":50,"diameter":30,"depth":15,"wall":2,"x":0,"y":0,"z":0,"angle":0,"taperAngle":0,"id":"body","name":"rotated body","kind":"extrusion","frame":{"u":[0.9393050084864333,0,0.3430832275590013],"v":[0,1,0],"n":[-0.3430832275590013,0,0.9393050084864333]}},{"profile":"circle","mode":"solid","side":"inside","plane":"CUSTOM","operation":"new","target":"far","width":60,"height":40,"diameter":40,"depth":2,"wall":2,"x":-5.14624831046005,"y":0,"z":14.089574845504997,"angle":0,"taperAngle":0,"id":"sketch","name":"circle","kind":"sketch","frame":{"u":[0.9393050070381455,0,0.34308323152417347],"v":[0,1,0],"n":[-0.34308323152417347,0,0.9393050070381455]},"targetAllBodies":false,"groupId":"circle-group","groupNumber":1,"groupHidden":false}]};
 await load(fixture.features);
 await page.locator('[data-view=iso]').click();await page.waitForTimeout(150);
 await page.mouse.click(...await screen([fixture.features.at(-1).x,0,fixture.features.at(-1).z]));
 await page.locator('#solid-tool').click();
 await page.locator('#extrude-distance').waitFor({state:'visible'});
 await page.locator('#viewport-depth').fill('-8.86');
 await page.waitForFunction(()=>document.getElementById('operation').value==='cut'&&!/確認中|新規ボディ/.test(document.getElementById('extrusion-target-status').textContent),{},{timeout:60000});
 console.log('STATUS',await page.locator('#extrusion-target-status').textContent(),await page.locator('#viewport-depth-error').textContent());


 await page.locator('#extrude-distance button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='4'&&document.getElementById('extrude-distance').hidden);
 await page.mouse.move(30,30);await page.waitForTimeout(120);
 await page.locator('[data-sketch-number="1"] .eye').click();await page.waitForTimeout(100);
 const result=await save();
 assert.equal(result.features.length,4);const cut=result.features.at(-1);
 assert.equal(cut.operation,'cut');assert.equal(cut.depth,-8.86);assert.equal(cut.cadResult.outputs.length,1);
 assert.equal(cut.cadResult.outputs[0].id,fixture.features[1].id);
 const built=rebuild(result.features),g=built.get(cut.cadResult.outputs[0].id).geometry;
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),solid=new THREE.Mesh(g,material),normal=new THREE.Vector3(...cut.frame.n),c=fixture.features.at(-1),point=new THREE.Vector3(c.x,c.y,c.z);solid.updateMatrixWorld(true);
 const hits=new THREE.Raycaster(point.clone().addScaledVector(normal,20),normal.clone().negate(),0,100).intersectObject(solid);
 assert.ok(Math.abs(hits[0].point.clone().sub(point).dot(normal)+8.86)<1e-4,'No thin roof remains over the hole');
 material.dispose();for(const brush of built.values())brush.geometry.dispose();

 assert.deepEqual(result.features.slice(0,-2),fixture.features.slice(0,-1),'Original solid history is preserved');assert.deepEqual(result.features.at(-2),{...fixture.features.at(-1),groupHidden:true},'Only the used sketch visibility changes');

 await fs.writeFile('.sites-runtime/cut-entry-browser-result.json',JSON.stringify(result,null,2));
 await page.screenshot({path:'.sites-runtime/cut-entry-browser.png'});
 // Re-open the produced file and verify the saved cut remains intact.
 await load(result.features);
 const reloaded=await save();assert.deepEqual(reloaded.features,result.features);
 console.log('PASS rotated surface UI negative-depth all-body cut, expected body only, exact CAD output, preserved history and save/reload');
 assert.deepEqual(errors,[]);

}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
