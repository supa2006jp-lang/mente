import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';

// Run with FORMA_MODEL pointing to the user's four-feature saved design.
const path=process.env.FORMA_MODEL;
if(!path)throw Error('Set FORMA_MODEL to the saved four-feature .forma.json file');
const file=await fs.readFile(path),model=JSON.parse(file.toString('utf8'));
assert.equal(model.features.length,4,'expected plate, hole, and first solid extrusion');
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const original=R.deserializeShape(model.features.at(-1).cadResult.outputs[0].brep).asShape3D();
const startingVolume=R.measureVolume(original);
original.delete();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
page.setDefaultTimeout(10000);
page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
try{
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'design.forma.json',mimeType:'application/json',buffer:file});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await page.locator('#selection-mode').selectOption('face');
 const rect=await page.locator('canvas').boundingBox();
 await page.mouse.click(rect.x+rect.width/2+110,rect.y+rect.height/2);
 assert.match(await page.locator('#selection-summary').textContent(),/面 1 枚/);
 await page.locator('#thin-tool').click();
 await page.locator('#viewport-depth').fill('2');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#operation').inputValue(),'join');
 assert.equal(await page.locator('#canvas-host').getAttribute('data-preview-kind'),'extrusion');
 assert.equal(await page.locator('#viewport-depth-error').textContent(),'');
 await page.locator('#extrude-distance button[type=submit]').click();
 await page.waitForFunction(()=>{const status=document.getElementById('status').textContent,error=document.getElementById('viewport-depth-error').textContent;return !status.includes('計算中')||!!error&&!error.includes('計算中');},null,{timeout:10000});
 const error=await page.locator('#viewport-depth-error').textContent();
 const status=await page.locator('#status').textContent();
 assert.equal(error,'');
 assert.match(status,/確定しました/);
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 assert.equal(saved.features.length,5);
 const final=saved.features.at(-1);
 assert.equal(final.mode,'thin');
 assert.equal(final.operation,'join');
 assert.equal(final.wall,2);
 assert.equal(final.depth,2);
 assert.equal(final.cadResult.outputs.length,1);
 const solid=R.deserializeShape(final.cadResult.outputs[0].brep).asShape3D();
 try{
  const check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false);
  try{assert.ok(check.IsValid(),'saved BRep is valid');}finally{check.delete();}
  const solids=solid.solids;
  try{assert.equal(solids.length,1,'the final body stays connected');}finally{for(const part of solids)part.delete();}
  const expected=startingVolume+2*((900-26*26)+Math.PI*(7*7-5*5));
  assert.ok(Math.abs(R.measureVolume(solid)-expected)<.01,`final volume ${R.measureVolume(solid)} vs ${expected}`);
 }finally{solid.delete();}
 assert.deepEqual(pageErrors,[]);
 console.log('PASS user saved design thin extrusion: preview, confirm, one valid BRep solid, expected volume');
}finally{await browser.close();}
