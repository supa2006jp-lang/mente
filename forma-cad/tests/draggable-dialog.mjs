import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188');await page.locator('#advanced-tools').click();
 const dialog=page.locator('#tools-dialog'),heading=dialog.locator('h2');
 await page.waitForTimeout(100);let r=await dialog.boundingBox();assert.ok(Math.abs(r.x+r.width-1484)<2);assert.ok(Math.abs(r.y+r.height-1084)<2);
 const h=await heading.boundingBox();await page.mouse.move(h.x+20,h.y+10);await page.mouse.down();await page.mouse.move(h.x-180,h.y-90,{steps:8});await page.mouse.up();
 let moved=await dialog.boundingBox();assert.ok(Math.abs(moved.x-(r.x-200))<2);assert.ok(Math.abs(moved.y-(r.y-100))<2);
 await page.locator('#cad-command').selectOption('thread');await page.waitForTimeout(100);r=await dialog.boundingBox();assert.ok(r.x>=8&&r.y>=8&&r.x+r.width<=1492&&r.y+r.height<=1092);
 await page.setViewportSize({width:700,height:650});await page.waitForTimeout(100);r=await dialog.boundingBox();assert.ok(r.x>=7&&r.y>=7&&r.x+r.width<=693&&r.y+r.height<=643);
 await page.locator('#tools-close').click();assert.equal(await dialog.isVisible(),false);await page.locator('#advanced-tools').click();assert.equal(await dialog.isVisible(),true);
 await page.screenshot({path:'.sites-runtime/dialog-position.png'});assert.deepEqual(errors,[]);console.log('PASS lower-right initial position, title drag, command resize, viewport clamp and close/reopen');
}finally{await browser.close();}
