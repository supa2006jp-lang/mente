import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import '../server.mjs';

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1750,height:1050}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const url='http://127.0.0.1:5188/',banner=page.locator('#sketch-banner'),settings=page.locator('#sketch-settings-toggle');
 const pin=page.getByRole('button',{name:'角度吸着をピン留め',exact:true}),angle=page.locator('#line-angle-snap');
 async function start(){
  await page.goto(url);
  await page.locator('#new-line').click();
  await banner.waitFor();
 }
 await start();
 assert.equal(await settings.getAttribute('aria-expanded'),'false');
 assert.equal(await angle.isVisible(),false);
 assert.ok(await page.locator('#sketch-construction-toggle').isVisible());
 assert.ok(await page.locator('#end-sketch').isVisible());
 await settings.click();
 await pin.click();
 assert.equal(await pin.getAttribute('aria-pressed'),'true');
 await page.locator('#line-angle-step').selectOption('30');
 await settings.click();
 assert.ok(await angle.isVisible());
 assert.equal(await page.locator('#continuous-line').isVisible(),false);
 await start();
 assert.ok(await angle.isVisible());
 await settings.click();
 await pin.click();
 assert.equal(await pin.getAttribute('aria-pressed'),'false');
 await settings.click();
 assert.equal(await angle.isVisible(),false);

 const before=await banner.boundingBox(),canvas=await page.locator('#canvas-host canvas').boundingBox();
 const point={x:before.x+before.width*.35,y:before.y+before.height/2};
 const dy=160;
 await page.mouse.click(point.x,point.y+dy);
 const button=await settings.boundingBox(),buttonX=button.x+button.width/2,buttonY=button.y+button.height/2;
 await page.mouse.move(buttonX,buttonY+dy);
 await page.mouse.move(buttonX,buttonY,{steps:20});
 assert.deepEqual(await banner.boundingBox(),before);
 await page.mouse.click(buttonX,buttonY);
 assert.equal(await settings.getAttribute('aria-expanded'),'true');
 await settings.click();

 const pan={x:canvas.x+canvas.width*.76,y:canvas.y+canvas.height*.6};
 await page.mouse.move(pan.x,pan.y);
 await page.mouse.down({button:'middle'});
 await page.mouse.move(pan.x,pan.y-dy,{steps:10});
 await page.mouse.up({button:'middle'});
 await page.waitForFunction(()=>!!document.getElementById('sketch-banner').style.translate);
 const moved=await banner.boundingBox();
 assert.ok(point.y<moved.y||point.y>moved.y+moved.height||point.x<moved.x||point.x>moved.x+moved.width);
 await page.mouse.move(canvas.x+canvas.width*.95,canvas.y+canvas.height*.8);
 assert.deepEqual(await banner.boundingBox(),moved);
 await page.mouse.move(pan.x,pan.y-dy);
 await page.mouse.down({button:'middle'});
 await page.mouse.move(pan.x,pan.y,{steps:10});
 await page.mouse.up({button:'middle'});
 await page.waitForFunction(()=>!document.getElementById('sketch-banner').style.translate);
 await page.locator('#end-sketch').click();
 await banner.waitFor({state:'hidden'});

 await page.locator('#new-line').click();
 await page.mouse.move(pan.x,pan.y);
 await page.mouse.down({button:'middle'});
 await page.mouse.move(pan.x+60,pan.y+35,{steps:6});
 await page.mouse.up({button:'middle'});
 const host=page.locator('#canvas-host');
 const viewBefore=JSON.parse(await host.getAttribute('data-camera-state'));
 await page.locator('#new-rect').click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const viewAfter=JSON.parse(await host.getAttribute('data-camera-state'));
 assert.ok(viewAfter.every((value,i)=>Math.abs(value-viewBefore[i])<1e-6));
 assert.deepEqual(errors,[]);
 console.log('PASS drawing settings, persistent pins and relocation away from the active endpoint');
}finally{await browser.close();}
process.exit(0);
