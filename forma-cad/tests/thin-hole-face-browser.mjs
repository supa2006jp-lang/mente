import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults} from '../src/geometry.js';

const features=[
 {...defaults,id:'plate-sketch',name:'Plate sketch',kind:'sketch',profile:'rect',width:30,height:30,x:15,y:15},
 {...defaults,id:'plate',name:'Plate',kind:'extrusion',profile:'region',depth:2,region:{id:'plate-region',plane:'XY',offset:0,outer:[[0,0],[30,0],[30,30],[0,30]],holes:[],area:900,sourceIds:['plate-sketch']}},
 {...defaults,id:'hole',name:'Hole Ø10',kind:'extrusion',profile:'circle',plane:'CUSTOM',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},operation:'cut',target:'plate',diameter:10,x:15,y:15,z:2,depth:-20,hole:true}
];
const model=process.env.FORMA_MODEL?readFileSync(process.env.FORMA_MODEL):Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}));
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
 for(const mode of (process.argv[2]?[process.argv[2]]:['solid','thin']))for(const depth of (process.argv[3]?[Number(process.argv[3])]:[2,-2])){
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(`${mode}/${depth}: ${error.message}`));
  try{
   await page.goto('http://127.0.0.1:5188');
   await page.locator('#file').setInputFiles({name:'hole-face.json',mimeType:'application/json',buffer:model});
   await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
   await page.locator('[data-view=top]').click();
   await page.locator('#fit').click();
   await page.locator('#selection-mode').selectOption('face');
   const rect=await page.locator('canvas').boundingBox();
   await page.mouse.click(rect.x+rect.width/2+110,rect.y+rect.height/2);
   const selection=await page.locator('#selection-summary').textContent();
   assert.match(selection,/面 1 枚/);
   await page.locator(mode==='solid'?'#solid-tool':'#thin-tool').click();
   await page.locator('#viewport-depth').fill(String(depth));
   if(process.argv[4])await page.locator('#viewport-operation').selectOption(process.argv[4]);
   await page.waitForTimeout(250);
   const operation=await page.locator('#operation').inputValue();
   const selectedDepth=Number(await page.locator('#depth').inputValue());
   console.log('before',mode,depth,{selection,operation,selectedDepth,preview:await page.locator('#canvas-host').getAttribute('data-preview-kind'),error:await page.locator('#error').textContent()});
   const begin=Date.now();
   await page.locator('#extrude-distance button[type=submit]').click();
   await page.waitForFunction(()=>{const status=document.getElementById('status').textContent,error=document.getElementById('viewport-depth-error').textContent;return !status.includes('計算中')||!!error&&!error.includes('計算中');},null,{timeout:10000});
   const elapsed=Date.now()-begin,status=await page.locator('#status').textContent(),error=await page.locator('#viewport-depth-error').textContent();
   console.log('after',mode,depth,{elapsed,status,error,formError:await page.locator('#error').textContent(),responsive:await page.evaluate(()=>document.readyState)});
   assert.equal(error,'');
   assert.equal(operation,depth>0?'join':'cut');
   assert.match(status,/確定しました|更新しました|作成しました/);
   assert.ok(elapsed<5000,`extrusion took ${elapsed}ms`);
  }catch(error){
   console.error('FAIL',mode,depth,error.message);
   errors.push(`${mode}/${depth}: ${error.message}`);
  }finally{await page.close({runBeforeUnload:false}).catch(()=>{});}
 }
 assert.deepEqual(errors,[]);
 console.log('PASS hole-faced top surface extrudes outward and inward in solid and thin modes');
}finally{await browser.close();}