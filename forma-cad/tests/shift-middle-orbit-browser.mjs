import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5188');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('閉じた'));
 const host=page.locator('#canvas-host');
 const camera=async()=>JSON.parse(await host.getAttribute('data-camera-state'));
 const orbit=async label=>{
  const rect=await page.locator('#canvas-host canvas').first().boundingBox();
  const x=rect.x+rect.width*.55,y=rect.y+rect.height*.48;
  const before=await camera();
  await page.mouse.move(x,y);
  await page.keyboard.down('Shift');
  await page.mouse.down({button:'middle'});
  await page.mouse.move(x+100,y+75,{steps:8});
  await page.mouse.up({button:'middle'});
  await page.keyboard.up('Shift');
  await page.waitForTimeout(150);
  const after=await camera();
  const rotation=Math.hypot(...after.slice(3,7).map((value,i)=>value-before[i+3]));
  const displacement=Math.hypot(...after.slice(0,3).map((value,i)=>value-before[i]));
  console.log(label,JSON.stringify({rotation,displacement}));
  assert.ok(rotation>.001,label+': Shift + middle drag should rotate the view, but rotation was '+rotation);
 };
 await page.locator('[data-view=iso]').click();
 await orbit('model');
 await page.locator('#new-line').click();
 await page.locator('#plane').selectOption('XY');
 await page.locator('#draw').click();
 await orbit('sketch line');
 assert.equal(await page.locator('#feature-count').textContent(),'0','orbit must not place a sketch feature');
 assert.deepEqual(errors,[]);
 console.log('PASS Shift + middle drag orbits both model and sketch view');
}finally{await browser.close();}

