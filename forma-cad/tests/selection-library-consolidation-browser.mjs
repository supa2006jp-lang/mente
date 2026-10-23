import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=JSON.parse(await fs.readFile('outputs/selection-library/mixed.forma-selection.json','utf8'));
const legacy={format:'forma-solid-template',version:1,units:'mm',name:'以前の部品',brep:source.solids[0].brep};
const dir='outputs/selection-library-consolidation/';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1800,height:1100},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
const dialog=page.locator('#selection-library-dialog'),panel=page.locator('#selection-paste-panel');
async function openFile(data){await page.locator('#selection-library-open').click();await dialog.locator('[data-file]').setInputFiles({name:'previous.forma-part.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});}
try{
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:5188/');await page.locator('#canvas-host canvas').waitFor();
 assert.equal(await page.locator('#solid-template-tool,#template-dialog').count(),0);
 await openFile(legacy);await panel.waitFor();assert.equal(await page.locator('#body-count').textContent(),'0');assert.match(await panel.locator('[data-info]').textContent(),/以前の部品.*ソリッド 1 個/);
 await panel.locator('[data-apply]').click();await panel.waitFor({state:'hidden'});assert.equal(await page.locator('#body-count').textContent(),'1');
 await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='0');await page.locator('#redo').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await openFile(legacy);await panel.waitFor();await panel.locator('[data-cancel]').click();assert.equal(await page.locator('#body-count').textContent(),'1');
 await openFile({...legacy,version:99});await page.waitForFunction(()=>document.querySelector('#selection-library-dialog [data-status]').textContent.includes('対応する'));assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('#body-count').textContent(),'1');
 await page.screenshot({path:dir+'unified-library.png'});assert.deepEqual(errors,[]);
 const proof={duplicateButtonAndDialogRemoved:true,legacyFileLoadsThroughSelectionLibrary:true,previewBeforeCommit:true,legacyPasteCommit:true,atomicUndoRedo:true,cancelPreservesModel:true,invalidLegacyFileRejected:true,errors};await fs.writeFile(dir+'browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser.close();}
