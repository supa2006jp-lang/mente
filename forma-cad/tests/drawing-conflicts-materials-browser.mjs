import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {drawingSignature} from '../src/drawing-state.js';
import {drawingMaterialsKey} from '../src/drawing-materials.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const block=R.makeBox([0,0,0],[50,50,20]),shape=block.fillet(2,f=>f.inDirection('Z'));
const project={
 format:'forma-cad',version:1,
 features:[{kind:'cadop',id:'part',name:'R2 試験片',remove:[],
  outputs:[{id:'part',brep:shape.serialize(),...shape.mesh({tolerance:.1,angularTolerance:.2})}]}],
};
shape.delete();block.delete();
const drawing={
 version:1,signature:drawingSignature(project.features),targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',
 dimensions:[
  {view:'top',kind:'horizontal',a:[0,0],b:[50,0],at:[25,8],overall:'tophorizontal',pinned:true},
  {view:'top',kind:'radius',center:[48,-2],radius:2,arcPoint:[48+Math.SQRT2,-2+Math.SQRT2],at:[50.5,7.6],automatic:true},
 ],
 options:{name:'R2 試験片',material:'',date:'',paper:'A4',orientation:'landscape',frame:true,layout:'compact',
  viewSelection:['top'],isoMode:'hidden',positions:{top:[40,30]}},
};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const file=path.resolve('dist','.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(path.resolve('dist')+path.sep))throw Error();
  const contents=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(contents);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];
 page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(error.message));
 const field=id=>page.locator('#drawing-'+id);
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#canvas-host canvas').waitFor();
 async function open(name,document){
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(()=>!window.document.getElementById('project-load-preview').open);
  await field('tool').evaluate(button=>button.click());
  await field('preview').locator('svg').waitFor();
 }
 await open('r2-collision.forma.json',{...project,drawing});
 const section=field('conflicts'),row=index=>section.locator('[data-dimension-conflict="'+index+'"]');
 const label=index=>field('preview').locator('[data-dimension="'+index+'"] text');
 const initially=await label(1).getAttribute('x'),fixed=await label(0).getAttribute('y');
 await section.locator('summary').click();
 assert.match(await row(1).textContent(),/R2.*文字と矢印/);
 assert(await row(0).getByRole('button',{name:'この寸法だけ再配置'}).isDisabled());
 await row(1).getByRole('button',{name:/文字と矢印/}).click();
 assert.notEqual(await field('zoom-percent').textContent(),'100%');
 assert.equal(await field('preview').locator('[data-focused-conflict]').count(),1);
 await row(1).getByRole('button',{name:'この寸法だけ再配置'}).click();
 assert(await section.isHidden());
 assert.notEqual(await label(1).getAttribute('x'),initially);
 assert.equal(await label(0).getAttribute('y'),fixed);
 await field('undo').click();
 assert.equal(await label(1).getAttribute('x'),initially);
 assert(await section.isVisible());
 await field('redo').click();
 assert(await section.isHidden());

 const material='SUS304 2B（研磨）',select=field('material-preset'),input=field('material');
 await input.fill(material);
 await field('material-save').click();
 assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),drawingMaterialsKey),[material]);
 assert.equal(await select.inputValue(),material);
 assert(await field('material-save').isDisabled());
 await field('close').click();
 await open('another.forma.json',project);
 assert.equal(await input.inputValue(),'');
 await select.selectOption(material);
 assert.equal(await input.inputValue(),material);
 assert.match(await field('preview').locator('[data-titleblock]').textContent(),/SUS304 2B（研磨）/);
 await field('material-remove').click();
 assert.equal(await select.locator('option').filter({hasText:material}).count(),0);
 assert.equal(await input.inputValue(),material);
 await select.selectOption('SUS304');
 assert.equal(await input.inputValue(),'SUS304');
 assert.deepEqual(errors,[]);
 console.log('PASS collision detection, zoom, single-dimension placement/undo, and material library across drawings');
}finally{await browser?.close();server.close();}
