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
  async function openFrame(){
    const tool=page.locator('#t-slot-frame-tool');
    if(await tool.isVisible()){await tool.click();return;}
    await page.locator('#advanced-tools').click();
    if(await page.locator('#cad-command').isVisible())await page.locator('#cad-command').selectOption('tSlotFrame');
  }
  assert.equal(await page.locator('#body-count').textContent(),'0');
  await openFrame();
  assert.equal(await page.locator('#export-title').textContent(),'T溝フレームの部品と設定');
  const standaloneLimit=page.locator('#t-slot-manual-limit'),confirm=page.locator('#export-confirm');
  assert.equal(await standaloneLimit.inputValue(),'160');assert.equal(await confirm.isDisabled(),true);
  const rows=page.locator('#t-slot-order-lines .t-slot-order-row');
  await standaloneLimit.fill('120');
  await rows.first().locator('.order-dimension input').fill('330');
  await rows.first().locator('.order-count').fill('2');
  await page.locator('#t-slot-add-line').click();
  await rows.nth(1).locator('select').selectOption('short');await rows.nth(1).locator('.order-count').fill('3');
  const manualBill=await page.locator('#export-contents').textContent();
  for(const expected of ['110 mm × 6','45 mm × 4','M8×16 ボルト × 8','M8×10 ボルト × 3','ナット（−0.10 mm調整版） × 8'])assert.ok(manualBill.includes(expected));
  await page.locator('#t-slot-add-line').click();await rows.last().getByRole('button').click();assert.equal(await rows.count(),2);
  await page.locator('#t-slot-add-line').click();await rows.last().locator('select').selectOption('panelFoot');
  const sides=page.locator('#t-slot-panel-sides'),front=page.locator('#t-slot-panel-front');
  await sides.check();
  for(const face of ['front','back','left','right'])assert.ok(await page.locator('#t-slot-panel-'+face).isChecked());
  await front.uncheck();assert.ok(await sides.evaluate(el=>el.indeterminate));
  await sides.click();await sides.uncheck();
  assert.equal(await page.locator('#t-slot-panel-bottom').isChecked(),false);
  await page.locator('#t-slot-panel-top').check();await front.check();
  for(const [i,dim] of [265,200,110].entries())await page.locator('#t-slot-opening-'+i).fill(String(dim));
  await page.locator('#t-slot-print-nozzle').selectOption('0.6');
  assert.match(await page.locator('#t-slot-filament-clear').textContent(),/ g/);
  await page.setViewportSize({width:390,height:844});
  const fits=await page.locator('#export-options').evaluate(el=>el.scrollWidth<=el.clientWidth+1);
  assert.ok(fits,'The parts order must fit a narrow dialog');
  await page.setViewportSize({width:1740,height:1060});
  const order=await download('#export-confirm'),packed=unzipSync(order.buffer),notes=strFromU8(packed['panel-assembly.txt']);
  assert.match(notes,/上面　264 × 199　2列 × 2行/);assert.match(notes,/前面　264 × 109　2列 × 1行/);
  assert.doesNotMatch(notes,/下面　264/);
  const orderedParts=new Map();
  for(const [name,bytes] of Object.entries(packed).filter(([key])=>key.endsWith('.3mf'))){
    const inner=unzipSync(bytes),xml=strFromU8(inner['3D/3dmodel.model']),ids=new Map();
    assert.deepEqual(JSON.parse(strFromU8(inner['Metadata/project_settings.config'])).nozzle_diameter,['0.6']);
    for(const [,id,part,mesh] of xml.matchAll(/<object id="(\d+)" type="model" name="([^"]+)">([\s\S]*?)<\/object>/g)){
      ids.set(id,part);
      const sheet=/^(上面 透明板|前面 透明板|透明板の継ぎ板)/.test(part);
      assert.equal(sheet,name.endsWith('-clear.3mf'));
      if(sheet){
        const zs=Array.from(mesh.matchAll(/<vertex [^>]*z="([^"]+)"/g),v=>Number(v[1]));
        assert.equal(Math.max(...zs)-Math.min(...zs),2);
      }
    }
    for(const [,id] of xml.matchAll(/<item objectid="(\d+)"/g)){
      const part=ids.get(id);orderedParts.set(part,1+(orderedParts.get(part)||0));
    }
  }
  assert.equal(orderedParts.get('T溝フレーム 110 mm'),6);
  assert.equal(orderedParts.get('2穴直線連結プレート 45 mm'),4);
  assert.equal(orderedParts.get('透明板固定治具（T足一体）'),1);
  assert.equal(orderedParts.get('透明板の継ぎ板 42 × 18 × 2 mm'),5);
  assert.equal([...orderedParts.keys()].filter(s=>s.startsWith('上面 透明板')).length,4);
  assert.equal([...orderedParts.keys()].filter(s=>s.startsWith('前面 透明板')).length,2);
  assert.equal(await page.locator('#body-count').textContent(),'0');
  await openFrame();assert.equal(await standaloneLimit.inputValue(),'120');
  await rows.first().locator('select').selectOption('backing');await rows.first().locator('.order-count').fill('2');
  assert.ok(await page.locator('#t-slot-filament-clear').isVisible());
  const strips=await download('#export-confirm');assert.match(strips.name,/-clear\.3mf$/);
  const stripXml=strFromU8(unzipSync(strips.buffer)['3D/3dmodel.model']);
  assert.equal((stripXml.match(/<item /g)||[]).length,2);assert.match(stripXml,/透明板の継ぎ板/);
  const guide={...defaults,id:'test-cube',name:'寸法確認用の基準',kind:'extrusion',width:117.25,height:245,depth:87.625};
  await load(Buffer.from(JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[guide]})));
  await page.locator('#export').click();
  assert.equal(await page.locator('#export-format').inputValue(),'stl');
  assert.equal(await page.locator('#export-options').isVisible(),false);
  await page.locator('#export-cancel').click();
  await openFrame();
  await page.locator('#t-slot-frame-dialog').waitFor();
  const cutLimit=page.locator('#t-slot-rail-limit');
  assert.equal(await cutLimit.inputValue(),'120');
  assert.match(await page.locator('#t-slot-lengths').textContent(),/81\.666667 mm × 3本/);
  await cutLimit.fill('160');
  assert.match(await page.locator('#t-slot-summary').textContent(),/フレーム 16本、固定治具 20個（内側20個・外側0個）/);
  const cutList=await page.locator('#t-slot-lengths tbody tr').allTextContents();
  assert.deepEqual(cutList,['幅117.25 mm117.25 mm × 1本','奥行き245 mm122.5 mm × 2本','支柱143.625 mm143.625 mm × 1本']);
  await page.locator('#t-slot-apply').click();
  await page.waitForFunction(()=>!document.querySelector('#t-slot-frame-dialog').open&&document.querySelector('#body-count').textContent==='3');
  const saved=await download('#save');
  const savedFrame=JSON.parse(saved.buffer).features.at(-1);
  assert.equal(savedFrame.spec.type,'tSlotFrame');assert.equal(savedFrame.spec.maxRailLength,160);
  await page.locator('#undo').click();
  await page.waitForFunction(()=>document.querySelector('#body-count').textContent==='1');
  await load(saved.buffer);
  await page.locator('#export').click();
  assert.equal(await page.locator('#export-format').inputValue(),'frame3mf');
  const bolts=page.locator('#t-slot-extra-bolts'),nuts=page.locator('#t-slot-extra-nuts');
  const shortBolts=page.getByLabel('ボルト（首下10 mm）',{exact:true});
  const total=page.locator('#t-slot-filament-total'),currentPlate=page.locator('#t-slot-filament-plate');
  const nozzle=page.locator('#t-slot-print-nozzle'),plateSelect=page.locator('#t-slot-print-plate');
  const weight=async output=>Number((await output.textContent()).match(/([\d,.]+) g/)[1].replaceAll(',',''));
  assert.equal(await nozzle.inputValue(),'0.4');assert.match(await total.textContent(),/ g（[\d,.]+ m）/);
  const baseGrams=await weight(total);
  assert.equal(await shortBolts.inputValue(),'0');assert.doesNotMatch(await page.locator('#export-contents').textContent(),/M8×10/);
  await bolts.fill('-1');assert.equal(await page.locator('#export-confirm').isDisabled(),true);
  assert.equal(await total.isVisible(),false);
  await bolts.fill('3');const withBolts=await weight(total);assert.ok(withBolts>baseGrams);
  await nuts.fill('5');assert.ok(await weight(total)>withBolts);
  const withoutShort=await weight(total);assert.ok(Math.abs(withoutShort-1172.24)<.5);
  await shortBolts.fill('1.5');assert.equal(await page.locator('#export-confirm').isDisabled(),true);
  await shortBolts.fill('4');assert.ok(Math.abs(await weight(total)-withoutShort-5.1)<.11);
  await shortBolts.fill('0');assert.equal(await weight(total),withoutShort);
  await shortBolts.fill('4');
  await page.waitForFunction(()=>!document.querySelector('#export-confirm').disabled);
  const bill=await page.locator('#export-contents').textContent();
  assert.match(bill,/M8×16 ボルト × 43/);assert.match(bill,/M8×10 ボルト × 4/);assert.match(bill,/ナット（−0.10 mm調整版） × 45/);
  assert.match(bill,/2穴直線連結プレート 45 mm × 4/);assert.match(bill,/透明板用M8めねじ） × 16/);
  assert.match(bill,/117\.25 mm × 4/);assert.match(bill,/122\.5 mm × 8/);assert.match(bill,/143\.625 mm × 4/);
  const plates=await page.locator('#t-slot-print-plate option').count();assert.ok(plates>1);
  assert.equal(await page.locator('#t-slot-total-label').textContent(),'全'+plates+'枚の合計');
  const firstAmount=await currentPlate.textContent(),allAmount=await total.textContent();
  await plateSelect.selectOption(String(plates-1));
  assert.notEqual(await currentPlate.textContent(),firstAmount);assert.equal(await total.textContent(),allAmount);
  await nuts.fill('6');assert.equal(await plateSelect.inputValue(),String(plates-1));
  await nuts.fill('5');assert.equal(await total.textContent(),allAmount);
  await nozzle.selectOption('0.6');assert.equal(await total.textContent(),allAmount);
  const archive=await download('#export-confirm');assert.match(archive.name,/\.zip$/);
  const files=Object.values(unzipSync(archive.buffer));assert.equal(files.length,plates);
  const printedRails=new Map(),fittingCounts={corner:0,splice:0},boltCounts={10:0,16:0};
  const count=files.reduce((total,data)=>{
    const entries=unzipSync(data),xml=strFromU8(entries['3D/3dmodel.model']);
    const settings=JSON.parse(strFromU8(entries['Metadata/project_settings.config']));
    assert.deepEqual(settings.nozzle_diameter,['0.6']);assert.equal(settings.layer_height,'0.18');
    assert.doesNotMatch(xml,/test-cube|寸法確認用の基準/);
    const railIds=new Map(),fittingIds=new Map(),boltIds=new Map();
    for(const object of xml.matchAll(/<object id="(\d+)" type="model" name="M8×(10|16) ボルト">([\s\S]*?)<\/object>/g)){
      const length=Number(object[2]);
      let seat=-Infinity,tip=-Infinity;
      for(const [,x,y,z] of object[3].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)){
        if(Math.hypot(Number(x),Number(y))>4.1)seat=Math.max(seat,Number(z));
        tip=Math.max(tip,Number(z));
      }
      assert.ok(Math.abs(tip-seat-length)<1e-4);boltIds.set(object[1],length);
    }
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
      const bolt=boltIds.get(item[1]);if(bolt)boltCounts[bolt]++;
    }
    return total+(xml.match(/<item /g)||[]).length;
  },0);
  assert.deepEqual(printedRails,new Map([[117.25,4],[122.5,8],[143.625,4]]));
  assert.deepEqual(fittingCounts,{corner:16,splice:4});
  assert.deepEqual(boltCounts,{10:4,16:43});
  assert.equal(count,128);assert.equal(await page.locator('#body-count').textContent(),'3');
  await page.locator('#export').click();
  await page.locator('#t-slot-panel-top').check();await sides.check();await page.locator('#t-slot-panel-bottom').check();
  const assembledBill=await page.locator('#export-contents').textContent();
  for(const label of ['上面','前面','背面','左面','右面','下面'])assert.ok(assembledBill.includes(label+' 透明板'));
  assert.match(assembledBill,/上面 透明板 116\.25 × 244 × 2 mm/);
  assert.match(assembledBill,/前面 透明板 116\.25 × 86\.625 × 2 mm/);
  assert.equal(await confirm.isEnabled(),true);await page.locator('#export-cancel').click();
  assert.deepEqual(errors,[]);console.log('PASS standalone cut orders, interlocking clear panels, saved frame limits, undo, reopen and export of '+count+' standard parts on '+plates+' plates');
}finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));}
