import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{
 try{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  assert(file.startsWith(root+path.sep));
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1720,height:1110}}),errors=[],results=[];
page.on('pageerror',error=>errors.push(error.message));
async function idle(label){
 await page.waitForTimeout(700);
 const result=await page.evaluate(async()=>{
  const original=document.querySelector('.command-toolbar'),favorites=document.querySelector('#favorite-commands');
  let changes=0;const layouts=new Set();
  const observer=new MutationObserver(records=>{changes+=records.filter(record=>record.type==='childList').length;});
  observer.observe(original,{childList:true,subtree:true});observer.observe(favorites,{childList:true,subtree:true});
  for(let frame=0;frame<45;frame++){
   await new Promise(requestAnimationFrame);
   layouts.add([original,favorites,document.querySelector('canvas')].map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].join(',');}).join('|'));
  }
  observer.disconnect();return {changes,layouts:layouts.size,rows:favorites.querySelectorAll('.command-row').length};
 });
 results.push({label,...result});
 assert.equal(result.changes,0,label+': idle toolbars must not keep moving commands between rows');
 assert.equal(result.layouts,1,label+': viewport must settle after opening or resizing');
}
try{
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#favorite-commands-open').waitFor();
 await idle('empty favorites');
 const ids=await page.locator('.command-toolbar button[id]').evaluateAll(buttons=>buttons.map(button=>button.id));
 await page.evaluate(id=>localStorage.setItem('forma-command-toolbar-v1',JSON.stringify({favorites:[id],collapsed:true})),ids[0]);
 await page.reload();await page.locator('#favorite-commands-open').waitFor();await idle('single favorite');
 for(const collapsed of [false,true]){
  await page.evaluate(({ids,collapsed})=>localStorage.setItem('forma-command-toolbar-v1',JSON.stringify({favorites:ids,hidden:[],collapsed,autoSort:true})),{ids,collapsed});
  await page.reload();await page.locator('#favorite-commands-open').waitFor();
  await idle('all favorites, collapsed='+collapsed);
  assert.equal(await page.locator('#favorite-commands .command-row').count(),2);
  await page.setViewportSize({width:1120,height:820});await idle('narrow, collapsed='+collapsed);
  await page.setViewportSize({width:1720,height:1110});await idle('wide, collapsed='+collapsed);
 }
 assert.deepEqual(errors,[]);const report={pass:true,results,errors};
 if(process.env.FORMA_TEST_REPORT)await fs.writeFile(process.env.FORMA_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}catch(error){console.log(JSON.stringify({pass:false,results,errors}));throw error;}
finally{await browser.close();server.close();}
