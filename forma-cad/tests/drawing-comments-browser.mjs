import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';
import {drawingSignature} from '../src/drawing-state.js';

const url=process.argv[2]??'http://127.0.0.1:5188/';
const paragraphs=['取付面と取付穴の位置を図面と照合し、部品番号を確認する。',
 '組み立て前にケーブルとカバーの間隔を確保し、干渉がないことを確認する。'];
const features=[{...defaults,id:'plate',name:'試験板',kind:'extrusion',width:42,height:22,depth:8}];
const project={format:'forma-cad',version:1,units:'mm',features,drawing:{
 version:1,signature:drawingSignature(features),targets:['plate'],targetMode:'visible',scale:1,hidden:true,dimensions:[],comment:'',
 options:{name:'',material:'',date:'',layout:'projection',paper:'A4',orientation:'landscape',frame:true,
  viewSelection:['top'],isoMode:'hidden',positions:{comment:[20,100]}}}};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1200},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept(d.defaultValue()));
 const field=id=>page.locator('#drawing-'+id),preview=field('preview'),selector='[data-comment="true"] text';
 const lines=()=>preview.locator(selector).allTextContents();
 async function open(doc,name){
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.locator('#project-preview-open').click();await field('tool').click();
  await page.waitForFunction(()=>document.querySelector('#drawing-preview svg')&&!document.querySelector('#drawing-generate').disabled);
 }
 async function download(button){
  const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return fs.readFile(await file.path());
 }
 async function checkExport(expected){
  const xml=(await download(field('svg'))).toString();
  const savedLines=await page.evaluate(({xml,selector})=>[...new DOMParser().parseFromString(xml,'image/svg+xml').querySelectorAll(selector)].map(el=>el.textContent),{xml,selector});
  assert.deepEqual(savedLines,expected);
  await field('pdf-preview-open').click();
  assert.deepEqual(await field('pdf-preview-host').locator(selector).allTextContents(),expected);
  assert.equal((await download(field('pdf-preview-save'))).subarray(0,5).toString(),'%PDF-');
  await field('pdf-preview-close').click();
 }
 await page.goto(url);
 await page.locator('#canvas-host canvas').waitFor();
 await open(project,'wrap.forma.json');
 await field('comment').fill(paragraphs.join('\n'));
 await field('comment').press('Tab');
 assert.deepEqual(await lines(),paragraphs);
 await field('scale').selectOption('0.5');
 assert.deepEqual(await lines(),paragraphs);
 await field('layout-mode').check();
 const line=preview.locator(selector).first();
 await line.scrollIntoViewIfNeeded();
 const points=await line.evaluate(el=>{
  const b=el.getBBox(),matrix=el.getScreenCTM();
  return [0,220].map(dx=>{const p=new DOMPoint(b.x+1+dx,b.y+b.height/2).matrixTransform(matrix);return [p.x,p.y];});
 });
 await page.keyboard.down('Alt');
 await page.mouse.move(...points[0]);await page.mouse.down();await page.mouse.move(...points[1],{steps:8});await page.mouse.up();
 await page.keyboard.up('Alt');
 const narrow=await lines();
 assert.ok(narrow.length>paragraphs.length);
 assert.equal(narrow.join(''),paragraphs.join(''));
 const bounds=await preview.locator('[data-comment="true"]').evaluate(el=>{
  const box=el.getBBox();return [box.x,box.x+box.width];
 });
 assert.ok(Math.abs(bounds[0]-240)<1&&bounds[1]<=292,JSON.stringify(bounds));
 await checkExport(narrow);
 await field('undo').click();
 assert.deepEqual(await lines(),paragraphs);
 await field('comment-add').click();
 const otherId=await field('comment-target').inputValue(),otherText='仕上げ <確認> & 組立前の検査項目をすべて記録する。';
 await field('comment').fill(otherText);await field('comment').press('Tab');
 assert.deepEqual(await preview.locator('[data-comment="'+otherId+'"] text').allTextContents(),[otherText]);
 assert.equal(await preview.locator('[data-comment] script').count(),0);
 await checkExport(paragraphs);
 await field('comment-font').selectOption('rounded');
 const waitForFont=()=>page.waitForFunction(()=>[...document.fonts].some(face=>face.family.includes('Forma comment rounded')&&face.status==='loaded'));
 await waitForFont();
 await field('close').click();
 const saved=JSON.parse((await download(page.locator('#save'))).toString());
 assert.equal(saved.drawing.comment,paragraphs.join('\n'));
 await page.reload();await page.locator('#canvas-host canvas').waitFor();
 await open(saved,'saved-wrap.forma.json');
 await waitForFont();
 assert.deepEqual(await lines(),paragraphs);
 assert.deepEqual(await preview.locator('[data-comment="'+otherId+'"] text').allTextContents(),[otherText]);
 await field('comment').fill('');
 assert.deepEqual(await lines(),[]);
 assert.deepEqual(errors,[]);
 console.log('PASS comment wrapping, drag and undo, SVG/PDF line breaks, additional comments and saved drawing');
}finally{await browser.close();}
