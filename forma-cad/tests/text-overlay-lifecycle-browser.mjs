import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const dir='outputs/text-overlay-lifecycle/';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const bounds=page.locator('#text-sketch-bounds'),dialog=page.locator('#text-sketch-dialog');
const overlays=page.locator('#text-sketch-bounds,#text-sketch-drag,.text-sketch-corner');
async function frame(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function hidden(){await frame();assert.deepEqual(await overlays.evaluateAll(items=>items.map(item=>getComputedStyle(item).display)),Array(6).fill('none'),'All text editing overlays must disappear together');assert.equal(await bounds.locator('polygon').getAttribute('points'),'','A hidden frame must not retain old text bounds');}
async function ready(text){await page.locator('#text-sketch-text').fill(text);await page.waitForFunction(text=>{const state=JSON.parse(document.getElementById('canvas-host').dataset.textSketchPreview||'null');return state?.text===text&&!document.getElementById('text-sketch-apply').disabled;},text);await frame();assert.equal(await bounds.isVisible(),true);assert.notEqual(await bounds.locator('polygon').getAttribute('points'),'');}
try{
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:5188/');await page.locator('#new-text').waitFor();
 await hidden();
 await page.locator('#new-text').click();await ready('文字OB8');await page.screenshot({path:dir+'preview.png'});
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.screenshot({path:dir+'cancelled.png'});await hidden();
 await page.locator('#new-text').click();await ready('文字OB8');await page.locator('#text-sketch-text').fill('😀');await page.waitForFunction(()=>document.getElementById('text-sketch-error').textContent.includes('このフォントにない文字'));await hidden();
 await ready('文字OB8');await page.locator('#text-sketch-apply').click();await dialog.waitFor({state:'hidden'});await hidden();assert.equal(await page.locator('#canvas-host').getAttribute('data-text-sketch-preview'),null);
 await page.locator('#new-text').click();await ready('O');await page.locator('#text-sketch-u').fill('40');await page.waitForFunction(()=>JSON.parse(document.getElementById('canvas-host').dataset.textSketchPreview||'null')?.origin[0]===40);await page.locator('#text-sketch-extrude').click();await dialog.waitFor({state:'hidden'});await hidden();
 assert.deepEqual(errors,[]);const proof={hiddenAtStartup:true,removedOnCancel:true,removedOnInvalidText:true,removedOnSketchApply:true,removedOnExtrusion:true,noStaleBounds:true,errors};await fs.writeFile(dir+'browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){console.error(await overlays.evaluateAll(items=>items.map(item=>({id:item.id,hidden:item.hasAttribute('hidden'),display:getComputedStyle(item).display,points:item.querySelector('polygon')?.getAttribute('points')}))));await page.screenshot({path:dir+'failure.png'});throw error;}finally{await browser.close();}
