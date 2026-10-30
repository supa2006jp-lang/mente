import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve('dist'),out='.sites-runtime/page-exit-browser';
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(url==='/'?'/index.html':decodeURIComponent(url)));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});
  res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[],exitDialogs=[],requests=[];
page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>requests.push(r.url()));
page.on('dialog',async dialog=>{
 if(dialog.type()==='beforeunload')exitDialogs.push(dialog.message());
 await dialog.accept();
});
async function makeDirty(){
 // A trusted action activates browser exit protection if a handler is installed.
 await page.locator('#canvas-host canvas').waitFor();
 await page.locator('#clear').click();
 assert.equal(await page.locator('#dirty').textContent(),'•');
 assert.match(await page.locator('#project-save-state').textContent(),/未保存/);
}
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await makeDirty();
 await page.reload();
 await makeDirty();
 await page.goto('about:blank');
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await makeDirty();
 const closed=page.waitForEvent('close');
 await page.close({runBeforeUnload:true});
 await closed;
 assert.deepEqual(exitDialogs,[]);
 assert.deepEqual(errors,[]);
 const proof={pass:true,build:requests.find(u=>u.includes('/app.js?v='))?.split('?v=')[1],syntheticFixturesOnly:true,dirtyIndicatorRetained:true,reloadWithoutConfirmation:true,navigationWithoutConfirmation:true,closeWithoutConfirmation:true,exitDialogs,errors};
 await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{await browser.close();await new Promise(r=>server.close(r));}
