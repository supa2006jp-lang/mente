import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {featureSolid,runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const f=(id,points,arc=false)=>({...defaults,id,name:id,kind:'sketch',profile:'polyline',points,closed:false,...(arc?{arc:{endTangent:[1,0]}}:{})}),sketches=[f('bottom',[[-30,-20],[30,-20]]),f('right',Array.from({length:65},(_,i)=>[30+20*Math.cos(-Math.PI/2+i*Math.PI/64),20*Math.sin(-Math.PI/2+i*Math.PI/64)]),true),f('top',[[30,20],[-30,20]]),f('left',Array.from({length:65},(_,i)=>[-30+20*Math.cos(Math.PI/2+i*Math.PI/64),20*Math.sin(Math.PI/2+i*Math.PI/64)]),true)],feature={...defaults,id:'body',name:'カプセル',kind:'extrusion',profile:'region',region:findRegions(sketches)[0],depth:50},legacy=featureSolid(feature),history=[...sketches,{...feature,cadResult:{outputs:[{id:'body',brep:legacy.serialize(),...legacy.mesh()}],remove:[]}}];legacy.delete();
const spec={type:'shell',target:'body',id:'shell',thickness:2,direction:'内側',faces:[{bodyId:'body',point:[0,0,50],normal:[0,0,1]}]},result=runOperation(history,spec),project={format:'forma-cad',version:1,features:[...history,{kind:'cadop',id:'shell',name:'シェル',spec,...result}]};
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'},server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{
  window.arcFilletJobs=[];window.arcFilletTrials=0;const Base=Worker,post=Base.prototype.postMessage;
  window.Worker=new Proxy(Base,{construct(Target,args){const worker=Reflect.construct(Target,args);worker.addEventListener('message',({data})=>{if(data.progress?.filletTrial==='start')window.arcFilletTrials++;});return worker;}});
  Base.prototype.postMessage=function(payload,...args){if(payload.spec?.type==='fillet'||payload.spec?.operation?.type==='fillet')window.arcFilletJobs.push(payload.spec);return post.call(this,payload,...args);};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#canvas-host canvas').waitFor();
 await page.locator('#file').setInputFiles({name:'legacy-capsule.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('fillet');await page.locator('#cad-radius').fill('0.5');
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.machiningPreview==='fillet'&&document.getElementById('cad-radius').value==='0.5',null,{timeout:30000});
 assert.match(await page.locator('#cad-error').textContent(),/元のスケッチの円弧を復元しました/);assert.doesNotMatch(await page.locator('#cad-error').textContent(),/一部のみ適用可能/);assert.equal(await page.evaluate(()=>window.arcFilletTrials),0,'R0.5 must round the whole restored shell without any speculative edge scan');
 const jobs=await page.evaluate(()=>window.arcFilletJobs.length);await page.screenshot({path:'.sites-runtime/native-arc-fillet-preview.png'});
 await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'true');assert.equal(await page.evaluate(()=>window.arcFilletJobs.length),jobs);
 const save=async()=>{const download=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await download).path(),'utf8'));};
 const saved=await save(),last=saved.features.at(-1);assert.equal(last.spec.radius,.5);assert.equal(last.spec.partialMode,undefined);assert.equal(last.analysis.partialFillet,undefined);assert.equal(last.analysis.fillets[0].edges,16);assert.equal(last.analysis.fillets[0].arcRecovery.beforeFaces,263);assert.equal(last.analysis.fillets[0].arcRecovery.afterFaces,11);assert.ok(!JSON.stringify(saved).includes('_nativeArcSources'));
 const old=R.deserializeShape(saved.features.at(-2).outputs[0].brep).asShape3D(),rounded=R.deserializeShape(last.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(rounded.wrapped,true,false);try{assert.ok(check.IsValid());const oldFaces=old.faces,newFaces=rounded.faces;try{assert.equal(oldFaces.length,263);assert.ok(newFaces.length<80);}finally{[...oldFaces,...newFaces].forEach(face=>face.delete());}}finally{check.delete();old.delete();rounded.delete();}
 await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.type,'shell');await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.type,'fillet');assert.equal(await page.evaluate(()=>window.arcFilletJobs.length),jobs);
 assert.deepEqual(errors,[]);const proof={beforeFaces:263,recoveredFaces:11,radius:.5,edges:16,scanTrials:0,filletJobs:jobs,cacheApplied:true,undoRedo:true,errors};console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/native-arc-fillet-browser-proof.json',JSON.stringify(proof,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
