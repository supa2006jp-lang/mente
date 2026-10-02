import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1550,height:1100}});
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#advanced-tools').click();
 await page.locator('#cad-command').selectOption('offset');
 await page.keyboard.type('-2.75');
 assert.equal(await page.locator('#cad-offset').inputValue(),'-2.75');
 await page.locator('#cad-command').selectOption('pull');
 await page.keyboard.type('0.125');
 assert.equal(await page.locator('#cad-distance').inputValue(),'0.125');
 await page.locator('#tools-close').click();
 await page.keyboard.type('42');
 assert.equal(await page.locator('#extrude-distance').isVisible(),false);
 console.log('PASS command switch direct signed/decimal input and inactive command guard');
}finally{await browser.close();}
