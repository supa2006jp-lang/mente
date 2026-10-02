import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults} from '../src/geometry.js';

// A holed plate accepts one solid face extrusion, then a thin extrusion
// from the newly exposed top face of the same body.
const features=[
 {...defaults,id:'plate-sketch',name:'Plate sketch',kind:'sketch',profile:'rect',width:30,height:30,x:15,y:15},
 {...defaults,id:'plate',name:'Plate',kind:'extrusion',profile:'region',depth:2,region:{id:'plate-region',plane:'XY',offset:0,outer:[[0,0],[30,0],[30,30],[0,30]],holes:[],area:900,sourceIds:['plate-sketch']}},
 {...defaults,id:'hole',name:'Hole Ø10',kind:'extrusion',profile:'circle',plane:'CUSTOM',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},operation:'cut',target:'plate',diameter:10,x:15,y:15,z:2,depth:-20,hole:true}
];
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
page.setDefaultTimeout(10000);
page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
async function extrude(mode){
 await page.locator(mode==='solid'?'#solid-tool':'#thin-tool').click();
 await page.locator('#viewport-depth').fill('2');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#operation').inputValue(),'join');
 await page.locator('#extrude-distance button[type=submit]').click();
 await page.waitForFunction(()=>{const status=document.getElementById('status').textContent,error=document.getElementById('viewport-depth-error').textContent;return !status.includes('計算中')||!!error&&!error.includes('計算中');},null,{timeout:10000});
 const error=await page.locator('#viewport-depth-error').textContent();
 const status=await page.locator('#status').textContent();
 console.log(mode,{error,status});
 assert.equal(error,'');
 assert.match(status,/確定しました/);
}
try{
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'hole-face.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await page.locator('#selection-mode').selectOption('face');
 const rect=await page.locator('canvas').boundingBox();
 const facePoint={x:rect.x+rect.width/2+110,y:rect.y+rect.height/2};
 await page.mouse.click(facePoint.x,facePoint.y);
 assert.match(await page.locator('#selection-summary').textContent(),/面 1 枚/);
 await extrude('solid');
 if(!/面 1 枚/.test(await page.locator('#selection-summary').textContent()))await page.mouse.click(facePoint.x,facePoint.y);
 assert.match(await page.locator('#selection-summary').textContent(),/面 1 枚/);
 await extrude('thin');
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 assert.equal(saved.features.length,5);
 const final=saved.features.at(-1);
 assert.equal(final.mode,'thin');
 assert.equal(final.operation,'join');
 assert.equal(final.cadResult.outputs.length,1);
 R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const solid=R.deserializeShape(final.cadResult.outputs[0].brep).asShape3D();
 try{
  const check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false);
  try{assert.ok(check.IsValid(),'saved BRep is valid');}finally{check.delete();}
  const solids=solid.solids;
  try{assert.equal(solids.length,1,'the final body stays connected');}finally{for(const part of solids)part.delete();}
  const expected=4*(900-Math.PI*25)+2*((900-26*26)+Math.PI*(7*7-5*5));
  assert.ok(Math.abs(R.measureVolume(solid)-expected)<.01,`final volume ${R.measureVolume(solid)} vs ${expected}`);
 }finally{solid.delete();}
 assert.deepEqual(pageErrors,[]);
 console.log('PASS sequential thin face extrusion from holed plate creates one valid BRep solid');
}finally{await browser.close();}
