import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import {defaults} from '../src/geometry.js';

const root=path.resolve('dist');
const siteUrl=process.argv[2];
const server=http.createServer(async(req,res)=>{
  try{
    const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep))throw Error();
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
if(!siteUrl)await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1740,height:1060},acceptDownloads:true}),errors=[];
  page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept(d.defaultValue()));await page.addInitScript(()=>window.showSaveFilePicker=undefined);
  await page.goto(siteUrl??('http://127.0.0.1:'+server.address().port));
  // Pages redirects from the entry page to dist. Wait for the app to bind its
  // handlers before sending a file to the static file input.
  await page.locator('#t-slot-frame-tool').waitFor({state:'attached'});
  async function load(bytes){
    await page.locator('#file').setInputFiles({name:'frame-test.forma.json',mimeType:'application/json',buffer:bytes});
    await page.locator('#project-preview-open').click();
    await page.waitForFunction(()=>!document.querySelector('#project-load-preview').open);
  }
  async function download(button){
    const event=page.waitForEvent('download');await page.locator(button).click();const file=await event;
    return {name:file.suggestedFilename(),buffer:await fs.readFile(await file.path())};
  }
  const guide={...defaults,id:'test-cube',name:'寸法確認用の基準',kind:'extrusion',width:117.25,height:245,depth:87.625};
  await load(Buffer.from(JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[guide]})));
  await page.locator('#export').click();
  assert.equal(await page.locator('#export-format').inputValue(),'stl');
  assert.equal(await page.locator('#export-options').isVisible(),false);
  await page.locator('#export-cancel').click();
  await page.locator('#advanced-tools').click();
  await page.locator('#cad-command').selectOption('tSlotFrame');
  await page.locator('#t-slot-frame-dialog').waitFor();
  assert.match(await page.locator('#t-slot-summary').textContent(),/フレーム 16本、固定治具 20個（内側20個・外側0個）/);
  const cutList=await page.locator('#t-slot-lengths tbody tr').allTextContents();
  assert.deepEqual(cutList,['幅117.25 mm117.25 mm × 1本','奥行き245 mm122.5 mm × 2本','支柱143.625 mm143.625 mm × 1本']);
  await page.locator('#t-slot-apply').click();
  await page.waitForFunction(()=>!document.querySelector('#t-slot-frame-dialog').open&&document.querySelector('#body-count').textContent==='3');
  const saved=await download('#save');
  assert.equal(JSON.parse(saved.buffer).features.at(-1).spec.type,'tSlotFrame');
  await page.locator('#undo').click();
  await page.waitForFunction(()=>document.querySelector('#body-count').textContent==='1');
  await load(saved.buffer);
  await page.locator('#export').click();
  assert.equal(await page.locator('#export-format').inputValue(),'frame3mf');
  const bolts=page.locator('#t-slot-extra-bolts'),nuts=page.locator('#t-slot-extra-nuts');
  const total=page.locator('#t-slot-filament-total'),currentPlate=page.locator('#t-slot-filament-plate');
  const nozzle=page.locator('#t-slot-print-nozzle'),plateSelect=page.locator('#t-slot-print-plate');
  const weight=async output=>Number((await output.textContent()).match(/([\d,.]+) g/)[1].replaceAll(',',''));
  assert.equal(await nozzle.inputValue(),'0.4');assert.match(await total.textContent(),/ g（[\d,.]+ m）/);
  const baseGrams=await weight(total);
  await bolts.fill('-1');assert.equal(await page.locator('#export-confirm').isDisabled(),true);
  assert.equal(await total.isVisible(),false);
  await bolts.fill('3');const withBolts=await weight(total);assert.ok(withBolts>baseGrams);
  await nuts.fill('5');assert.ok(await weight(total)>withBolts);
  await page.waitForFunction(()=>!document.querySelector('#export-confirm').disabled);
  const bill=await page.locator('#export-contents').textContent();
  assert.match(bill,/M8×16 ボルト × 43/);assert.match(bill,/ナット（−0.10 mm調整版） × 45/);
  assert.match(bill,/2穴直線連結プレート 45 mm × 4/);assert.match(bill,/透明板用M8めねじ） × 16/);
  assert.match(bill,/117\.25 mm × 4/);assert.match(bill,/122\.5 mm × 8/);assert.match(bill,/143\.625 mm × 4/);
  const plates=await page.locator('#t-slot-print-plate option').count();assert.ok(plates>1);
  assert.equal(await page.locator('#t-slot-total-label').textContent(),'全'+plates+'枚の合計');
  assert.ok(Math.abs(await weight(total)-1172.24)<.5);
  const firstAmount=await currentPlate.textContent(),allAmount=await total.textContent();
  await plateSelect.selectOption(String(plates-1));
  assert.notEqual(await currentPlate.textContent(),firstAmount);assert.equal(await total.textContent(),allAmount);
  await nuts.fill('6');assert.equal(await plateSelect.inputValue(),String(plates-1));
  await nuts.fill('5');assert.equal(await total.textContent(),allAmount);
  await nozzle.selectOption('0.6');assert.equal(await total.textContent(),allAmount);
  const archive=await download('#export-confirm');assert.match(archive.name,/\.zip$/);
  const files=Object.values(unzipSync(archive.buffer));assert.equal(files.length,plates);
  const printedRails=new Map(),fittingCounts={corner:0,splice:0};
  const count=files.reduce((total,data)=>{
    const entries=unzipSync(data),xml=strFromU8(entries['3D/3dmodel.model']);
    const settings=JSON.parse(strFromU8(entries['Metadata/project_settings.config']));
    assert.deepEqual(settings.nozzle_diameter,['0.6']);assert.equal(settings.layer_height,'0.18');
    assert.doesNotMatch(xml,/test-cube|寸法確認用の基準/);
    const railIds=new Map(),fittingIds=new Map();
    for(const object of xml.matchAll(/<object id="(\d+)" type="model" name="T溝フレーム ([\d.]+) mm">([\s\S]*?)<\/object>/g)){
      const heights=Array.from(object[3].matchAll(/<vertex [^>]*z="([^"]+)"/g),v=>Number(v[1]));
      const length=Math.max(...heights)-Math.min(...heights);
      assert.equal(length,Number(object[2]));railIds.set(object[1],length);
    }
    for(const object of xml.matchAll(/<object id="(\d+)" type="model" name="(直角連結ブラケット（透明板用M8めねじ）|2穴直線連結プレート 45 mm)">([\s\S]*?)<\/object>/g)){
      const points=Array.from(object[3].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g),v=>v.slice(1).map(Number));
      const kind=object[2].startsWith('2穴')?'splice':'corner';
      if(kind==='splice'){
        assert.equal(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),45);
        assert.equal(Math.max(...points.map(p=>p[2])),9.5);
      }else{
        const thread=points.filter(([x,y,z])=>z>2&&z<7&&Math.hypot(x-14,y-14)<4.25);
        assert.ok(thread.length>100&&thread.some(([x,y])=>Math.hypot(x-14,y-14)<3.55));
      }
      fittingIds.set(object[1],kind);
    }
    for(const item of xml.matchAll(/<item objectid="(\d+)"/g)){
      const length=railIds.get(item[1]);if(length!==undefined)printedRails.set(length,(printedRails.get(length)||0)+1);
      const kind=fittingIds.get(item[1]);if(kind)fittingCounts[kind]++;
    }
    return total+(xml.match(/<item /g)||[]).length;
  },0);
  assert.deepEqual(printedRails,new Map([[117.25,4],[122.5,8],[143.625,4]]));
  assert.deepEqual(fittingCounts,{corner:16,splice:4});
  assert.equal(count,124);assert.equal(await page.locator('#body-count').textContent(),'3');
  assert.deepEqual(errors,[]);console.log('PASS create, undo, reopen, independent extras and export of '+count+' parts on '+plates+' plates');
}finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));}
