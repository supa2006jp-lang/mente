import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {defaults} from '../src/geometry.js';
import {drawingSignature} from '../src/drawing-state.js';
import {runOperation} from '../src/kernel.js';
import {findRegions} from '../src/regions.js';
import {supportHistoryFeature} from '../src/print-support-batch.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const format={format:'forma-cad',version:1,units:'mm'};
const sketch={...defaults,id:'exterior',name:'板の輪郭',kind:'sketch',groupId:'sketch-group',groupNumber:1,
 width:30,height:22,x:22,y:15,z:3,dimensionLinks:{width:'板幅'}};
const push={...defaults,id:'part',name:'ブラケット',kind:'extrusion',profile:'region',depth:9,z:3,
 sourceSketchIds:[sketch.id],region:findRegions([sketch])[0]};
const bore={...defaults,id:'bore',kind:'extrusion',name:'穴あけ',profile:'circle',diameter:4,operation:'cut',
 target:'part',x:22,y:15,z:3,depth:9,hole:true,dimensionLinks:{diameter:'穴径'}};
function extrusion(before,feature){
 return {...feature,cadResult:runOperation(before,{type:'extrusion',target:feature.target,feature})};
}
const pushed=extrusion([sketch],push);
const source={...format,features:[sketch,pushed,extrusion([sketch,pushed],bore)],namedDimensions:{板幅:30,穴径:4}};
const host={...format,features:[{...defaults,id:'host-part',name:'貼り付け先の部品',kind:'extrusion',x:-70,depth:5}],namedDimensions:{板幅:60,穴径:8}};

const printFeatures=[];
for(const [id,x] of [['body-a',0],['body-b',35]]){
 const shape=R.makeBox([x,0,12],[x+18,18,15]);
 try{printFeatures.push({kind:'cadop',name:id,id,outputs:[{id,...cadMesh(shape),cadCoordinatePrecision:true,brep:shape.serialize()}],remove:[]});}
 finally{shape.delete();}
}
for(const [id,target] of [['ribs-a','body-a'],['ribs-b','body-b']]){
 const spec={id,type:'printSupport',target,style:'walls',mode:'auto',baseMode:'bed',wallPitch:8,layerHeight:.3,topGap:.3};
 const result=runOperation(printFeatures,{...spec,preview:true});
 assert.equal(result.supportPreview.exportStatus.ok,true);
 printFeatures.push(supportHistoryFeature(spec,result));
}
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const request=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(request==='/'?'/index.html':decodeURIComponent(request)));
  if(!file.startsWith(root+path.sep))throw Error('Path outside dist');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,page;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1750,height:1300},acceptDownloads:true});
 page.setDefaultTimeout(40000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 const $=id=>page.locator('#'+id),library=$('selection-library-dialog'),paste=$('selection-paste-panel');
 const selection=key=>library.locator('[data-'+key+']');
 const drawing=id=>$('drawing-'+id),out=id=>$('export-'+id);
 async function load(value){
  await $('file').setInputFiles({name:'selection-print-set.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await $('project-preview-open').click();
  await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
 }
 async function download(button){
  const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return {name:file.suggestedFilename(),bytes:await fs.readFile(await file.path())};
 }
 const save=async()=>JSON.parse((await download($('save'))).bytes);
 async function setDimension(name,value){
  await $('named-dimensions-open').click();
  const dialog=$('named-dimensions-dialog'),labels=dialog.getByRole('textbox',{name:'寸法名',exact:true});
  for(let i=0;i<await labels.count();i++){
   if(await labels.nth(i).inputValue()!==name)continue;
   await labels.nth(i).locator('..').getByRole('spinbutton').fill(String(value));
   await dialog.getByRole('button',{name:'適用',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   return;
  }
  throw Error('Missing imported dimension: '+name);
 }
 async function openPrintSet(){
  await $('export').click();
  await out('format').selectOption('printSet');
  await out('confirm').click();
  await page.waitForFunction(()=>document.getElementById('export-title').textContent==='図面と印刷データの出力');
  await out('target').selectOption({label:'表示中のリブをまとめる（2件）'});
  await page.waitForFunction(()=>!document.getElementById('export-confirm').disabled);
 }
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await $('canvas-host').locator('canvas').waitFor();
 await load(source);
 await page.locator('#bodies [data-body-id="part"] .row-label').click();
 await $('selection-library-open').click();
 await library.locator('[data-kind="solid"]').click();
 await selection('history').check();
 await selection('name').fill('履歴付きブラケット');
 await selection('save').click();
 await library.locator('article').waitFor();
 assert.match(await library.locator('article p').textContent(),/編集履歴 3 工程/);
 const savedPart=await download(library.locator('article').getByRole('button',{name:'ファイル保存',exact:true}));
 const part=JSON.parse(savedPart.bytes);
 assert.equal(savedPart.name,'履歴付きブラケット.forma-solid.json');
 assert.deepEqual(part.history.features.map(f=>f.id),['exterior','part','bore']);
 await selection('close').click();

 await load(host);
 const original=await save();
 await $('selection-library-open').click();
 await library.locator('[data-kind="solid"]').click();
 await library.locator('article').getByRole('button',{name:'呼び出して配置',exact:true}).click();
 await paste.waitFor();
 assert.match(await paste.locator('[data-info]').textContent(),/編集履歴 3 工程/);
 const beforePlacement=await save();
 assert.deepEqual(beforePlacement.features,original.features);
 assert.deepEqual(beforePlacement.namedDimensions,original.namedDimensions);
 await paste.locator('[data-position="0"]').fill('100');
 await paste.locator('[data-apply]').click();
 await paste.waitFor({state:'hidden'});
 const inserted=await save();
 assert.equal(inserted.features.length,5);
 const [importedSketch,importedPush,importedHole,placement]=inserted.features.slice(1);
 assert.equal(importedSketch.kind,'sketch');
 assert.equal(importedSketch.dimensionLinks.width,'板幅_2');
 assert.deepEqual(importedPush.sourceSketchIds,[importedSketch.id]);
 assert.equal(importedHole.target,importedPush.id);
 assert.equal(importedHole.dimensionLinks.diameter,'穴径_2');
 assert.equal(placement.spec.type,'move');
 await $('undo').click();
 assert.deepEqual((await save()).namedDimensions,original.namedDimensions);
 await $('redo').click();
 await load(await save());
 await setDimension('穴径_2',6);
 const edited=await save();
 assert.equal(edited.namedDimensions.穴径,8);
 assert.equal(edited.namedDimensions.穴径_2,6);
 const changed=edited.features.find(f=>f.id===importedHole.id);
 assert.equal(changed.diameter,6);
 assert.ok(edited.features.at(-1).outputs[0].shapeMetrics.volume<placement.outputs[0].shapeMetrics.volume);
 assert.deepEqual(edited.features[0],original.features[0]);

 await load({...format,features:printFeatures});
 const printing=await save();
 const printDocument={...printing,drawing:{
  version:1,signature:drawingSignature(printing.features),targets:['body-a','body-b'],targetMode:'selected',scale:1,hidden:true,comment:'',
  dimensions:[{kind:'horizontal',view:'front',a:[0,0],b:[18,0],at:[9,6],review:true,unplaced:true}],
  options:{name:'印刷セット検証',material:'',date:'',frame:true,paper:'A4',orientation:'landscape',
   positions:{front:[30,40],top:[30,80]},layout:'compact',viewSelection:['top','front'],isoMode:'hidden',pdfLayout:'manual',
   pageAssignments:{pageCount:2,views:{front:1,top:2},comments:{}},
  },
 }};
 await load(printDocument);
 await openPrintSet();
 assert.match(await out('contents').textContent(),/PDFの対象ボディ/);
 assert.match(await out('contents').textContent(),/PDF 2 ページ/);
 assert.match(await out('contents').textContent(),/3MF ／ 作成済みのリブ/);
 assert.match(await out('options').textContent(),/参照先を要確認/);
 await out('options').getByRole('textbox',{name:'PDF・3MFの共通ファイル名'}).fill('カバー一式');
 const archive=await download(out('confirm'));
 assert.equal(archive.name,'カバー一式.zip');
 const files=unzipSync(archive.bytes);
 assert.deepEqual(Object.keys(files).sort(),['カバー一式.3mf','カバー一式.pdf']);
 const pdf=Buffer.from(files['カバー一式.pdf']).toString('latin1');
 assert.match(pdf,/^%PDF-/);
 assert.equal((pdf.match(/\/Type \/Page\b/g)||[]).length,2);
 const print=unzipSync(files['カバー一式.3mf']),settings=strFromU8(print['Metadata/model_settings.config']);
 assert.equal((settings.match(/subtype="normal_part"/g)||[]).length,4);
 assert.equal((settings.match(/subtype="support_blocker"/g)||[]).length,2);
 for(const id of ['body-a','body-b','ribs-a','ribs-b'])assert.ok(settings.includes('value="'+id+'"'));
 assert.match(await drawing('status').textContent(),/カバー一式\.zip/);
 await drawing('close').click();
 printDocument.drawing.options.pdfPositions={top:[294,205]};
 await load(printDocument);
 await openPrintSet();
 assert.equal(await out('confirm').textContent(),'PDFの配置を確認する');
 await out('confirm').click();
 await drawing('pdf-preview-save').waitFor();
 assert.equal(await drawing('pdf-preview-save').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,url:page.url(),libraryHistory:true,editedHole:true,undoRedo:true,
  zip:true,pdfPages:2,printParts:4,blockers:2,overflowReview:true}));
}catch(error){
 if(page)for(const locator of ['#selection-library-dialog [data-status]','#selection-paste-panel [data-error]','#drawing-status','#export-detail']){
  console.error(locator,await page.locator(locator).textContent().catch(()=>''));
 }
 throw error;
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
