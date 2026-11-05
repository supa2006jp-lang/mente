import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const dialog=page.locator('#favorite-commands-dialog'),row=id=>dialog.locator('[data-command="'+id+'"]'),proxy=id=>page.locator('#favorite-commands [data-favorite-command="'+id+'"]');
const open=async()=>page.locator('#favorite-commands-open').click(),save=async()=>dialog.getByRole('button',{name:'保存',exact:true}).click();
async function color(id,value){await row(id).locator('input[type=color]').fill(value);}
async function expectColor(id,bg,fg){assert.deepEqual(await proxy(id).evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color];}),[bg,fg]);}
try{
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 const allCommands=page.locator('#advanced-tools');assert.match(await allCommands.textContent(),/全コマンド/);
 await allCommands.click();assert.equal(await page.locator('#tools-dialog h2').textContent(),'全コマンド');await page.locator('#tools-close').click();
 await open();
 for(const id of ['solid-tool','move-tool','direct-fillet'])await row(id).getByRole('button',{name:'を登録する',exact:false}).click();
 await color('solid-tool','#00cc88');await color('move-tool','#223366');
 await row('move-tool').getByRole('button',{name:'を前へ',exact:false}).click();
 assert.equal(await row('solid-tool').locator('input[type=color]').inputValue(),'#00cc88');
 await save();await expectColor('solid-tool','rgb(0, 204, 136)','rgb(0, 0, 0)');await expectColor('move-tool','rgb(34, 51, 102)','rgb(255, 255, 255)');
 assert.equal(await proxy('direct-fillet').getAttribute('data-command-color'),null);
 await page.reload();await proxy('solid-tool').waitFor();await expectColor('solid-tool','rgb(0, 204, 136)','rgb(0, 0, 0)');
 await open();await color('solid-tool','#ff0000');await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();
 await expectColor('solid-tool','rgb(0, 204, 136)','rgb(0, 0, 0)');await open();assert.equal(await row('solid-tool').locator('input[type=color]').inputValue(),'#00cc88');
 await row('move-tool').getByRole('button',{name:'の登録を解除',exact:false}).click();await row('move-tool').getByRole('button',{name:'を登録する',exact:false}).click();
 assert.equal(await row('move-tool').locator('input[type=color]').inputValue(),'#223366');
 await dialog.locator('[data-auto-sort]').check();await save();await expectColor('move-tool','rgb(34, 51, 102)','rgb(255, 255, 255)');
 const active=await proxy('solid-tool').evaluate(el=>{el.classList.add('active');return getComputedStyle(el).boxShadow;});assert.notEqual(active,'none');
 await open();await row('solid-tool').getByRole('button',{name:'の色を標準に戻す',exact:false}).click();await save();
 assert.equal(await proxy('solid-tool').getAttribute('data-command-color'),null);await expectColor('move-tool','rgb(34, 51, 102)','rgb(255, 255, 255)');
 await page.reload();await proxy('move-tool').waitFor();assert.equal(await proxy('solid-tool').getAttribute('data-command-color'),null);await expectColor('move-tool','rgb(34, 51, 102)','rgb(255, 255, 255)');
 await open();await page.screenshot({path:'.sites-runtime/favorite-colors-settings.png'});await dialog.getByRole('button',{name:'初期設定',exact:true}).click();await save();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-command-toolbar-v1')));assert.deepEqual(saved.colors,{});assert.deepEqual(errors,[]);
 const report={pass:true,allCommandsLabel:true,individualColors:true,automaticTextContrast:true,reorderPreservesColors:true,persistence:true,cancelPreservesColors:true,registrationPreservesColors:true,autoSortPreservesColors:true,activeIndicator:true,perCommandReset:true,resetAll:true,errors};
 if(process.env.FORMA_TEST_REPORT)await fs.writeFile(process.env.FORMA_TEST_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:'.sites-runtime/favorite-colors-failure.png'});throw error;}
finally{await browser.close();server.close();}
