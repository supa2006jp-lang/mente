import {chromium} from 'playwright';import * as THREE from 'three';import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('dist'),out='.sites-runtime/rib-controls-browser';await fs.mkdir(out,{recursive:true});const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1900,height:1350},acceptDownloads:true}),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));const q=id=>page.locator('#print-support-dialog [data-id="'+id+'"]'),host=page.locator('#canvas-host');
async function ready(){try{await page.waitForFunction(()=>!document.querySelector('#print-support-dialog [data-id=apply]').disabled);}catch(e){throw Error(await q('error').textContent()||e.message);}}
async function load(doc){
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.cameraState);
 const features=doc.features.map(feature=>({...feature,name:feature.name??feature.id}));
 await page.locator('#file').setInputFiles({name:'rib-controls.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...doc,features}))});
 const result=await page.waitForFunction(()=>{
  if(document.getElementById('project-load-preview').open)return 'ready';
  const status=document.getElementById('toast').textContent;
  return status.startsWith('読み込みできません')&&status;
 });
 assert.equal(await result.jsonValue(),'ready');
 await page.locator('#project-preview-open').click();
 await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
 await page.locator('[data-view=iso]').dispatchEvent('click');await page.locator('#fit').click();
}
async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
const view=async()=>JSON.parse(await host.getAttribute('data-support-rib-preview')),analysis=async()=>JSON.parse(await host.getAttribute('data-print-support'));
async function excluded(n){await page.waitForFunction(count=>{const s=document.getElementById('canvas-host').dataset.printSupport;return s&&JSON.parse(s).ribs?.excluded===count;},n);}
async function screen(point){
 const box=await host.locator('canvas').boundingBox(),state=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip'));
 const camera=new THREE.OrthographicCamera(-100*box.width/box.height,100*box.width/box.height,100,-100,...clip);
 camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const p=new THREE.Vector3(...point).project(camera);
 return [box.x+(p.x+1)*box.width/2,box.y+(1-p.y)*box.height/2];
}
async function setView(direction){
 await page.locator('[data-cube-direction="'+direction+'"]').dispatchEvent('keydown',{key:'Enter'});
 await page.waitForTimeout(200);
}
async function clickRib(){
 await setView('0,0,1');
 const ribs=(await view()).ribs.filter(r=>!r.excluded),axis=ribs[0].axis,other=1-axis;
 const rib=ribs.reduce((first,next)=>first.bounds[0][axis]<next.bounds[0][axis]?first:next);
 const edge=[...rib.bounds[0]],inside=[...edge];
 edge[other]=inside[other]=rib.bounds[0][other]+3;
 inside[axis]=rib.center;
 const [x,y]=await screen(edge),[insideX,insideY]=await screen(inside);
 const distance=Math.hypot(x-insideX,y-insideY);
 await page.mouse.click(x+4*(x-insideX)/distance,y+4*(y-insideY)/distance);
 await excluded(1);
 assert.equal((await view()).ribs.find(r=>r.excluded).id,rib.id);
}
try{
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);await page.goto('http://127.0.0.1:'+server.address().port+'/');const doc=JSON.parse(await fs.readFile('.sites-runtime/roof-removal-fixture.forma.json','utf8'));await load(doc);const before=await save();await page.locator('#features .row-label').last().click();await ready();assert.equal(await q('lineWidth').inputValue(),'0.4');assert(!(await q('fitLineWidth').isChecked()));assert.equal(await q('wallDirection').inputValue(),'auto');assert.match(await q('print-settings-note').textContent(),/薄壁 2本分.*薄皮 2層/);
 await q('fitLineWidth').check();await ready();await q('lineWidth').fill('.45');await ready();assert.equal(await q('wallThickness').inputValue(),'0.9');assert(await q('wallThickness').evaluate(e=>e.readOnly));await q('wallLines').fill('3');await ready();assert.equal(await q('wallThickness').inputValue(),'1.35');await q('roofLayers').fill('3');await ready();assert.match(await q('print-settings-note').textContent(),/3層（0.9 mm）/);await q('wallLines').fill('2');await ready();await q('roofLayers').fill('2');await ready();
 await q('wallDirection').selectOption('x');await ready();assert.equal((await analysis()).count,3);assert((await view()).ribs.every(r=>r.axis===1));await q('rib-rotate').click();await ready();assert.equal(await q('wallDirection').inputValue(),'y');assert.equal((await analysis()).count,5);
 await q('rib-selection').evaluate(e=>e.open=true);await q('rib-pick').click();assert(await q('apply').isDisabled());await host.locator('[data-rib-marker]').nth(2).click();await excluded(1);assert.match(await q('error').textContent(),/間隔/);assert.equal((await view()).ribs.filter(r=>r.excluded).length,1);await q('rib-pick').click();assert(await q('apply').isDisabled());assert(await q('export3mf').isDisabled());await page.screenshot({path:out+'/unsupported-roof.png'});await q('rib-reset').click();await ready();
 await q('wallRoof').uncheck();await ready();await q('rib-pick').click();await clickRib();await excluded(1);await q('rib-pick').click();await ready();assert.equal((await analysis()).count,4);assert.equal((await analysis()).ribs.issues.length,0);await page.screenshot({path:out+'/excluded-preview.png'});const download=page.waitForEvent('download');await q('export3mf').click();await fs.copyFile(await(await download).path(),'.sites-runtime/support-slicing/ui-rib-controls.3mf');await q('apply').click();await page.locator('#print-support-dialog').waitFor({state:'hidden'});assert.equal(await host.getAttribute('data-support-rib-preview'),null);assert.equal(await host.locator('[data-rib-marker]').count(),0);
 const saved=await save(),spec=saved.features.at(-1).spec;assert.equal(spec.lineWidth,.45);assert.equal(spec.wallLines,2);assert.equal(spec.fitLineWidth,true);assert.equal(spec.wallDirection,'y');assert.equal(spec.excludedRibs.length,1);assert(!saved.features.at(-1).supportPreview);assert.deepEqual(saved.features.slice(0,-1),before.features.slice(0,-1));await page.locator('#undo').click();assert.deepEqual((await save()).features,before.features);await page.locator('#redo').click();assert.deepEqual((await save()).features.at(-1).spec,spec);
 await load(saved);await page.locator('#features .row-label').last().click();await ready();assert.equal(await q('lineWidth').inputValue(),'0.45');assert(await q('fitLineWidth').isChecked());assert.equal((await analysis()).ribs.excluded,1);await q('rib-selection').evaluate(e=>e.open=true);
 while((await analysis()).ribs.excluded<5){const index=(await view()).ribs.findIndex(r=>!r.excluded),next=(await analysis()).ribs.excluded+1;await q('rib-list').locator('input').nth(index).uncheck();await excluded(next);}assert.match(await q('error').textContent(),/すべてのリブ/);assert(await q('apply').isDisabled());assert.equal((await view()).ribs.length,5);await q('rib-reset').click();await ready();await q('rib-list').locator('input').nth(2).uncheck();await excluded(1);await q('wallPitch').fill('11');await ready();assert.equal((await analysis()).ribs.excluded,0);
 await q('fitLineWidth').uncheck();await ready();await q('wallThickness').fill('.4');await ready();await q('lineWidth').fill('.6');await ready();assert.match(await q('print-settings-note').textContent(),/省略される可能性/);await q('fitLineWidth').check();await ready();await q('rib-pick').click();await q('style').selectOption('posts');await ready();assert(await q('rib-pick').isHidden());await q('style').selectOption('walls');await ready();await q('wallLines').fill('1.5');assert(await q('apply').isDisabled());assert.match(await q('error').textContent(),/線数/);await q('cancel').click();assert.deepEqual((await save()).features,saved.features);assert.deepEqual(errors,[]);
 await page.locator('#features .row-label').last().click();await ready();
 const coverage=q('support-coverage'),pickZone=coverage.getByRole('button',{name:'クリックした箇所を除外'});
 await coverage.evaluate(e=>e.open=true);
 await coverage.locator('[data-coverage=face]').selectOption({index:1});
 await coverage.locator('[data-support-zone-size="0"]').fill('0.1');
 await coverage.locator('[data-support-zone-size="1"]').fill('0.2');
 await setView('0,0,1');
 await pickZone.click();
 assert.equal(await host.getAttribute('data-support-zone-picking'),'point');
 const confirm=host.getByRole('button',{name:'この範囲を確定'});
 assert(await confirm.isDisabled());
 await page.mouse.click(...await screen([20,34,50]));
 assert.match(await host.locator('.support-zone-placement [role=status]').textContent(),/選んだ下面と重なる/);
 assert(await confirm.isDisabled());
 const point=await screen([20,10,50]);
 await page.mouse.move(...point);await page.mouse.click(...point);
 assert(await confirm.isEnabled());
 assert.equal(await coverage.getByRole('button',{name:/除外 1 を解除/}).count(),0);
 await confirm.click();
 await coverage.getByRole('button',{name:/除外 1 を解除（0.1 × 0.2 mm）/}).waitFor();
 await ready();assert.equal(await host.getAttribute('data-support-zone-picking'),null);
 await q('apply').click();await page.locator('#print-support-dialog').waitFor({state:'hidden'});
 const [[x0,y0,x1,y1]]=(await save()).features.at(-1).spec.faceOverrides[0].noSupport;
 assert.ok(Math.abs(x1-x0-.1)<1e-8&&Math.abs(y1-y0-.2)<1e-8);
 assert.deepEqual(errors,[]);
 const proof={pass:true,legacyDefaults:true,lineWidthFit:true,layerCounts:true,directionAndRotate:true,markerToggle:true,nearEdgeCanvasToggle:true,smallPointExclusion:true,excludedGhost:true,unsupportedRoofBlocked:true,emptyPreviewRecovery:true,scope3mf:true,saveReload:true,undoRedo:true,geometryChangeResetsExclusions:true,thinWallWarning:true,invalidBlocked:true,cancelPreservesHistory:true,previewCleaned:true,errors};await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){console.error(await q('error').textContent().catch(()=>''),errors);await page.screenshot({path:out+'/failure.png'});throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
