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
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 const R=await import('replicad'),init=(await import('../node_modules/replicad-opencascadejs/dist/replicad_single.js')).default;
 R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 let project;
 if(process.env.FORMA_SHELL_MODEL)project=JSON.parse(await fs.readFile(process.env.FORMA_SHELL_MODEL,'utf8'));
 else{
  const {defaults}=await import('../src/geometry.js'),{runOperation}=await import('../src/kernel.js');
  const base={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:40,depth:40};
  const spec={type:'svgWrap',id:'w',target:'c',surfacePoint:[20,0,20],pattern:[{outer:[[.1,.2],[.108,.2],[.108,.8],[.1,.8]],holes:[]}],height:30,offset:5,depth:.6,seam:'repeat',repeatCount:2,angle:0,operation:'emboss'};
  project={format:'forma-cad',version:1,features:[base,{kind:'cadop',id:'w',name:'SVG模様',spec,...runOperation([base],spec)}]};
 }
 const source=project.features.find(f=>f.kind==='extrusion'),radius=source.profile==='circle'?source.diameter/2:30,height=source.depth,target=project.features.findLast(f=>f.spec?.type==='svgWrap').spec.target;
 async function load(model){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(model))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(200);}
 async function save(){const wait=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await wait).path(),'utf8'));}
 const thickness=Number(process.env.FORMA_SHELL_THICKNESS||2);
 const before=R.deserializeShape(project.features.at(-1).outputs[0].brep).asShape3D(),beforeVolume=R.measureVolume(before);before.delete();
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push({type:payload.spec.type,operation:payload.spec.operation?.type,start:payload.spec.start});return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();await load(project);
 await page.locator('#selection-mode').selectOption('face');const bounds=await page.locator('canvas').boundingBox();await page.mouse.click(bounds.x+bounds.width/2+30,bounds.y+bounds.height/2+20);
 await page.locator('#shell-tool').click();await page.locator('#cad-thickness').fill(String(thickness));await page.locator('#cad-direction').selectOption('内側');
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='shell',null,{timeout:45000});
 assert.equal(await page.locator('#canvas-host').getAttribute('data-removed-preview-count'),'1');assert.doesNotMatch(await page.locator('#cad-error').textContent(),/長引|失敗/);
 const initialJobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#cad-apply').click();
 try{await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:90000});}catch(e){console.log('SHELL_ERROR',await page.locator('#cad-error').textContent());throw e;}
 assert.equal(await page.evaluate(()=>window.cadJobs.length),initialJobs,'confirming an unchanged preview does not run another CAD job');assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'true');
 const saved=await save(),last=saved.features.at(-1);assert.equal(last.spec.type,'shell');assert.equal(last.spec.target,target);assert.equal(last.spec.thickness,thickness);assert.equal(await page.locator('#body-count').textContent(),'1');
 const solid=R.deserializeShape(last.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false),parts=solid.solids;
 try{assert.ok(check.IsValid());assert.equal(parts.length,1);assert.ok(Math.abs(R.measureVolume(solid)-(beforeVolume-Math.PI*(radius-thickness)**2*(height-thickness)))<.03);}finally{check.delete();parts.forEach(p=>p.delete());solid.delete();}
 await page.locator('[data-view=iso]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(200);await page.screenshot({path:'.sites-runtime/shell-svg-result.png'});
 await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.type,'svgWrap');await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.type,'shell');
 await load(saved);assert.equal((await save()).features.at(-1).spec.type,'shell');assert.deepEqual(errors,[]);
 
 // Re-edit the existing shell after reopening: same feature ID and no duplicate shell.
 await page.locator('#features .row-label').filter({hasText:/シェル/}).last().click();assert.equal(await page.locator('#cad-command').inputValue(),'shell');assert.ok(await page.locator('#cad-target').isDisabled());
 await page.locator('#cad-thickness').fill('1.5');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='shell',null,{timeout:45000});
 const editJobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);
 assert.equal(await page.evaluate(()=>window.cadJobs.length),editJobs,'edited shell reuses the exact preview');
 const edited=await save();assert.equal(edited.features.length,saved.features.length);assert.equal(edited.features.at(-1).id,last.id);assert.equal(edited.features.at(-1).spec.thickness,1.5);
 const editedShape=R.deserializeShape(edited.features.at(-1).outputs[0].brep).asShape3D();assert.ok(Math.abs(R.measureVolume(editedShape)-(beforeVolume-Math.PI*(radius-1.5)**2*(height-1.5)))<.03);editedShape.delete();
 await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.thickness,thickness);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.thickness,1.5);
 // A failed re-edit must keep the previous geometry and parameters.
 await page.locator('#features .row-label').filter({hasText:/シェル/}).last().click();await page.locator('#cad-thickness').fill('1001');await page.locator('#cad-apply').click();await page.waitForFunction(()=>document.getElementById('cad-error').textContent.includes('工程目'),null,{timeout:45000});await page.locator('#cad-cancel').click();assert.equal((await save()).features.at(-1).outputs[0].brep,edited.features.at(-1).outputs[0].brep);
 // Cached edits still replay later operations from the updated shell.
 const {runOperation}=await import('../src/kernel.js'),moveSpec={type:'move',id:'later-move',target,axis:'Z',angle:0,x:10,y:0,z:0};
 const moved={...edited,features:[...edited.features,{kind:'cadop',id:moveSpec.id,name:'移動',spec:moveSpec,...runOperation(edited.features,moveSpec)}]};await load(moved);
 await page.locator('#features .row-label').filter({hasText:/シェル/}).last().click();await page.locator('#cad-thickness').fill('3');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='shell',null,{timeout:45000});const replayJobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:90000});
 const afterMove=await save();assert.equal(afterMove.features.length,moved.features.length);assert.equal(afterMove.features.at(-2).spec.thickness,3);assert.equal(afterMove.features.at(-1).id,moveSpec.id);assert.deepEqual(await page.evaluate(n=>window.cadJobs.slice(n).map(({type,start})=>({type,start})),replayJobs),[{type:'replay',start:moved.features.length-1}]);
 const movedShape=R.deserializeShape(afterMove.features.at(-1).outputs[0].brep).asShape3D();assert.ok(Math.abs(R.measureVolume(movedShape)-(beforeVolume-Math.PI*(radius-3)**2*(height-3)))<.03);const boundsAfter=movedShape.boundingBox;assert.ok(boundsAfter.bounds[1][0]>radius+9);boundsAfter.delete();movedShape.delete();
 // Display warnings never change model data, and the nozzle can be adjusted.
 await load(edited);const originalBrep=edited.features.at(-1).outputs[0].brep;await page.locator('#print-quality-toggle').click();assert.equal(await page.locator('#print-quality-nozzle').inputValue(),'0.6');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.printQuality==='true');
 const red=Number(await page.locator('#canvas-host').getAttribute('data-print-quality-critical')),yellow=Number(await page.locator('#canvas-host').getAttribute('data-print-quality-warnings'));assert.ok(red+yellow>0);assert.equal((await save()).features.at(-1).outputs[0].brep,originalBrep);
 await page.locator('[data-view=iso]').dispatchEvent('click');await page.waitForTimeout(200);await page.screenshot({path:'.sites-runtime/print-quality-result.png'});
 await page.locator('#print-quality-nozzle').fill('0.4');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.printQuality==='true');assert.ok(Number(await page.locator('#canvas-host').getAttribute('data-print-quality-critical'))<=red);
 await page.setViewportSize({width:1000,height:720});await page.waitForTimeout(150);const panelBounds=await page.locator('#print-quality-panel').boundingBox(),containerBounds=await page.locator('#canvas-host').evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom};});assert.ok(panelBounds.x>=containerBounds.x-1&&panelBounds.y>=containerBounds.y-1&&panelBounds.x+panelBounds.width<=containerBounds.right+1&&panelBounds.y+panelBounds.height<=containerBounds.bottom+1,'print panel stays inside a small viewport');
 await page.locator('#print-quality-clear').click();assert.equal(await page.locator('#canvas-host').getAttribute('data-print-quality'),null);await page.locator('#print-quality-close').click();
 assert.deepEqual(errors,[]);console.log('PASS shell re-edit, exact preview reuse, undo/redo, atomic failure, later move replay, real motif highlights, nozzle change, restore color and unchanged saved geometry');

 console.log('PASS browser SVG relief -> waited for removal preview -> shell, valid cavity, saved BRep, undo/redo and reopen');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
