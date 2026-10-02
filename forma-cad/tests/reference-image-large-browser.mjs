import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {validateProject} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#reference-image-tool').click();

 // A normal sized JPEG can expand past the old 12 MB data URL limit when
 // the import path converts it to PNG. Use seeded noise for a stable fixture.
 const fixture=await page.evaluate(async()=>{
  const width=2800,height=1800,canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),pixels=context.createImageData(width,height);
  let seed=0x12345678;
  for(let i=0;i<pixels.data.length;i+=4){
   seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i]=seed&255;
   seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i+1]=seed&255;
   seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i+2]=seed&255;
   pixels.data[i+3]=255;
  }
  context.putImageData(pixels,0,0);
  const jpeg=canvas.toDataURL('image/jpeg',.72);
  const decoded=new Image();decoded.src=jpeg;await decoded.decode();
  context.clearRect(0,0,width,height);context.drawImage(decoded,0,0);
  return {base64:jpeg.split(',')[1],pngDataLength:canvas.toDataURL('image/png').length,width,height};
 });
 const input=Buffer.from(fixture.base64,'base64');
 assert.ok(input.length<10_000_000,'JPEG fixture must fit import limit: '+input.length);
 assert.ok(fixture.pngDataLength>12_000_000,'PNG expansion must exceed old limit: '+fixture.pngDataLength);

 await page.locator('#reference-image-file').setInputFiles({name:'large-photo.jpg',mimeType:'image/jpeg',buffer:input});
 await page.waitForFunction(()=>{
  const count=document.getElementById('canvas-host').dataset.referenceImageCount;
  const error=document.getElementById('reference-image-error').textContent;
  return count==='1'||(error&&error!=='読み込み中…');
 });
 assert.equal(await page.locator('#canvas-host').getAttribute('data-reference-image-count'),'1',await page.locator('#reference-image-error').textContent());
 assert.equal(await page.locator('#reference-image-error').textContent(),'');
 assert.equal(await page.locator('#body-count').textContent(),'0');
 await page.waitForFunction(()=>!document.getElementById('reference-image-add').disabled);

 const save=async()=>{
  const download=page.waitForEvent('download');
  await page.locator('#save').click();
  const bytes=await fs.readFile(await(await download).path());
  return {bytes,data:JSON.parse(bytes.toString('utf8'))};
 };
 const saved=await save(),feature=saved.data.features[0];
 assert.equal(saved.data.features.length,1);
 assert.equal(feature.kind,'referenceImage');
 assert.equal(feature.name,'large-photo.jpg');
 assert.equal(feature.width,100);
 assert.ok(Math.abs(feature.height/feature.width-fixture.height/fixture.width)<.001);
 assert.match(feature.data,/^data:image\/(png|jpeg|webp);base64,/);
 assert.ok(feature.data.length<=12_000_000,'saved image data exceeds validation limit: '+feature.data.length);
 assert.ok(saved.bytes.length<30_000_000,'saved design exceeds project import limit: '+saved.bytes.length);
 validateProject(saved.data);

 await page.locator('#reference-image-delete').click();
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.referenceImageCount==='0');
 await page.locator('#file').setInputFiles({name:'large-photo.forma.json',mimeType:'application/json',buffer:saved.bytes});
 await page.locator('#project-load-preview').waitFor({state:'visible'});
 await page.locator('#project-preview-open').click();
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.referenceImageCount==='1');
 const reloaded=await save();
 assert.equal(reloaded.data.features.length,1);
 assert.deepEqual(reloaded.data.features[0],feature);
 validateProject(reloaded.data);
 assert.deepEqual(errors,[]);
 console.log('PASS large JPEG import, bounded saved image, project save and reload');
}finally{await browser.close();}
