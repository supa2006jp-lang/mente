import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';
import {sketchIntersections} from '../src/sketch-intersections.js';
const lines=[{...defaults,id:'h',name:'horizontal',kind:'sketch',profile:'line',width:40,x:0,y:3,z:20},{...defaults,id:'v',name:'vertical',kind:'sketch',profile:'line',width:30,x:7,y:0,z:20,angle:90}];
for(const line of lines)line.mode='thin';
assert.ok(sketchIntersections(lines).some(p=>p.distanceTo({x:7,y:3,z:20})<1e-6));
assert.equal(sketchIntersections([{...defaults,kind:'sketch',profile:'circle'}]).length,0);
assert.equal(sketchIntersections([lines[0],{...lines[1],z:21}]).length,0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const p=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});p.on('dialog',d=>d.accept());const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5188');
const load=async()=>{await p.locator('#file').setInputFiles({name:'cross.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'body',name:'body',width:60,height:40,depth:20},...lines]}))});await p.locator('#new-circle').click();await p.locator('#z').fill('20');await p.locator('#draw').click();};
const position=async()=>{await p.waitForTimeout(150);const r=await p.locator('canvas').boundingBox(),scale=r.height/(360*Math.tan(Math.PI/9));return {x:r.x+r.width/2+7*scale+1,y:r.y+r.height/2-3*scale+1};};
const save=async()=>{const d=p.waitForEvent('download');await p.locator('#save').click();return JSON.parse(await fs.readFile(await(await d).path(),'utf8'));};
await load();let q=await position();await p.mouse.move(q.x,q.y);assert.equal(await p.locator('#canvas-host').getAttribute('data-snap-kind'),'intersection');await p.mouse.click(q.x,q.y);await p.keyboard.press('Tab');await p.locator('#live-diameter').fill('4');await p.keyboard.press('Enter');let f=(await save()).features.at(-1);assert.ok(Math.abs(f.x-7)<1e-6&&Math.abs(f.y-3)<1e-6);await p.keyboard.press('Escape');
await load();await p.keyboard.press('Escape');await p.locator('#finish-sketch-tool').click();q=await position();await p.mouse.move(q.x,q.y);await p.locator('[aria-label="スケッチの交点を選択"]:visible').click();await p.locator('#center-pattern').click();assert.equal(await p.locator('#cad-center').inputValue(),'SELECTED');await p.locator('#cad-cancel').click();await p.locator('#cut-tool').click();await p.mouse.click(q.x,q.y);await p.locator('#hole-diameter').fill('4');await p.locator('#hole-depth').fill('5');await p.locator('#hole-apply').click();f=(await save()).features.at(-1);assert.ok(f.hole);assert.ok(Math.abs(f.x-7)<1e-6&&Math.abs(f.y-3)<1e-6);assert.deepEqual(errors,[]);console.log('PASS off-grid intersection: circle center, hole center, pattern reference; no fake circle vertices');
}finally{await browser.close();}
