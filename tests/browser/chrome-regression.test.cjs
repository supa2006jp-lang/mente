'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const mime = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
    '.gz': 'application/gzip'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(check, label, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            const value = await check();
            if (value) return value;
        } catch (error) {
            lastError = error;
        }
        await sleep(100);
    }
    throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function findChrome() {
    const candidates = [
        process.env.CHROME_BIN,
        process.platform === 'win32' && path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.platform === 'win32' && path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.platform === 'linux' && '/usr/bin/google-chrome',
        process.platform === 'linux' && '/usr/bin/google-chrome-stable',
        process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);
    const chrome = candidates.find(candidate => fs.existsSync(candidate));
    if (!chrome) throw new Error('Google Chrome が見つかりません。CHROME_BIN を設定してください。');
    return chrome;
}

function startServer(options = {}) {
    const server = http.createServer((request, response) => {
        let pathname;
        try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
        catch { response.writeHead(400).end(); return; }
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (file !== path.join(root, 'index.html') && !file.startsWith(root + path.sep)) {
            response.writeHead(403).end();
            return;
        }
        fs.stat(file, (error, stat) => {
            if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
            if (options.updateBuilds && ['index.html', 'service-worker.js'].includes(path.basename(file))) {
                let text = fs.readFileSync(file, 'utf8');
                text = text.replace(/(name="maintenance-build" content=")[^"]+/, '$1' + server.fixtureBuild)
                    .replace(/const APP_BUILD = '[^']+'/, `const APP_BUILD = '${server.fixtureBuild}'`)
                    .replace(/app-boot\.js\?v=[\w-]+/g, 'app-boot.js?v=' + server.fixtureBuild);
                response.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' }); response.end(text); return;
            }
            response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(response);
        });
    });
    server.fixtureBuild = 'test-old';
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

class DevToolsPage {
    constructor(socket) {
        this.socket = socket;
        this.pending = new Map();
        this.nextId = 1;
        socket.addEventListener('message', event => {
            const message = JSON.parse(String(event.data));
            if (!message.id) return;
            const waiter = this.pending.get(message.id);
            if (!waiter) return;
            this.pending.delete(message.id);
            clearTimeout(waiter.timer);
            if (message.error) waiter.reject(new Error(message.error.message));
            else waiter.resolve(message.result || {});
        });
    }

    send(method, params = {}, timeoutMs = 15000) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Chrome command timed out: ${method}`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression, timeoutMs = 60000) {
        const response = await this.send('Runtime.evaluate', {
            expression, awaitPromise: true, returnByValue: true
        }, timeoutMs);
        if (response.exceptionDetails) {
            const description = response.exceptionDetails.exception?.description || response.exceptionDetails.text;
            throw new Error(description || 'Chrome page evaluation failed');
        }
        return response.result?.value;
    }

    waitFor(expression, label, timeoutMs = 60000) {
        return until(() => this.evaluate(expression), label, timeoutMs);
    }
}

async function reloadApp(page, label) {
    const previousOrigin = await page.evaluate('performance.timeOrigin');
    await page.send('Page.reload');
    await page.waitFor(`performance.timeOrigin !== ${previousOrigin} && Boolean(window.app && window.store?.data)`, label);
}

async function launchHarness(options = {}) {
    const server = await startServer(options);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-chrome-regression-'));
    const chrome = spawn(findChrome(), [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-extensions',
        '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, origin
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let chromeStderr = '';
    chrome.stderr.on('data', chunk => { chromeStderr = (chromeStderr + chunk.toString()).slice(-4000); });
    let phase = 'Chrome launch';
    try {
        const portFile = path.join(profile, 'DevToolsActivePort');
        const port = await until(() => fs.existsSync(portFile) && Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]), 'Chrome debugging port');
        phase = 'target discovery';
        const target = await until(async () => {
            const response = await fetch(`http://127.0.0.1:${port}/json/list`);
            return (await response.json()).find(item => item.type === 'page' && item.url.startsWith(origin));
        }, 'Chrome app tab');
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, { once: true });
            socket.addEventListener('error', reject, { once: true });
        });
        const page = new DevToolsPage(socket);
        phase = 'page initialization';
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        phase = 'app startup';
        await page.waitFor('Boolean(window.app && window.store?.data)', 'app startup');
        phase = 'authorized reload';
        await page.evaluate("sessionStorage.setItem('is_authorized', 'true')");
        await reloadApp(page, 'authorized app startup');
        return {
            page, origin,
            deployBuild(build) { server.fixtureBuild = build; },
            async newPage() {
                const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' });
                const target = await response.json();
                const socket = new WebSocket(target.webSocketDebuggerUrl);
                await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
                const other = new DevToolsPage(socket);
                await other.send('Runtime.enable'); await other.send('Page.enable');
                await other.waitFor('Boolean(window.app && window.store?._saveConcurrencyReady)', 'second tab startup');
                other.close = async () => { await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`); socket.close(); };
                return other;
            },
            async close() {
                socket.close();
                chrome.kill();
                await Promise.race([
                    new Promise(resolve => chrome.once('exit', resolve)),
                    sleep(4000)
                ]);
                await new Promise(resolve => server.close(resolve));
                // Only remove the newly created, task-specific profile under the OS temp directory.
                const safePrefix = path.join(os.tmpdir(), 'maintenance-chrome-regression-');
                if (profile.startsWith(safePrefix)) {
                    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); }
                    catch (error) { console.warn(`Chrome test profile cleanup: ${error.message}`); }
                }
            }
        };
    } catch (error) {
        chrome.kill();
        await new Promise(resolve => server.close(resolve));
        throw new Error(`${phase}: ${error.message}${chromeStderr ? `\nChrome stderr: ${chromeStderr}` : ''}`);
    }
}

function makeWorkbookFixture(files){let offset=0;const local=[],central=[];for(const [name,text] of Object.entries(files)){const n=Buffer.from(name),data=Buffer.from(text);let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;const a=Buffer.alloc(30);a.writeUInt32LE(0x04034b50);a.writeUInt16LE(20,4);a.writeUInt32LE(crc,14);a.writeUInt32LE(data.length,18);a.writeUInt32LE(data.length,22);a.writeUInt16LE(n.length,26);local.push(a,n,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=a.length+n.length+data.length;}const end=Buffer.alloc(22),directory=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]).toString('base64');}

test('real Chrome regression: persistence, restore, offline photos, and save failure', { timeout: 180000 }, async t => {
    const harness = await launchHarness();
    t.after(() => harness.close());
    const { page } = harness;
    await t.test('calendar memo failure keeps the editor open until a successful retry', async () => {
        const result = await page.evaluate(`(async () => {
            app.openCalendarMemoEditor('2026-11-15');
            document.querySelector('.calendar-memo-editor-text').value = '保持するメモ';
            const write = store.writeSaveSnapshot; store.writeSaveSnapshot = async () => { throw Error('memo quota'); };
            await app.saveCalendarMemoEditor('2026-11-15');
            const retained=!!app._calendarMemoEditor && document.querySelector('.calendar-memo-editor-text').value === '保持するメモ';
            store.writeSaveSnapshot=write; await app.saveCalendarMemoEditor('2026-11-15');
            return {retained,closed:!app._calendarMemoEditor,saved:store.activeData.memos['2026-11-15']};
        })()`);
        assert.deepEqual(result,{retained:true,closed:true,saved:'保持するメモ'});
    });

    await t.test('a saved record survives reload and a JSON backup restores it', async () => {
        const marker = `chrome-smoke-${Date.now()}`;
        const saved = await page.evaluate(`(async () => {
            await store.runAtomicSaveBatch(() => {
                store.activeData.tips ||= [];
                store.activeData.tips.push({ id: ${JSON.stringify(marker)}, group: 'テスト', body: '保存確認', attachments: [] });
            });
            window.__browserSmokeBackup = store.exportAsJSON({ optimizeImages: true, mode: 'complete' });
            await store.runAtomicSaveBatch(() => {
                store.activeData.tips.push({ id: 'temporary-to-restore', group: 'テスト', body: '復元で削除', attachments: [] });
            });
            app.getImportPreviewInfo(window.__browserSmokeBackup, 'latest.json');
            return await store.importFromJSON(window.__browserSmokeBackup, { throwOnError: true });
        })()`);
        assert.equal(saved, true);
        await reloadApp(page, 'app reload');
        const result = await page.evaluate(`({
            found: store.activeData.tips?.some(item => item.id === ${JSON.stringify(marker)}),
            removed: !store.activeData.tips?.some(item => item.id === 'temporary-to-restore')
        })`);
        assert.deepEqual(result, { found: true, removed: true });
    });

    await t.test('search and filters stay with their view until the clear button is used', async () => {
        const result = await page.evaluate(`(() => {
            app.switchView('history');
            const search = document.getElementById('global-search');
            const period = document.getElementById('hist-filter-period');
            search.value = 'pump';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            period.value = 'all';
            app.switchView('guides');
            search.value = 'manual';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            app.switchView('history');
            const restored = { query: search.value, period: period.value };
            document.getElementById('view-filter-clear').click();
            const cleared = { query: search.value, period: period.value };
            app.switchView('fiveS');
            return { restored, cleared, disabled: search.disabled, explanation: search.placeholder };
        })()`);
        assert.deepEqual(result.restored, { query: 'pump', period: 'all' });
        assert.deepEqual(result.cleared, { query: '', period: 'last_this_month' });
        assert.equal(result.disabled, true);
        assert.match(result.explanation, /画面内の検索欄/);
    });

    await t.test('the installed app and unused photo modules open while offline', async () => {
        await page.waitFor('Boolean(navigator.serviceWorker?.controller)', 'service worker control');
        await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
        await page.send('Network.enable');
        await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
        try {
            await reloadApp(page, 'offline app startup');
            const loaded = await page.evaluate('(async () => { await window.maintenanceLazyFeatures.loadPhotoEffects(); return typeof app.importPhotoManagerFiles === "function" && typeof app.openShiftPhotoCompare === "function"; })()', 90000);
            assert.equal(loaded, true);
        } finally {
            await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        }
    });

    await t.test('image import commits before success and a failed save leaves no new image', async () => {
        const result = await page.evaluate(`(async () => {
            await window.maintenanceLazyFeatures.loadPhotos();
            const firstSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>';
            const secondSvg = firstSvg.replace('red', 'blue');
            const makeFile = (svg, name) => new File([svg], name, { type: 'image/svg+xml' });
            const before = app.getPhotoManagerLibrary().length;
            await app.importPhotoManagerFiles([makeFile(firstSvg, 'smoke-red.svg')]);
            const afterSuccess = app.getPhotoManagerLibrary().length;
            const originalWrite = store.writeSaveSnapshot;
            store.writeSaveSnapshot = async () => { throw new Error('simulated browser save failure'); };
            try { await app.importPhotoManagerFiles([makeFile(secondSvg, 'smoke-blue.svg')]); }
            finally { store.writeSaveSnapshot = originalWrite; }
            return { before, afterSuccess, afterFailure: app.getPhotoManagerLibrary().length };
        })()`, 90000);
        assert.equal(result.afterSuccess, result.before + 1);
        assert.equal(result.afterFailure, result.afterSuccess);
        await reloadApp(page, 'image reload');
        const persisted = await page.evaluate("(async () => { await window.maintenanceLazyFeatures.loadPhotos(); return app.getPhotoManagerLibrary().filter(item => item.name?.startsWith('smoke-')).map(item => item.name); })()");
        assert.deepEqual(persisted, ['smoke-red']);
    });

    await t.test('old unreferenced image Blobs are reclaimed in IndexedDB', async () => {
        const result = await page.evaluate(`(async () => {
            const key = store.DURABLE_IMAGE_MEDIA_PREFIX + 'browser-gc-check-' + Date.now();
            await store.runMediaWriteTransaction(media => media.put({
                blob: new Blob(['image'], { type: 'image/png' }),
                size: 5,
                updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000
            }, key));
            const preview = await store.cleanupUnusedImageBlobs({ dryRun: true });
            const completed = await store.cleanupUnusedImageBlobs({ dryRun: false });
            const stillPresent = await new Promise((resolve, reject) => {
                const tx = store.db.transaction(store.MEDIA_STORE_NAME, 'readonly');
                const request = tx.objectStore(store.MEDIA_STORE_NAME).get(key);
                request.onsuccess = () => resolve(Boolean(request.result));
                request.onerror = () => reject(request.error);
            });
            return { previewed: preview.eligibleImages >= 1, reclaimed: completed.reclaimedImages >= 1, stillPresent };
        })()`);
        assert.deepEqual(result, { previewed: true, reclaimed: true, stillPresent: false });
    });
});

test('data refinements: measurement, validation, periodic imports, unknown time, Excel and undo', {timeout:180000}, async t=>{
    const h=await launchHarness();t.after(()=>h.close());const {page}=h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook();await maintenanceLazyFeatures.loadPhotos();
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machineCategories=['循環'];store.activeData.machines=[{id:'d-machine',name:'データポンプ',model:'D1',lineNo:'1',category:'循環'}];
            store.activeData.tasks=[];store.activeData.history=[];store.activeData.historyImportLogs=[];store.activeData.partStockMovements=[];
            store.activeData.partsMaster=[{name:'オイル',model:'',price:1000,priceRaw:'1000',unit:'kg',stock:5,minStock:0},{name:'既存シール',model:'',price:null,priceRaw:'',unit:'個',stock:10,minStock:0}];
        });app.updateDataLists();
        window.dataImport=async(text,name='data.csv')=>{app.openHistoryImportModal();const d=new DataTransfer();d.items.add(new File([text],name));document.getElementById('hist-csv-upload').files=d.files;const confirm=window.confirm;try{window.confirm=()=>true;await app.processHistoryImportCSV();}finally{window.confirm=confirm;}};
    })()`);
    await t.test('weight import and edit preserve cost and convert stock in the master unit',async()=>{
        const result=await page.evaluate(`(async()=>{
            await dataImport('日付,機械名,作業内容,対応種別,ライン,部品名,部品数量,部品単位,部品単価\\n2026-11-01,データポンプ,オイル交換,突発,1,オイル,2,kg,1000');
            const record=store.activeData.history[0],before={part:record.replacedParts[0],cost:app.calculateHistoryPartCost(record),stock:store.getPartMaster('オイル','').stock};window.weightImportLog=store.activeData.historyImportLogs[0].id;
            app.openHistoryEditForm(record.id);const inputs={quantity:document.querySelector('.p-count').value,price:document.querySelector('.p-price').value,unit:document.querySelector('.p-unit').value};document.getElementById('e-notes').value='内容だけ更新';await app.saveModalData('edit-history');
            const unchanged=store.getPartMaster('オイル','').stock;app.openHistoryEditForm(record.id);document.querySelector('.p-count').value='3000';await app.saveModalData('edit-history');
            return {before,inputs,unchanged,after:store.getPartMaster('オイル','').stock,movement:store.activeData.partStockMovements.at(-1),cost:app.calculateHistoryPartCost(store.activeData.history.find(r=>r.id===record.id))};
        })()`);
        assert.equal(result.before.part.count,2000);assert.equal(result.before.part.unit,'g');assert.equal(result.before.part.price,1);assert.equal(result.before.cost,2000);assert.deepEqual(result.inputs,{quantity:'2000',price:'1',unit:'g'});assert.equal(result.unchanged,5);assert.equal(result.after,4);assert.equal(result.movement.delta,-1);assert.equal(result.movement.unit,'kg');assert.equal(result.cost,3000);
    });
    await t.test('invalid part numbers join row errors and negative form quantities cannot save',async()=>{
        const result=await page.evaluate(`(async()=>{
            const before=store.activeData.history.length;await dataImport('日付,機械名,作業内容,作業時間,部品名,部品数量,部品単位,部品単価\\n2026-02-30,データポンプ,不正確認,bad,シール,12abc,個,-5');
            const dialog=document.querySelector('.history-import-errors');const errors=dialog.textContent;dialog.close();app.closeModal();
            app.openHistoryEditForm(store.activeData.history[0].id);document.querySelector('.p-count').value='-2';const valid=document.getElementById('edit-history-form').checkValidity();await app.saveModalData('edit-history');
            const quantity=store.activeData.history[0].replacedParts[0].count;app.closeModal();return {errors,valid,quantity,unchanged:store.activeData.history.length===before};
        })()`);
        assert.match(result.errors,/日付/);assert.match(result.errors,/作業時間/);assert.match(result.errors,/部品数量/);assert.match(result.errors,/部品単価/);assert.equal(result.valid,false);assert.equal(result.quantity,3000);assert.equal(result.unchanged,true);
    });
    await t.test('periodic classification and unknown duration agree in history, worktime and CSV round trips',async()=>{
        const result=await page.evaluate(`(async()=>{
            await dataImport('日付,機械名,作業内容,対応種別,ライン,作業時間,作業者\\n2026-11-02,データポンプ,未確認点検,定期,1,,田中\\n2026-11-03,データポンプ,ゼロ点検,定期,1,0,田中\\n2026-11-04,データポンプ,定期点検,定期,1,12.5,田中\\n2026-11-05,データポンプ,突発点検,突発,1,10,田中');
            const records=store.activeData.history.filter(r=>r.taskContent?.includes('点検')||r.errorContent==='突発点検');
            app.switchView('worktime');document.getElementById('worktime-filter-period').value='all';app.workTimeGroupBy='worker';app.renderWorkTime('');
            const row=app._workTimeEvidenceContext.results.find(r=>r.name==='田中');const evidence=app.getWorkTimeEvidence(app._workTimeEvidenceContext.history,app._workTimeEvidenceContext.results,'worker',store.getMachines(true));
            app.switchView('history');app.clearCurrentViewSearchAndFilters();document.getElementById('hist-filter-period').value='all';document.getElementById('hist-filter-type').value='periodic';app.renderHistory();
            const table=document.getElementById('view-history').textContent;let csv;const download=app.downloadCSV;try{app.downloadCSV=(name,text)=>csv=text;app.exportHistoryAsCSV();}finally{app.downloadCSV=download;}
            let plan;const review=app.openHistoryImportReview;try{app.openHistoryImportReview=p=>plan=p;await dataImport(csv);}finally{app.openHistoryImportReview=review;app.closeModal();}
            return {types:records.map(r=>app.getHistoryTypeInfo(r).key),times:records.map(r=>r.workTime),row:{pt:row.pt,pc:row.pc,st:row.st,sc:row.sc},unknown:evidence.unknownTimes.length,table,csv,roundtrip:plan.entries.map(e=>({type:app.getHistoryTypeKey(e.record),time:e.record.workTime})),tasks:store.activeData.tasks.length};
        })()`);
        assert.deepEqual(result.types,['periodic','periodic','periodic','sudden']);assert.deepEqual(result.times,[null,0,12.5,10]);assert.deepEqual(result.row,{pt:12.5,pc:3,st:10,sc:1});assert.ok(result.unknown>=1);assert.match(result.table,/未確認点検/);assert.match(result.table,/未入力・要確認/);assert.deepEqual(result.roundtrip.map(r=>r.type),['periodic','periodic','periodic']);assert.deepEqual(result.roundtrip.map(r=>r.time).sort((a,b)=>(a??-1)-(b??-1)),[null,0,12.5]);assert.equal(result.tasks,0);
    });
    await t.test('real Excel bytes convert the selected date column including the 1904 date system',async()=>{
        // Minimal uncompressed ZIP: exercise the actual workbook parser without a runtime spreadsheet dependency.

        const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">'+['作業日','実施日','設備名','作業内容','ライン'].map((s,i)=>`<c r="${String.fromCharCode(65+i)}1" t="inlineStr"><is><t>${s}</t></is></c>`).join('')+'</row><row r="7"><c r="A7"><v>44865</v></c><c r="B7"><v>44866</v></c><c r="C7" t="inlineStr"><is><t>データポンプ</t></is></c><c r="D7" t="inlineStr"><is><t>Excel確認</t></is></c><c r="E7"><v>1</v></c></row></sheetData></worksheet>';
        const bytes=makeWorkbookFixture({'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><workbookPr date1904="1"/></workbook>','xl/worksheets/sheet1.xml':sheet});
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob('${bytes}'),c=>c.charCodeAt(0))],'dates.xlsx'));document.getElementById('hist-csv-upload').files=d.files;await app.refreshHistoryImportPreview();
            let select=document.querySelector('[data-import-column=date]');select.value='0';select.dispatchEvent(new Event('change'));const first=document.getElementById('hist-csv-preview').textContent;
            select=document.querySelector('[data-import-column=date]');select.value='1';select.dispatchEvent(new Event('change'));const second=document.getElementById('hist-csv-preview').textContent;
            const confirm=window.confirm;try{window.confirm=()=>true;await app.processHistoryImportCSV();}finally{window.confirm=confirm;}
            return {first,second,date:store.activeData.history.find(r=>r.errorContent==='Excel確認').date};
        })()`);
        assert.match(result.first,/2026-11-01/);assert.match(result.second,/2026-11-02/);assert.equal(result.date,'2026-11-02');
    });
    await t.test('reviewed undo reverses only edits to imported stock and retains other records',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();app.openHistoryImportUndo(weightImportLog);const dialog=document.querySelector('.history-import-undo');const before={text:dialog.textContent,checked:dialog.querySelector('input').checked,disabled:document.getElementById('history-import-undo-save').disabled};
            dialog.querySelector('input').click();await document.getElementById('history-import-undo-save').onclick();
            return {before,stock:store.getPartMaster('オイル','').stock,removed:!store.activeData.history.some(r=>r.errorContent==='オイル交換'),retained:store.activeData.history.filter(r=>r.historyType==='periodic').length,movement:store.activeData.partStockMovements.at(-1)};
        })()`);
        assert.equal(result.before.checked,false);assert.equal(result.before.disabled,true);assert.match(result.before.text,/編集済み/);assert.match(result.before.text,/2000g.*3000g/);assert.equal(result.stock,5);assert.equal(result.removed,true);assert.equal(result.retained,3);assert.equal(result.movement.source,'import-undo');assert.equal(result.movement.delta,1);
    });
    await t.test('failed undo leaves all data and selections intact, then retry restores unused masters',async()=>{
        const result=await page.evaluate(`(async()=>{
            await dataImport('日付,機械名,作業内容,対応種別,交換部品\\n2026-11-06,取消用新機械,取消確認,突発,取消用部品 x2 個 @20 / 既存シール x1 個 @50');const id=store.activeData.historyImportLogs[0].id;const recordId=store.activeData.history.at(-1).id;
            app.openHistoryImportModal();app.openHistoryImportUndo(id);const write=store.writeSaveSnapshot;let failed;
            try{store.writeSaveSnapshot=async()=>{throw Error('取消保存の失敗確認')};await document.getElementById('history-import-undo-save').onclick();failed={exists:store.activeData.history.some(r=>r.id===recordId),master:!!store.getPartMaster('取消用部品',''),checked:document.querySelector('.history-import-undo input').checked,error:document.querySelector('.history-import-undo [role=alert]').textContent};}finally{store.writeSaveSnapshot=write;}
            await document.getElementById('history-import-undo-save').onclick();return {failed,record:store.activeData.history.some(r=>r.id===recordId),machine:store.activeData.machines.some(m=>m.name==='取消用新機械'),part:!!store.getPartMaster('取消用部品',''),price:store.getPartMaster('既存シール','').price,cancelled:store.activeData.historyImportLogs.find(l=>l.id===id).cancelledRecordIds.length};
        })()`);
        assert.equal(result.failed.exists,true);assert.equal(result.failed.master,true);assert.equal(result.failed.checked,true);assert.match(result.failed.error,/失敗確認/);assert.equal(result.record,false);assert.equal(result.machine,false);assert.equal(result.part,false);assert.equal(result.price,null);assert.equal(result.cancelled,1);
        await reloadApp(page,'undo persists');assert.equal(await page.evaluate("store.activeData.history.some(r=>r.errorContent==='取消確認')"),false);
    });
});

test('input refinements: workers, protected prices, column mapping, encodings, review and error reports', {timeout:180000}, async t=>{
    const h=await launchHarness();t.after(()=>h.close());const {page}=h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook();await maintenanceLazyFeatures.loadPhotos();
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machineCategories=['循環'];
            store.activeData.machines=[{id:'in1',name:'入力ポンプ',model:'IN-1',lineNo:'1',category:'循環'},{id:'in2',name:'入力ポンプ',model:'IN-1',lineNo:'2',category:'循環'}];
            store.activeData.tasks=[{id:'in-task',machineId:'in1',content:'確認',periodDays:7,startDate:app.getLocalDateString()}];store.activeData.history=[];
            store.activeData.partsMaster=[{name:'シール',model:'a',price:200,priceRaw:'200',unit:'個'},{name:'シール',model:'b',price:500,priceRaw:'500',unit:'個'}];
        });app.updateDataLists();
        window.inputFile=bytes=>{const d=new DataTransfer();d.items.add(new File([bytes],'input.csv',{type:'text/csv'}));document.getElementById('hist-csv-upload').files=d.files;};
    })()`);
    await t.test('sudden, completion and history edit save distinct workers and reconcile person-minutes',async()=>{
        const result=await page.evaluate(`(async()=>{
            const alerts=[],alert=window.alert;window.alert=m=>alerts.push(m);
            try {
                app.openSuddenRecordModal();document.getElementById('s-machine-id').value='in1';app.onSuddenMachineChange('in1');
                document.getElementById('s-content').value='作業者確認';document.getElementById('s-work-time').value='10';document.getElementById('s-category').value='machine';document.getElementById('s-workers').value='田中、鈴木，田中／佐藤';
                await app.saveModalData('sudden');const sudden=store.activeData.history.find(r=>r.errorContent==='作業者確認');
                app.openEquipmentWorkspace('in1');[...document.querySelectorAll('#modal-content button')].find(b=>b.textContent==='完了を記録').click();
                document.getElementById('c-work-time').value='10';document.getElementById('c-category').value='machine';document.getElementById('c-workers').value='田中，鈴木、田中';await app.saveModalData('complete');
                const complete=store.activeData.history.find(r=>r.taskId==='in-task');
                app.closeModal();await app.openHistoryEditForm(sudden.id);document.getElementById('e-workers').value='田中、鈴木，佐藤、田中';await app.saveModalData('edit-history');
                const edited=store.activeData.history.find(r=>r.id===sudden.id);
                return {alerts,sudden:sudden.workers,complete:complete.workers,edit:edited.workers,labor:app.calculateHistoryCost(edited).laborMinutes,contribution:app.getWorkTimeContribution(edited,'worker','')};
            }finally{window.alert=alert;app.closeModal();}
        })()`);
        assert.deepEqual(result.alerts,[]);assert.deepEqual(result.sudden,['田中','鈴木','佐藤']);assert.deepEqual(result.complete,['田中','鈴木']);assert.deepEqual(result.edit,['田中','鈴木','佐藤']);assert.equal(result.labor,30);assert.equal(result.contribution,30);
    });
    await t.test('manual and saved zero prices survive name/model corrections until master price is explicitly requested',async()=>{
        const result=await page.evaluate(`(()=>{
            app.openSuddenRecordModal();app.addPartRow({name:'シール',model:'a',count:1,price:0},true);
            const row=document.querySelector('.part-row'),price=row.querySelector('.p-price'),model=row.querySelector('.p-model'),summary=row.querySelector('summary');
            model.value='b';model.dispatchEvent(new Event('input',{bubbles:true}));const zero=price.value;
            price.value='123';price.dispatchEvent(new Event('input',{bubbles:true}));model.value='a';model.dispatchEvent(new Event('input',{bubbles:true}));
            const typed=price.value;const confirm=window.confirm;try{window.confirm=()=>false;app.applyPartMasterToRow(row,store.activeData.partsMaster[1]);}finally{window.confirm=confirm;}
            const corrected={value:price.value,label:summary.textContent};row.querySelector('.part-use-master-price').click();const explicit={value:price.value,label:summary.textContent};
            price.value='';price.dispatchEvent(new Event('input',{bubbles:true}));model.value='a';model.dispatchEvent(new Event('input',{bubbles:true}));const blank=price.value;
            app.addPartRow(null,true);const automatic=document.querySelectorAll('.part-row')[1];automatic.querySelector('.p-name').value='シール';automatic.querySelector('.p-model').value='a';automatic.querySelector('.p-model').dispatchEvent(new Event('input'));
            const autoPrice=automatic.querySelector('.p-price').value,autoLabel=automatic.querySelector('summary').textContent;app.closeModal();return {zero,typed,corrected,explicit,blank,autoPrice,autoLabel};
        })()`);
        assert.equal(result.zero,'0');assert.equal(result.typed,'123');assert.equal(result.corrected.value,'123');assert.match(result.corrected.label,/123円/);assert.equal(result.explicit.value,'500');assert.match(result.explicit.label,/500円/);assert.equal(result.blank,'');assert.equal(result.autoPrice,'200');assert.match(result.autoLabel,/200円/);
    });
    await t.test('ambiguous columns can be chosen in preview and work category stays separate from occurrence type',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();inputFile('日付,機械名,作業内容,作業区分,区分,対応種別,ライン\\n2026-11-01,入力ポンプ,列確認,電気,定期,突発,1');
            await app.refreshHistoryImportPreview();await app.processHistoryImportCSV();const blocked=!!document.querySelector('.history-import-errors');document.querySelector('.history-import-errors').close();
            const select=document.querySelector('[data-import-column=type]');select.value='5';select.dispatchEvent(new Event('change'));
            const confirm=window.confirm;try{window.confirm=()=>true;await app.processHistoryImportCSV();}finally{window.confirm=confirm;}
            const record=store.activeData.history.find(r=>r.errorContent==='列確認');return {blocked,sudden:record.isSudden,category:record.category};
        })()`);
        assert.deepEqual(result,{blocked:true,sudden:true,category:'electric'});
    });
    await t.test('Shift_JIS and UTF-8 previews show decoded Japanese and fit on a narrow screen',async()=>{
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();
            // Shift_JIS: 日付,機械名,作業内容 / 2026-01-01,ポンプ,確認
            inputFile(Uint8Array.from([147,250,149,116,44,139,64,138,66,150,188,44,141,236,139,198,147,224,151,101,10,50,48,50,54,45,48,49,45,48,49,44,131,124,131,147,131,118,44,138,109,148,70]));
            await app.refreshHistoryImportPreview();const sjis=document.getElementById('hist-csv-preview').textContent;
            const encoding=document.getElementById('hist-csv-encoding');encoding.value='utf-8';await app.refreshHistoryImportPreview();const wrong=document.getElementById('hist-csv-preview').textContent;
            encoding.value='shift_jis';await app.refreshHistoryImportPreview();const explicit=document.getElementById('hist-csv-preview').textContent;
            inputFile('日付,機械名,作業内容\\n2026-01-02,ポンプ,確認');encoding.value='auto';await app.refreshHistoryImportPreview();
            const utf8=document.getElementById('hist-csv-preview').textContent,content=document.getElementById('modal-content');const layout={width:content.clientWidth,scroll:content.scrollWidth};
            app.closeModal();return {sjis,wrong,explicit,utf8,layout};
        })()`);
        assert.match(result.sjis,/Shift_JIS.*ポンプ.*確認/s);assert.doesNotMatch(result.sjis,/�/);assert.doesNotMatch(result.wrong,/先頭5件/);assert.match(result.explicit,/Shift_JIS.*確認/s);assert.match(result.utf8,/UTF-8.*ポンプ/s);assert.ok(result.layout.scroll<=result.layout.width+2,JSON.stringify(result.layout));
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    });
    await t.test('large review filters rows, retains focus and scroll, and applies one target across pages',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();const rows=Array.from({length:120},(_,i)=>'2026-10-01,入力ポンプ,IN-1,突発,'+(i===1?'大量0':'大量'+i));inputFile('日付,機械名,型式,区分,作業内容\\n'+rows.join('\\n'));await app.processHistoryImportCSV();
            const dialog=document.querySelector('.history-import-review'),list=dialog.querySelector('.history-import-review-list'),filter=dialog.querySelector('.history-import-review-filter select');
            const firstCount=list.querySelectorAll('section').length;
            const select=list.querySelector('[data-import-control=target]');select.focus();select.value='in2';select.dispatchEvent(new Event('change'));
            const targetFocus=document.activeElement.dataset.importControl;
            list.scrollTop=200;const check=list.querySelector('[data-import-control=include]');check.focus({preventScroll:true});const scrollBefore=list.scrollTop;check.click();
            const retained={focus:document.activeElement.dataset.importControl,scroll:list.scrollTop,checked:list.querySelector('input').checked};
            list.querySelector('.history-import-bulk-target').click();
            const status=dialog.querySelector('[role=status]').textContent,bulk=dialog.querySelector('.history-import-bulk-status').textContent;
            filter.value='unresolved';filter.dispatchEvent(new Event('change'));const unresolved=list.querySelectorAll('section').length;
            filter.value='all';filter.dispatchEvent(new Event('change'));list.querySelector('input').click();
            filter.value='duplicates';filter.dispatchEvent(new Event('change'));const duplicates=list.querySelectorAll('section').length;
            dialog.close();app.closeModal();return {firstCount,targetFocus,scrollBefore,retained,status,bulk,unresolved,duplicates};
        })()`);
        assert.equal(result.firstCount,50);assert.equal(result.targetFocus,'target');assert.equal(result.retained.focus,'include');assert.equal(result.retained.scroll,result.scrollBefore);assert.equal(result.retained.checked,false);assert.match(result.status,/取り込み先未選択 0/);assert.match(result.bulk,/119行/);assert.equal(result.unresolved,0);assert.equal(result.duplicates,1);
    });
    await t.test('all row errors can be paged and downloaded without partial saves',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();const before=store.activeData.history.length;inputFile('日付,機械名,作業内容,作業時間\\n'+Array.from({length:30},()=>',,,bad').join('\\n'));await app.processHistoryImportCSV();
            const dialog=document.querySelector('.history-import-errors'),list=dialog.querySelector('.history-import-review-list');const first=list.querySelectorAll('section').length,text=dialog.textContent;
            [...dialog.querySelectorAll('button')].find(b=>b.textContent==='次へ').click();const second=list.querySelectorAll('section').length;
            const download=app.downloadCSV;let csv;try{app.downloadCSV=(name,text)=>csv=text;[...dialog.querySelectorAll('button')].find(b=>b.textContent==='エラー一覧をCSV保存').click();}finally{app.downloadCSV=download;}
            dialog.close();app.closeModal();return {first,second,text,csv,unchanged:store.activeData.history.length===before};
        })()`);
        assert.equal(result.first,50);assert.equal(result.second,50);assert.match(result.text,/30行・120件/);assert.equal(result.csv.split('\r\n').length,121);assert.match(result.csv,/"31","作業内容"/);assert.equal(result.unchanged,true);
    });
});

test('import refinements: machine choices, duplicate review, dates, part prices and chart restoration', {timeout:180000}, async t=>{
    const h=await launchHarness();t.after(()=>h.close());const {page}=h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook();await maintenanceLazyFeatures.loadPhotos();
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machineCategories=['循環'];
            store.activeData.machines=[{id:'im1',name:'取込ポンプ',model:'IP-1',lineNo:'1',category:'循環'},{id:'im2',name:'取込ポンプ',model:'IP-1',lineNo:'2',category:'循環'}];
            store.activeData.tasks=[];store.activeData.history=[];
            store.activeData.partsMaster=[{name:'シール',model:'a',price:200,priceRaw:'200',unit:'個'}];
        });app.updateDataLists();
        window.setImportFile=text=>{const d=new DataTransfer();d.items.add(new File([text],'review.csv',{type:'text/csv'}));document.getElementById('hist-csv-upload').files=d.files;};
    })()`);
    await t.test('ambiguous equipment requires a choice, cancel writes nothing, and the chosen line is saved',async()=>{
        const opened=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();setImportFile('日付,機械名,型式,区分,作業内容,作業時間,作業者\\n2026/1/2,取込ポンプ,IP-1,突発,CSV選択確認,12.5,田中');await app.processHistoryImportCSV();
            const dialog=document.querySelector('.history-import-review');const result={disabled:document.getElementById('history-import-review-save').disabled,count:store.activeData.history.length,options:dialog.querySelector('[data-import-control=target]').options.length};
            [...dialog.querySelectorAll('button')].find(b=>b.textContent==='キャンセル').click();return result;
        })()`);
        assert.equal(opened.disabled,true);assert.equal(opened.count,0);assert.equal(opened.options,4);
        await page.evaluate('app.processHistoryImportCSV()');
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        const chosen=await page.evaluate(`(()=>{const dialog=document.querySelector('.history-import-review'),select=dialog.querySelector('[data-import-control=target]');select.value='im2';select.dispatchEvent(new Event('change',{bubbles:true}));return {disabled:document.getElementById('history-import-review-save').disabled,width:dialog.clientWidth,scroll:dialog.scrollWidth};})()`);
        assert.equal(chosen.disabled,false);assert.ok(chosen.scroll<=chosen.width+2,JSON.stringify(chosen));
        await page.evaluate("document.getElementById('history-import-review-save').click()");await page.waitFor("!document.querySelector('.history-import-review') && store.activeData.history.length===1",'selected CSV import');
        assert.equal(await page.evaluate('store.activeData.history[0].machineId'),'im2');
        assert.equal(await page.evaluate('store.activeData.history[0].date'),'2026-01-02');
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    });
    await t.test('duplicate differences are visible, failed save preserves choices, and retry adds exactly one record',async()=>{
        const preview=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();setImportFile('日付,機械名,型式,区分,作業内容,作業時間,作業者,ライン,交換部品\\n2026-01-02,取込ポンプ,IP-1,突発,CSV選択確認,12.5,鈴木,2,シール [a] x1 個 @0');await app.processHistoryImportCSV();
            const dialog=document.querySelector('.history-import-review');return {text:dialog.textContent,checked:dialog.querySelector('input[type=checkbox]').checked};
        })()`);
        assert.equal(preview.checked,false);assert.match(preview.text,/作業者：田中 → 鈴木/);assert.match(preview.text,/部品：未入力 →/);
        const failed=await page.evaluate(`(async()=>{
            const check=document.querySelector('.history-import-review input[type=checkbox]');check.click();
            const save=store.runAtomicSaveBatch,alert=window.alert;let message='';
            try {store.runAtomicSaveBatch=async()=>{throw new Error('保存失敗の確認')};window.alert=m=>message=m;await document.getElementById('history-import-review-save').onclick();return {message,count:store.activeData.history.length,checked:document.querySelector('.history-import-review input').checked};}
            finally{store.runAtomicSaveBatch=save;window.alert=alert;}
        })()`);
        assert.equal(failed.count,1);assert.equal(failed.checked,true);assert.match(failed.message,/保存失敗/);
        await page.evaluate("document.getElementById('history-import-review-save').click()");await page.waitFor("!document.querySelector('.history-import-review') && store.activeData.history.length===2",'duplicate retry');
        assert.deepEqual(await page.evaluate("store.activeData.history.map(r=>r.workers[0])"),['田中','鈴木']);
        assert.equal(await page.evaluate('store.activeData.history[1].replacedParts[0].price'),0);
    });
    await t.test('invalid dates stop before any write while leap-day and slash formats import correctly',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();const alert=window.alert,confirm=window.confirm,messages=[];const before=store.activeData.history.length;
            try {window.alert=m=>messages.push(m);window.confirm=()=>true;
                setImportFile('日付,機械名,型式,区分,作業内容,ライン\\n2026-02-30,取込ポンプ,IP-1,突発,日付確認,2');await app.processHistoryImportCSV();const unchanged=store.activeData.history.length===before;messages.push(document.querySelector('.history-import-errors').textContent);document.querySelector('.history-import-errors').close();
                setImportFile('日付,機械名,型式,区分,作業内容,ライン\\n２０２４／２／２９,取込ポンプ,IP-1,突発,閏日確認,2');await app.processHistoryImportCSV();
                return {unchanged,messages,date:store.activeData.history.find(r=>r.errorContent==='閏日確認').date};
            }finally{window.alert=alert;window.confirm=confirm;}
        })()`);
        assert.equal(result.unchanged,true);assert.match(result.messages[0],/2行目/);assert.equal(result.date,'2024-02-29');
    });
    await t.test('zero prices remain editable and survive save and CSV export while unknown prices remain empty',async()=>{
        const before=await page.evaluate(`(async()=>{
            await store.runAtomicSaveBatch(()=>store.activeData.history.push({id:'price-record',machineId:'im2',date:'2026-11-01',isSudden:true,errorContent:'単価確認',workTime:10,category:'parts',workers:['田中'],photos:[],replacedParts:[{name:'シール',model:'a',count:2,unit:'個',price:0},{name:'未登録品',model:'z',count:1,unit:'個',price:null}]}));
            app.openHistoryEditForm('price-record');return {values:[...document.querySelectorAll('#s-parts-container .p-price')].map(n=>n.value),labels:[...document.querySelectorAll('.part-price-editor summary')].map(n=>n.textContent)};
        })()`);
        assert.deepEqual(before.values,['0','']);assert.match(before.labels[0],/0円/);
        await page.evaluate("document.getElementById('e-notes').value='無償交換確認';app.saveModalData('edit-history')");
        const after=await page.evaluate(`(()=>{
            const record=store.activeData.history.find(r=>r.id==='price-record');app.switchView('history');app.clearCurrentViewSearchAndFilters();document.getElementById('hist-filter-period').value='all';
            const download=app.downloadCSV;let csv='';try{app.downloadCSV=(name,text)=>csv=text;app.exportHistoryAsCSV();}finally{app.downloadCSV=download;}
            return {prices:record.replacedParts.map(p=>p.price),cost:app.calculateHistoryPartCost(record),csv};
        })()`);
        assert.deepEqual(after.prices,[0,null]);assert.equal(after.cost,0);assert.match(after.csv,/@0/);
    });
    await t.test('cost table and chart tooltips split the same part by actual unit price and reconcile to the total',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.switchView('analysis');app.costDrillDownCategory=null;
            const record={machineId:'im2',workTime:0,replacedParts:[{name:'シール',model:'a',price:0,count:2,unit:'個'},{name:'シール',model:'a',price:100,count:1,unit:'個'},{name:'シール',model:'a',price:200,count:1,unit:'個'}]};
            app.renderMachineCostAnalysis([record]);await new Promise(r=>setTimeout(r,300));
            const cells=document.querySelectorAll('#analysis-container tbody tr:first-child td');const chart=Chart.getChart(document.getElementById('cost-ranking-chart'));
            const tooltip=chart.options.plugins.tooltip.callbacks.afterBody([{datasetIndex:0,dataIndex:0}]);
            return {total:cells[1].textContent,title:cells[2].title,tooltip,chart:chart.data.datasets[0].data[0]};
        })()`);
        assert.equal(result.total,'¥300');assert.equal(result.chart,300);
        for(const expected of ['¥0 × 2個 = ¥0','¥100 × 1個 = ¥100','¥200 × 1個 = ¥200']){assert.ok(result.title.includes(expected),result.title);assert.ok(result.tooltip.includes(expected),result.tooltip);}
    });
    await t.test('chart return restores expanded groups, both page sizes and nested scroll after back and completion',async()=>{
        await page.send('Emulation.setDeviceMetricsOverride',{width:900,height:650,deviceScaleFactor:1,mobile:false});
        const before=await page.evaluate(`(async()=>{
            const today=app.getLocalDateString(),day=n=>new Date(app.parseTaskScheduleDate(today)+n*86400000).toISOString().slice(0,10);
            await store.runAtomicSaveBatch(()=>{store.activeData.tasks=[{id:'long-task',machineId:'im2',startDate:day(-120),periodDays:1,content:'日次点検',workers:['田中']},...Array.from({length:52},(_,i)=>({id:'extra-'+i,machineId:'im2',startDate:day(-2),periodDays:30,content:'補助点検'+i,workers:['田中']}))];});
            app.openEquipmentWorkspace('im2');const root=document.getElementById('modal-content'),group=root.querySelector('[data-task-id="long-task"]');group.open=true;group.querySelector(':scope > button').click();
            root.querySelector('.equipment-overdue > details > div > button').click();
            const overdue=root.querySelector('.equipment-overdue-rows');overdue.scrollTop=360;root.scrollTop=50;
            const state=app.captureEquipmentWorkspaceState(root);group.querySelectorAll('.workspace-row button')[60].click();return state;
        })()`);
        assert.equal(before.groups['long-task'].shown,100);assert.equal(before.groupsShown,53);
        await page.evaluate("document.querySelector('.equipment-return-button').click()");await page.waitFor("document.getElementById('modal-container').dataset.modalType==='equipment-workspace'",'manual chart return');await sleep(100);
        const back=await page.evaluate("app.captureEquipmentWorkspaceState(document.getElementById('modal-content'))");
        assert.equal(back.groups['long-task'].open,true);assert.equal(back.groups['long-task'].shown,100);assert.equal(back.groupsShown,53);assert.equal(back.overdueScrollTop,before.overdueScrollTop);
        const saved=await page.evaluate(`(async()=>{
            document.querySelectorAll('[data-task-id=long-task] .workspace-row button')[60].click();document.getElementById('c-work-time').value='0';document.getElementById('c-workers').value='田中';document.getElementById('c-category').value='clean';
            const alert=window.alert,messages=[];try{window.alert=m=>messages.push(m);await app.saveModalData('complete');return {messages,error:document.querySelector('.edit-save-error')?.textContent,invalid:[...document.querySelectorAll('#complete-form :invalid')].map(n=>[n.id,n.value,n.validationMessage]),type:document.getElementById('modal-container').dataset.modalType};}finally{window.alert=alert;}
        })()`);
        assert.deepEqual(saved.messages,[],JSON.stringify(saved));assert.ok(!saved.error,JSON.stringify(saved));
        await sleep(300);
        const restored=await page.evaluate("({type:document.getElementById('modal-container').dataset.modalType,hidden:document.getElementById('modal-overlay').classList.contains('hidden'),count:store.activeData.history.length})");
        assert.equal(restored.type,'equipment-workspace',JSON.stringify({saved,restored}));
        const after=await page.evaluate("({state:app.captureEquipmentWorkspaceState(document.getElementById('modal-content')),count:app.getEquipmentWorkspace('im2').overdue.filter(x=>x.task.id==='long-task').length})");
        assert.equal(after.count,119);assert.equal(after.state.groups['long-task'].open,true);assert.equal(after.state.groups['long-task'].shown,100);assert.equal(after.state.groupsShown,53);assert.equal(after.state.overdueScrollTop,back.overdueScrollTop);
    });
});

test('accuracy refinements: cost, comparison, CSV, saved conditions and grouped overdue dates', {timeout:180000}, async t=>{
    const h = await launchHarness(); t.after(()=>h.close()); const {page} = h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
        const today=app.getLocalDateString(), day=n=>new Date(app.parseTaskScheduleDate(today)+n*86400000).toISOString().slice(0,10);
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machineCategories=['包装'];
            store.activeData.machines=[{id:'ac-m',name:'確認ポンプ',model:'ACP-1',category:'包装',lineNo:'1'}];
            store.activeData.tasks=[{id:'ac-t',machineId:'ac-m',content:'週次点検',startDate:day(-28),periodDays:7,workers:['田中']}];
            store.activeData.history=[{id:'ac-h',machineId:'ac-m',date:'2026-02-15',workTime:12.5,workers:['田中',' 田中 ','鈴木'],isSudden:true,category:'parts',machineCategory:'包装',errorContent:'交換',photos:[],replacedParts:[{name:'シール',count:2,price:100}]}];
        }); app.updateDataLists(); app.syncLaborRateInputs(3600);
    })()`);
    await t.test('history, cost table and cost chart use identical deduplicated labor costs', async()=>{
        const result=await page.evaluate(`(async()=>{
            app.switchView('history');app.clearCurrentViewSearchAndFilters();document.getElementById('hist-filter-period').value='all';app.renderHistory();
            const history=document.querySelector('.history-metric-cell.cost').textContent;
            app.switchView('analysis');app.costDrillDownCategory=null;app.renderMachineCostAnalysis(store.activeData.history);
            await new Promise(r=>setTimeout(r,300));
            const cells=[...document.querySelectorAll('#analysis-container tbody tr:first-child td')].map(n=>n.textContent.trim());
            const chart=Chart.getChart(document.getElementById('cost-ranking-chart')).data.datasets.map(d=>d.data[0]);
            return {history,cells,chart};
        })()`);
        assert.match(result.history,/1,700/); assert.equal(result.cells[1],'¥1,700'); assert.equal(result.cells[3],'¥1,500');
        assert.equal(result.cells[4],'12.5 分'); assert.deepEqual(result.chart,[200,1500]);
    });
    await t.test('comparison prompts retain independent ranges, show the dates and filter each side', async()=>{
        const result=await page.evaluate(`(()=>{
            app.openTroubleComparisonModal();const prompt=window.prompt;
            try {for(const [side,start,end] of [['a','2026-01-01','2026-01-31'],['b','2026-02-01','2026-02-28']]) {
                const answers=[start,end];window.prompt=()=>answers.shift();const select=document.getElementById('compare-period-'+side);select.value='custom_range';select.dispatchEvent(new Event('change',{bubbles:true}));
            }}finally{window.prompt=prompt;}
            app.runTroubleComparison();return {a:document.getElementById('compare-range-a').textContent,b:document.getElementById('compare-range-b').textContent,result:document.getElementById('compare-result-container').textContent};
        })()`);
        assert.match(result.a,/2026-01-01 〜\s+2026-01-31（31日間）/); assert.match(result.b,/2026-02-01 〜\s+2026-02-28（28日間）/);
        assert.match(result.result,/12.5/); assert.match(result.result,/新規発生・＋1件/);
    });
    await t.test('zero baseline shows new totals, zero-to-zero stays neutral and a changed period clears stale results', async()=>{
        const text=await page.evaluate("document.getElementById('compare-result-container').textContent");
        assert.match(text,/新規発生・＋12.5分（合計）/); assert.doesNotMatch(text,/100.0%/);
        const changed=await page.evaluate(`(()=>{
            app.setPeriodDateState({start:'2026-01-01',end:'2026-01-31'},'compare-b');app.runTroubleComparison();
            const empty=document.getElementById('compare-result-container').textContent;
            const select=document.getElementById('compare-period-b');select.value='this_month';select.dispatchEvent(new Event('change',{bubbles:true}));
            return {empty,stale:document.getElementById('compare-result-container').textContent};
        })()`);
        assert.match(changed.empty,/変化なし/);assert.doesNotMatch(changed.empty,/新規発生・/);assert.match(changed.stale,/分析を実行/);
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        const layout=await page.evaluate("({width:document.getElementById('modal-content').clientWidth,scroll:document.getElementById('modal-content').scrollWidth})");
        assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout));
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page.evaluate('app.closeModal()');
    });
    await t.test('CSV rejects invalid minutes before saving and imports fractional minutes exactly', async()=>{
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();const alert=window.alert,confirm=window.confirm,messages=[];let confirmations=0;
            const file=text=>{const transfer=new DataTransfer();transfer.items.add(new File([text],'accuracy.csv',{type:'text/csv'}));document.getElementById('hist-csv-upload').files=transfer.files;};
            const header='日付,機械名,型式,区分,作業内容,作業時間\\n';
            const before=store.activeData.history.length;
            try {window.alert=m=>messages.push(m);window.confirm=()=>{confirmations++;return true;};
                file(header+'2026-11-12,確認ポンプ,ACP-1,突発,CSV確認,30min');await app.processHistoryImportCSV();
                const rejected=store.activeData.history.length===before && confirmations===0;messages.push(document.querySelector('.history-import-errors').textContent);document.querySelector('.history-import-errors').close();
                file(header+'2026-11-12,確認ポンプ,ACP-1,突発,CSV確認,12.5');await app.processHistoryImportCSV();
                return {rejected,messages,time:store.activeData.history.find(r=>r.errorContent==='CSV確認').workTime};
            } finally {window.alert=alert;window.confirm=confirm;}
        })()`);
        assert.equal(result.rejected,true);assert.match(result.messages[0],/2行目/);assert.equal(result.time,12.5);
    });
    await t.test('saved-condition controls update, rename, restore a deletion and fit on mobile', async()=>{
        const result=await page.evaluate(`(async()=>{
            app.closeModal();app.switchView('history');document.getElementById('search-scope').value='view';app.updateSearchScope();app.setSearchWorkspaceCollapsed(false);
            document.getElementById('global-search').value='初期';app.saveNamedSearch('確認条件');
            document.getElementById('global-search').value='CSV確認';document.getElementById('saved-search-update').click();
            document.getElementById('saved-search-name').value='更新済み';document.getElementById('saved-search-rename').click();
            document.getElementById('saved-search-delete').click();const undoVisible=!document.getElementById('saved-search-undo').hidden;
            document.getElementById('saved-search-undo').click();document.getElementById('global-search').value='';await app.applyNamedSearch('更新済み');
            document.querySelector('.saved-search-controls').open=true;
            return {undoVisible,query:document.getElementById('global-search').value,undoHidden:document.getElementById('saved-search-undo').hidden};
        })()`);
        assert.equal(result.undoVisible,true);assert.equal(result.query,'CSV確認');assert.equal(result.undoHidden,true);
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await sleep(200);
        const layout=await page.evaluate("({width:document.querySelector('.saved-search-panel').clientWidth,scroll:document.querySelector('.saved-search-panel').scrollWidth})");
        assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout));
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        await reloadApp(page,'updated named condition persists');assert.equal(await page.evaluate("app.getNamedSearches().find(p=>p.name==='更新済み').query"),'CSV確認');
    });
    await t.test('overdue dates are folded into one task and completion applies only to the selected occurrence', async()=>{
        const before=await page.evaluate(`(()=>{
            app.openEquipmentWorkspace('ac-m');const groups=[...document.querySelectorAll('.equipment-overdue-group')];
            const snapshot={groups:groups.length,open:groups[0].open,summary:groups[0].querySelector('summary').textContent,count:app.getEquipmentWorkspace('ac-m').overdue.length};
            groups[0].open=true;const rows=groups[0].querySelectorAll('.workspace-row');snapshot.expected=app.getEquipmentWorkspace('ac-m').overdue[1].date;rows[1].querySelector('button').click();
            snapshot.selected=document.getElementById('c-scheduled-date').value;document.getElementById('c-work-time').value='0';document.getElementById('c-category').value='clean';return snapshot;
        })()`);
        assert.equal(before.groups,1);assert.equal(before.open,false);assert.equal(before.count,4);assert.match(before.summary,/未完了 4 回/);assert.equal(before.selected,before.expected);
        await page.evaluate("app.saveModalData('complete')");await page.waitFor("document.getElementById('modal-container').dataset.modalType==='equipment-workspace'",'grouped chart after completion');
        const after=await page.evaluate("({count:app.getEquipmentWorkspace('ac-m').overdue.length,dates:app.getEquipmentWorkspace('ac-m').overdue.map(x=>x.date),summary:document.querySelector('.equipment-overdue-group > summary').textContent})");
        assert.equal(after.count,3);assert.equal(after.dates.includes(before.selected),false);assert.match(after.summary,/未完了 3 回/);
    });
});

test('consistency improvements: real date presets, cross-view totals, safe return, zero time, folding and undo', {timeout:180000}, async t=>{
    const h=await launchHarness();t.after(()=>h.close());const {page}=h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook();await maintenanceLazyFeatures.loadPhotos();
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machineCategories=['包装'];store.activeData.machines=[{id:'cx-m',name:'確認ポンプ',model:'CP-1',lineNo:'1',category:'包装'}];
            store.activeData.tasks=[{id:'cx-t',machineId:'cx-m',startDate:app.getLocalDateString(),periodDays:7,content:'定期点検',workers:['田中']}];
            store.activeData.history=[{id:'cx-h',machineId:'cx-m',date:'2026-11-14',lineNo:'1',machineCategory:'包装',errorContent:'シール交換',cause:'摩耗',notes:'交換確認',workTime:0,workers:['田中'],category:'clean',isSudden:true,photos:[],replacedParts:[]}];
        });app.updateDataLists();
    })()`);
    await t.test('actual custom_range dates restore and persist without changing another view',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.switchView('history');document.getElementById('search-scope').value='view';app.updateSearchScope();
            const ask=window.prompt;try {const answers=['2026-11-01','2026-11-30'];window.prompt=()=>answers.shift();const el=document.getElementById('hist-filter-period');el.value='custom_range';app.onPeriodChange(el,()=>app.renderHistory());}finally{window.prompt=ask;}
            app.saveNamedSearch('日付込み');app.switchView('worktime');
            try {const answers=['2026-10-01','2026-10-31'];window.prompt=()=>answers.shift();const el=document.getElementById('worktime-filter-period');el.value='custom_range';el.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.prompt=ask;}
            if(document.getElementById('worktime-filter-period').value!=='custom_range')throw new Error('Worktime period selection reverted');
            app.setPeriodDateState({start:'2026-09-01',end:'2026-09-30'},'history');
            await app.applyNamedSearch('日付込み');return {history:app.getPeriodDateState('history'),worktime:app.getPeriodDateState('worktime'),period:document.getElementById('hist-filter-period').value,visible:document.querySelector('.history-worktime-summary').textContent};
        })()`);
        assert.equal(result.history.start,'2026-11-01');assert.equal(result.history.end,'2026-11-30');assert.equal(result.worktime.start,'2026-10-01');assert.equal(result.period,'custom_range');assert.match(result.visible,/1\s*件/);
        await reloadApp(page,'date ranges persist');await page.evaluate("app.applyNamedSearch('日付込み')");
        assert.equal(await page.evaluate("app.getPeriodDateState('history').end"),'2026-11-30');
    });
    await t.test('dashboard, history, equipment and worktime use the same valid elapsed time',async()=>{
        const result=await page.evaluate(`(async()=>{
            const saved=store.activeData.history;
            try {
                const base={...saved[0],date:app.getLocalDateString()};store.activeData.history=[{...base,workTime:30.5},{...base,id:'cx-neg',workTime:-5},{...base,id:'cx-invalid',workTime:'30x'},{...base,id:'cx-guide',isManualGuide:true,workTime:999},{...base,id:'cx-periodic',taskId:'cx-t',isDokatei:true,workTime:15}];
                app.switchView('history');app.clearCurrentViewSearchAndFilters();document.getElementById('hist-filter-period').value='all';app.renderHistory();const history=document.querySelector('.history-worktime-summary').textContent;
                app.dashboardPeriod='all';app.renderDashboard();const dashboard=Number(document.querySelector('.dashboard-chart-card').textContent.split('合計:')[1].split('分')[0].trim());
                app.switchView('ranking');document.getElementById('ranking-filter-period').value='all';app.renderRanking();await new Promise(resolve=>setTimeout(resolve,250));const count=Chart.getChart(document.getElementById('ranking-freq-chart')).data.datasets[0].data.reduce((a,b)=>a+b,0);
                app.switchView('worktime');document.getElementById('worktime-filter-period').value='all';app.saveWorkTimePeriodSelection();app.setWorkTimeGroup('category');const c=app._workTimeEvidenceContext;const total=app.getWorkTimeEvidence(c.history,c.results,c.groupBy,c.machines).total;
                return {history,dashboard,count,total,equipment:app.getEquipmentWorkspace('cx-m').minutes};
            }finally{store.activeData.history=saved;}
        })()`);
        assert.equal(result.dashboard,45.5);assert.equal(result.total,45.5);assert.equal(result.equipment,45.5);assert.equal(result.count,3);assert.match(result.history,/4\s*件/);assert.match(result.history,/45\.5分合計/);
    });
    await t.test('search return refuses to leave while saving or while discard is declined',async()=>{
        await page.evaluate("app.openHistoryEditForm('cx-h')");
        const result=await page.evaluate(`(()=>{
            app._unifiedSearchReturn={query:'シール',period:'all'};document.getElementById('e-notes').value='未保存';
            app._modalSaveInProgress=true;app.reopenUnifiedSearchReturn();const busy=document.getElementById('modal-container').dataset.modalType;app._modalSaveInProgress=false;
            const durable=app.hasDurableEditDraft,ask=window.confirm;try{app.hasDurableEditDraft=()=>false;window.confirm=()=>false;app.reopenUnifiedSearchReturn();return {busy,type:document.getElementById('modal-container').dataset.modalType,value:document.getElementById('e-notes').value};}finally{app.hasDurableEditDraft=durable;window.confirm=ask;}
        })()`);
        assert.equal(result.busy,'edit-history');assert.equal(result.type,'edit-history');assert.equal(result.value,'未保存');
        await page.evaluate('app.reopenUnifiedSearchReturn()');await page.waitFor("document.getElementById('modal-container').dataset.modalType==='shift-notebook-search'",'search return');
        await page.evaluate('app.closeModal();app._unifiedSearchReturn=null');
    });
    await t.test('zero stays editable, negative time is rejected in all three forms and decimals persist',async()=>{
        await page.evaluate("app.openHistoryEditForm('cx-h')");
        assert.equal(await page.evaluate("document.getElementById('e-work-time').value"),'0');
        for(const [type,prefix,open] of [['edit-history','e',"app.openHistoryEditForm('cx-h')"],['complete','c',"app.openCompletionForm('cx-t',app.getLocalDateString())"],['sudden','s','app.openSuddenRecordModal()']]) {
            await page.evaluate(open);
            const result=await page.evaluate(`(async()=>{document.getElementById('${prefix}-work-time').value='-1';const before=JSON.stringify(store.activeData.history);await app.saveModalData('${type}');return {type:document.getElementById('modal-container').dataset.modalType,unchanged:before===JSON.stringify(store.activeData.history),message:document.getElementById('toast-container').textContent};})()`);
            assert.equal(result.type,type);assert.equal(result.unchanged,true);assert.match(result.message,/0以上/);
        }
        await page.evaluate("app.closeModal();app.openHistoryEditForm('cx-h');document.getElementById('e-notes').value='0分の確認';app.saveModalData('edit-history')");
        assert.equal(await page.evaluate("Number(store.activeData.history.find(r=>r.id==='cx-h').workTime)"),0);
        const decimal=await page.evaluate(`(async()=>{let record;await store.runAtomicSaveBatch(()=>{record=store.addHistoryRecord({...store.activeData.history[0],workTime:12.5});});return record.workTime;})()`);assert.equal(decimal,12.5);
    });
    await t.test('equipment sections remain compact and remember their open state after reload',async()=>{
        await page.evaluate("app.openEquipmentWorkspace('cx-m');document.querySelector('[data-equipment-section=history]').open=true");await sleep(100);
        const initial=await page.evaluate("({count:document.querySelectorAll('[data-equipment-section]').length,emptyOpen:document.querySelector('[data-equipment-section=guides]').open})");assert.equal(initial.count,5);assert.equal(initial.emptyOpen,false);
        await reloadApp(page,'equipment fold state');await page.evaluate("app.openEquipmentWorkspace('cx-m')");
        assert.equal(await page.evaluate("document.querySelector('[data-equipment-section=history]').open"),true);await page.evaluate('app.closeModal()');
    });
    await t.test('copy preview changes nothing, undo preserves later typing and removes untouched copied parts',async()=>{
        await page.evaluate(`(()=>{app.openSuddenRecordModal();document.getElementById('s-machine-id').value='cx-m';app.onSuddenMachineChange('cx-m');document.getElementById('s-machine-id').dispatchEvent(new Event('change',{bubbles:true}));})()`);
        const preview=await page.evaluate(`(()=>{
            const source={...store.activeData.history.find(r=>r.id==='cx-h'),cause:'摩耗',notes:'交換確認',workTime:12.5,replacedParts:[{name:'シール',count:2,unit:'個',price:0}]};app.showRecordReuseChoice(source,'s-');
            const check=document.querySelector('[data-reuse-field=parts]');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
            return {text:document.querySelector('.record-reuse-preview').textContent,cause:document.getElementById('s-cause').value};})()`);
        assert.match(preview.text,/空欄 → 摩耗/);assert.equal(preview.cause,'');
        const undone=await page.evaluate(`(()=>{
            document.querySelector('.record-reuse > button').click();const copied=document.getElementById('s-cause').value;
            const notes=document.getElementById('s-notes');notes.value='今回だけの処置';notes.dispatchEvent(new Event('input',{bubbles:true}));
            document.querySelector('.record-reuse-undo').click();return {copied,cause:document.getElementById('s-cause').value,notes:notes.value,parts:document.querySelectorAll('#s-parts-container .part-row').length,feedback:document.querySelector('.record-reuse-feedback').textContent};})()`);
        assert.equal(undone.copied,'摩耗');assert.equal(undone.cause,'');assert.equal(undone.notes,'今回だけの処置');assert.equal(undone.parts,0);assert.match(undone.feedback,/保持/);
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate('document.fonts.ready');await sleep(450);
        const layout=await page.evaluate("({width:document.querySelector('.record-reuse').clientWidth,scroll:document.querySelector('.record-reuse').scrollWidth})");assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout));
        await page.evaluate('app.closeModal()');
    });
});

test('six refinements isolate filters, reconcile time and preserve equipment editing context', { timeout: 180000 }, async t => {
    const harness = await launchHarness(); t.after(() => harness.close());
    const { page } = harness;
    await page.evaluate(`(async () => {
        await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
        const today=app.getLocalDateString(), day=n=>new Date(app.parseTaskScheduleDate(today)+n*86400000).toISOString().slice(0,10);
        await store.runAtomicSaveBatch(() => {
            store.activeData.machineCategories=['包装'];
            store.activeData.machines=[{id:'ref-machine',name:'検証ポンプ',model:'RP-1',lineNo:'1',category:'包装'}];
            store.activeData.tasks=[{id:'ref-task',machineId:'ref-machine',content:'点検',startDate:day(-14),periodDays:7,workers:['田中']}];
            store.activeData.history=[
                {id:'ref-history',machineId:'ref-machine',date:today,lineNo:'1',machineCategory:'包装',errorContent:'シール交換',cause:'摩耗',notes:'交換確認',workTime:30,workers:['田中','鈴木'],category:'parts',isSudden:true,photos:[],replacedParts:[]},
                {id:'ref-done',machineId:'ref-machine',taskId:'ref-task',scheduledDate:day(-7),date:day(-2),workTime:10,workers:['田中'],category:'clean',photos:[],replacedParts:[]}
            ];
        }); app.updateDataLists();
    })()`);
    await t.test('view presets and older snapshots leave unrelated views and date ranges intact', async () => {
        const result = await page.evaluate(`(async () => {
            app.switchView('history'); document.getElementById('search-scope').value='view'; app.updateSearchScope();
            document.getElementById('hist-filter-period').value='CUSTOM'; app.customStartDate='2026-10-01'; app.customEndDate='2026-10-31';
            document.getElementById('hist-filter-line').value='1'; document.getElementById('global-search').value='シール'; app.saveNamedSearch('履歴だけ');
            const key='maintenance-search-presets-v1:'+store.data.currentDepartmentId, old=JSON.parse(localStorage.getItem(key));
            old[0].props.todayWorkspaceFilters=null; old[0].props.workTimeGroupBy='category'; localStorage.setItem(key,JSON.stringify(old));
            app.switchView('worktime'); app.customStartDate='2026-09-01'; app.customEndDate='2026-09-30'; app.workTimeGroupBy='worker';
            app.getTodayWorkspaceFilters(); app.todayWorkspaceFilters={line:'1',worker:'田中'};
            await app.applyNamedSearch('履歴だけ');
            const historyDates=[app.customStartDate,app.customEndDate], untouched=app.todayWorkspaceFilters, group=app.workTimeGroupBy;
            app.switchView('worktime'); const workDates=[app.customStartDate,app.customEndDate]; app.switchView('history');
            return {historyDates,workDates,untouched,group,captured:Object.keys(app.captureNamedSearch('x').props)};
        })()`);
        assert.deepEqual(result.historyDates,['2026-10-01','2026-10-31']); assert.deepEqual(result.workDates,['2026-09-01','2026-09-30']);
        assert.deepEqual(result.untouched,{line:'1',worker:'田中'}); assert.equal(result.group,'worker'); assert.ok(!result.captured.includes('todayWorkspaceFilters'));
        const all = await page.evaluate(`(async () => {
            document.getElementById('search-scope').value='all'; app.updateSearchScope(); document.getElementById('notebook-search').value='シール'; app.saveNamedSearch('全体だけ');
            app.switchView('machines'); app.machineMaintenanceListFilters={status:'overdue',kind:'all',line:'1'};
            await app.applyNamedSearch('全体だけ');
            const result={view:app.currentView,filters:app.machineMaintenanceListFilters,type:document.getElementById('modal-container').dataset.modalType}; app.closeModal(); return result;
        })()`);
        assert.equal(all.view,'machines'); assert.equal(all.filters.status,'overdue'); assert.equal(all.type,'shift-notebook-search');
    });
    await t.test('collapsed search reports active conditions without adding toolbar height', async () => {
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        const state = await page.evaluate(`(() => {
            app.switchView('history'); document.getElementById('search-scope').value='view'; app.updateSearchScope();
            document.getElementById('hist-filter-period').value='all'; document.getElementById('hist-filter-line').value='1';
            document.getElementById('global-search').value='シール'; app.setSearchWorkspaceCollapsed(true);
            const badge=document.getElementById('search-condition-summary');
            const result={text:badge.textContent,hidden:badge.hidden,title:badge.getAttribute('aria-label'),height:document.querySelector('.header-search-workspace').getBoundingClientRect().height};
            badge.click(); result.expanded=!document.getElementById('search-workspace-controls').hidden;
            app.clearCurrentViewSearchAndFilters(); return result;
        })()`);
        assert.match(state.text,/条件 2 件/); assert.equal(state.hidden,false); assert.match(state.title,/シール/); assert.equal(state.expanded,true); assert.ok(state.height<=32,JSON.stringify(state));
    });
    await t.test('legacy anomalies agree across table, graph, evidence and equipment totals without rewriting records', async () => {
        const result = await page.evaluate(`(() => {
            const saved=store.activeData.history; const today=app.getLocalDateString();
            try {
                store.activeData.history=[
                    {...saved[0],id:'duplicate',workers:['田中',' 田中 ','鈴木']},
                    {...saved[0],id:'negative',workTime:-20},
                    {...saved[0],id:'invalid',workTime:'30x'},
                    {...saved[0],id:'guide-only',isManualGuide:true,workTime:999}
                ]; const raw=JSON.stringify(store.activeData.history);
                app.switchView('worktime'); document.getElementById('worktime-filter-period').value='all'; app.saveWorkTimePeriodSelection(); app.setWorkTimeGroup('worker'); app.renderWorkTime('');
                const c=app._workTimeEvidenceContext, evidence=app.getWorkTimeEvidence(c.history,c.results,c.groupBy,c.machines);
                const table=c.results.reduce((n,r)=>n+r.totalTime,0);
                const trend=Chart.getChart(document.getElementById('worktime-trend-chart')).data.datasets.reduce((n,d)=>n+d.data.reduce((a,b)=>a+b,0),0);
                const download=app.downloadCSV; let csv='';
                try {app.downloadCSV=(name,text)=>{csv=text};app.exportWorkTimeAsCSV();}finally{app.downloadCSV=download;}
                const csvTotal=csv.split('\\n').slice(1).reduce((n,row)=>n+Number(row.split(',')[1].replace(/"/g,'')),0);
                app.openWorkTimeGraph();
                const graph=Object.values(app._currentGraphData.total).reduce((n,x)=>n+x,0); app.closeModal();
                const chart=app.getEquipmentWorkspace('ref-machine');
                return {total:evidence.total,table,graph,trend,csvTotal,elapsed:chart.minutes,duplicate:evidence.duplicateWorkers.length,invalid:evidence.unknownTimes.length,guides:evidence.guideOnly.length,unchanged:JSON.stringify(store.activeData.history)===raw};
            } finally {store.activeData.history=saved;}
        })()`);
        assert.deepEqual(result,{total:60,table:60,graph:60,trend:60,csvTotal:60,elapsed:30,duplicate:1,invalid:2,guides:1,unchanged:true});
    });
    await t.test('past due occurrence opens with its original date and successful save returns to refreshed chart', async () => {
        const before=await page.evaluate(`(() => {
            app._unifiedSearchReturn=null; app.openEquipmentWorkspace('ref-machine');
            const data=app.getEquipmentWorkspace('ref-machine'); document.querySelector('.equipment-overdue .workspace-row button').click();
            const result={overdue:data.overdue.length,scheduled:document.getElementById('c-scheduled-date').value,expected:data.overdue[0].date,back:!!document.querySelector('.equipment-return-button')};
            document.getElementById('c-work-time').value='12'; document.getElementById('c-category').value='clean'; return result;
        })()`);
        assert.equal(before.overdue,1); assert.equal(before.scheduled,before.expected); assert.equal(before.back,true);
        await page.evaluate("app.saveModalData('complete')");
        await page.waitFor("document.getElementById('modal-container').dataset.modalType==='equipment-workspace'",'chart after completion');
        assert.equal(await page.evaluate("app.getEquipmentWorkspace('ref-machine').overdue.length"),0);
        assert.match(await page.evaluate("document.querySelector('.equipment-overdue h3').textContent"),/0 件/);
    });
    await t.test('history return respects unsaved changes and a failed save, then refreshes after a successful edit', async () => {
        await page.evaluate(`(() => {
            app.openEquipmentWorkspace('ref-machine'); const root=document.getElementById('modal-content');root.scrollTop=120;
            [...root.querySelectorAll('button')].find(b=>b.textContent.startsWith('対応履歴')).click();
            [...document.querySelectorAll('#modal-content .workspace-row')].find(r=>r.textContent.includes('シール交換')).querySelector('button').click();
        })()`);
        assert.equal(await page.evaluate("document.getElementById('modal-container').dataset.modalType"),'edit-history');
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        const footer=await page.evaluate(`(() => { const f=document.querySelector('.modal-footer');return {width:f.clientWidth,scroll:f.scrollWidth,button:document.querySelector('.equipment-return-button').getBoundingClientRect().height}; })()`);
        assert.ok(footer.scroll<=footer.width+2 && footer.button<50,JSON.stringify(footer));
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        const blocked=await page.evaluate(`(() => {
            document.getElementById('e-notes').value='変更後の処置'; const old=app.hasDurableEditDraft, ask=window.confirm;
            try { app.hasDurableEditDraft=()=>false; window.confirm=()=>false; document.querySelector('.equipment-return-button').click(); return document.getElementById('modal-container').dataset.modalType; }
            finally {app.hasDurableEditDraft=old;window.confirm=ask;}
        })()`);
        assert.equal(blocked,'edit-history');
        const failed=await page.evaluate(`(async () => {
            const original=store.runAtomicSaveBatch; try {store.runAtomicSaveBatch=async()=>{throw new Error('検証用の保存失敗')};await app.saveModalData('edit-history');return {type:document.getElementById('modal-container').dataset.modalType,value:document.getElementById('e-notes').value,back:!!document.querySelector('.equipment-return-button')};}finally{store.runAtomicSaveBatch=original;}
        })()`);
        assert.equal(failed.type,'edit-history'); assert.equal(failed.value,'変更後の処置'); assert.equal(failed.back,true);
        await page.evaluate("app.saveModalData('edit-history')");
        await page.waitFor("document.getElementById('modal-container').dataset.modalType==='equipment-workspace'",'chart after history save');
        assert.equal(await page.evaluate("store.activeData.history.find(h=>h.id==='ref-history').notes"),'変更後の処置');
        const back = await page.evaluate(`(() => { document.querySelector('#modal-content section:not(.equipment-overdue)');
            [...document.querySelectorAll('#modal-content button')].find(b=>b.textContent.startsWith('対応履歴')).click(); document.querySelector('.equipment-return-button').click(); return document.getElementById('modal-container').dataset.modalType; })()`);
        assert.equal(back,'equipment-workspace'); await page.evaluate('app.closeModal()');
    });
    await t.test('reuse chooses fields and requires an explicit choice for duration and workers, including old copy actions', async () => {
        await page.evaluate(`(() => { app.openSuddenRecordModal(); document.getElementById('s-machine-id').value='ref-machine'; app.onSuddenMachineChange('ref-machine'); document.getElementById('s-machine-id').dispatchEvent(new Event('change',{bubbles:true})); })()`);
        const copied=await page.evaluate(`(() => {
            document.getElementById('s-work-time').value='';document.getElementById('s-workers').value='';document.getElementById('s-notes').value='今回の処置';
            store.activeData.history.find(h=>h.id==='ref-history').replacedParts=[{name:'シール',model:'P-1',count:2,unit:'個',price:0}];
            app.applyHistoryAssistCandidate('ref-history','s-','full');
            const before=document.getElementById('s-cause').value;
            document.querySelector('.record-reuse button').click();
            const after={cause:document.getElementById('s-cause').value,notes:document.getElementById('s-notes').value,time:document.getElementById('s-work-time').value,workers:document.getElementById('s-workers').value,partsBefore:document.querySelectorAll('#s-parts-container .part-row').length,before};
            document.querySelector('[data-reuse-field="work-time"]').checked=true;document.querySelector('[data-reuse-field="workers"]').checked=true;
            document.querySelector('[data-reuse-field="parts"]').checked=true;
            document.querySelector('[data-reuse-field="parts"]').dispatchEvent(new Event('change',{bubbles:true}));
            document.querySelector('.record-reuse button').click(); document.querySelector('.record-reuse button').click(); after.optedTime=document.getElementById('s-work-time').value;after.optedWorkers=document.getElementById('s-workers').value;after.partsAfter=document.querySelectorAll('#s-parts-container .part-row').length;return after;
        })()`);
        assert.equal(copied.before,'');assert.equal(copied.cause,'摩耗');assert.equal(copied.notes,'今回の処置');assert.equal(copied.time,'');assert.equal(copied.workers,'');assert.equal(copied.optedTime,'30');assert.equal(copied.optedWorkers,'田中, 鈴木');assert.equal(copied.partsBefore,0);assert.equal(copied.partsAfter,1);
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        await page.evaluate('document.fonts.ready'); await sleep(450);
        const layout=await page.evaluate("({width:document.querySelector('.record-reuse').clientWidth,scroll:document.querySelector('.record-reuse').scrollWidth})");
        assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout)); await page.evaluate('app.closeModal()');
    });
});

test('edit safety: failed save, drafts, structural repair, and concurrent tabs', { timeout: 180000 }, async t => {
    const harness = await launchHarness(); t.after(() => harness.close());
    const { page } = harness;
    await t.test('ToDo failure retains input and retry creates exactly one record', async () => {
        const result = await page.evaluate(`(async () => {
            await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
            app.openKanbanTodoModal();
            const title = document.getElementById('kt-task-title'); title.value = 'retry-todo'; title.dispatchEvent(new Event('input', { bubbles: true }));
            const write = store.writeSaveSnapshot; store.writeSaveSnapshot = async () => { throw Error('simulated quota'); };
            const before = store.activeData.localTodos.length;
            await app.saveKanbanTodoFromModal();
            const failed = { open: !!document.getElementById('kt-todo-modal-overlay'), title: title.value, count: store.activeData.localTodos.length, message: document.querySelector('.edit-save-error').textContent };
            store.writeSaveSnapshot = write;
            await app.saveKanbanTodoFromModal();
            return { before, failed, after: store.activeData.localTodos.length, closed: !document.getElementById('kt-todo-modal-overlay'), drafts: Object.keys(localStorage).filter(k => k.startsWith('maintenance-edit-draft-v1:')).length };
        })()`);
        assert.equal(result.failed.open, true); assert.equal(result.failed.title, 'retry-todo'); assert.equal(result.failed.count, result.before);
        assert.match(result.failed.message, /simulated quota/); assert.equal(result.after, result.before + 1); assert.equal(result.closed, true); assert.equal(result.drafts, 0);
    });
    await t.test('history fields, parts and photos restore after reload', async () => {
        await page.evaluate(`(async () => {
            await store.runAtomicSaveBatch(() => { store.activeData.machines.push({ id:'draft-machine', name:'下書き機械', model:'A', lineNo:'1' }); store.activeData.history.push({ id:'draft-history', machineId:'draft-machine', date:'2026-11-15', errorContent:'元の記録', photos:[], replacedParts:[], workers:[], isSudden:true, lineNo:'1' }); });
            await app.openHistoryEditForm('draft-history'); await Promise.resolve();
            document.getElementById('e-notes').value = '復元する作業内容';
            app.addPartRow({name:'部品', model:'P1', count:2, unit:'個'}, true);
            app._tempPhotos = ['data:image/png;base64,AQID'];
            document.getElementById('e-notes').dispatchEvent(new Event('input', {bubbles:true}));
        })()`);
        await reloadApp(page, 'draft reload');
        const restored = await page.evaluate(`(async () => {
            await app.openHistoryEditForm('draft-history'); await Promise.resolve();
            const before = document.getElementById('e-notes').value;
            [...document.querySelectorAll('.edit-safety-note button')].find(b => b.textContent === '下書きを復元').click();
            return {before, notes:document.getElementById('e-notes').value, part:document.querySelector('#s-parts-container .p-name').value, count:document.querySelector('#s-parts-container .p-count').value, photos:app._tempPhotos};
        })()`);
        assert.notEqual(restored.before, restored.notes); assert.equal(restored.notes, '復元する作業内容'); assert.equal(restored.part, '部品'); assert.equal(restored.count, '2'); assert.deepEqual(restored.photos, ['data:image/png;base64,AQID']);
        await page.evaluate('app.closeModal()');
    });
    await t.test('structural errors identify department and record and allow reviewed correction', async () => {
        const result = await page.evaluate(`(async () => {
            store.activeData.history.find(h => h.id === 'draft-history').photos = {};
            let error; try { await store.save(); } catch(e) { error=e; }
            app.openSaveStructureIssues(error);
            const d=document.querySelector('.edit-safety-dialog'); const label=d.querySelector('summary').textContent;
            const click=text=>[...d.querySelectorAll('button')].find(b=>b.textContent===text).click();
            click('修正前のデータをファイルに退避');
            d.querySelector('textarea').value='[]'; click('この修正を仮適用'); click('修正内容を保存');
            await new Promise(r=>setTimeout(r,300));
            const answer={label, valid:Array.isArray(store.activeData.history.find(h=>h.id==='draft-history').photos), text:d.textContent}; d.close(); return answer;
        })()`);
        assert.match(result.label, /初期部署.*メンテナンス履歴.*元の記録.*添付写真/); assert.equal(result.valid, true); assert.match(result.text, /修正を保存しました/);
    });
    await t.test('a stale second tab cannot overwrite an IndexedDB commit', async () => {
        const other = await harness.newPage();
        try {
            await page.evaluate("(async()=>{store.activeData.memos['concurrency']='new-value';await store.save()})()");
            const result = await other.evaluate("(async()=>{store.activeData.memos['stale']='old-tab';try{await store.save();return 'unexpected success'}catch(e){return e.code}})()");
            assert.equal(result, 'SAVE_CONFLICT');
            await reloadApp(page,'verify winning state');
            assert.deepEqual(await page.evaluate("({newValue:store.activeData.memos['concurrency'],hasStale:'stale' in store.activeData.memos})"), {newValue:'new-value',hasStale:false});
        } finally { await other.close(); }
    });
    await t.test('simultaneous localStorage fallback saves have one winner', async () => {
        const other = await harness.newPage();
        try {
            const setup="store.saveTarget='localStorage';store._saveBases.localStorage=localStorage.getItem(store.STORAGE_KEY);";
            await page.evaluate(setup); await other.evaluate(setup);
            const save=marker=>`(async()=>{store.activeData.memos['race']='${marker}';try{await store.save();return 'ok'}catch(e){return e.code}})()`;
            const results=await Promise.all([page.evaluate(save('one')),other.evaluate(save('two'))]);
            assert.deepEqual(results.sort(), ['SAVE_CONFLICT','ok']);
        } finally { await other.close(); }
    });
});

test('service worker update banner clears after update or a normal reload into the new build', { timeout: 120000 }, async () => {
    const harness = await launchHarness({ updateBuilds: true });
    const { page } = harness;
    let other;
    try {
        await page.waitFor('Boolean(navigator.serviceWorker.controller)', 'initial worker');
        await page.evaluate("(async()=>{store.activeData.memos['update-proof']='保存データは残る';await store.save()})()");
        harness.deployBuild('test-new');
        await page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
        await page.waitFor("Boolean(document.getElementById('maintenance-update-banner'))", 'actual new build banner');
        const before = await page.evaluate('performance.timeOrigin');
        await page.evaluate("window.confirm=()=>true;document.querySelector('#maintenance-update-banner button').click()");
        await page.waitFor(`performance.timeOrigin !== ${before} && Boolean(window.app)`, 'update reload');
        await page.waitFor("!document.getElementById('maintenance-update-banner') && document.querySelector('meta[name=maintenance-build]').content==='test-new'", 'no repeated update notice');
        await reloadApp(page, 'second reload after update');
        await page.waitFor('navigator.serviceWorker.getRegistration().then(r=>!r.waiting)', 'activated worker');
        assert.equal(await page.evaluate("Boolean(document.getElementById('maintenance-update-banner'))"), false);
        assert.equal(await page.evaluate("store.activeData.memos['update-proof']"), '保存データは残る');

        // Keep another app tab alive so a browser refresh cannot auto-activate the waiting worker.
        other = await harness.newPage();
        harness.deployBuild('test-next');
        await page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
        await page.waitFor("Boolean(document.getElementById('maintenance-update-banner'))", 'next actual update');
        await reloadApp(page, 'normal browser refresh with another tab');
        await page.waitFor("document.querySelector('meta[name=maintenance-build]').content==='test-next'", 'latest page loaded');
        await sleep(600);
        assert.equal(await page.evaluate("Boolean(document.getElementById('maintenance-update-banner'))"), false, 'a page already at the waiting build is current');
        assert.equal(await page.evaluate('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)'), true, 'old tab remains protected');
        await other.close(); other = null;
        await reloadApp(page, 'align worker after other tab closes');
        await page.waitFor('navigator.serviceWorker.getRegistration().then(r=>!r.waiting)', 'quiet activation of matching build');
        await sleep(300);
        assert.equal(await page.evaluate("Boolean(document.getElementById('maintenance-update-banner'))"), false);
    } finally { if (other) await other.close(); await harness.close(); }
});

test('workspace improvements: equipment, today actions, saved searches, forms, evidence and responsive layout', { timeout: 180000 }, async t => {
    const harness = await launchHarness(); t.after(() => harness.close());
    const { page } = harness;
    await page.evaluate(`(async () => {
        await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
        const today = app.getLocalDateString();
        await store.runAtomicSaveBatch(() => {
            store.activeData.machineCategories = ['包装機'];
            store.activeData.machines = [{id:'ws-machine',name:'テスト包装機',model:'PK-1',lineNo:'1',category:'包装機'}];
            store.activeData.tasks = [{id:'ws-task',machineId:'ws-machine',content:'定期点検',periodDays:7,startDate:today,workers:['田中']}];
            store.activeData.history = [{id:'ws-history',machineId:'ws-machine',date:today,lineNo:'1',machineCategory:'包装機',errorContent:'ベルト交換',cause:'摩耗',notes:'交換して動作確認',workTime:30,workers:['田中','鈴木'],category:'parts',isSudden:true,photos:[],replacedParts:[]}];
        });
        app.updateDataLists();
    })()`);
    await t.test('machine chart exposes history, next occurrence and its completion form', async () => {
        const result = await page.evaluate(`(() => {
            app.openEquipmentWorkspace('ws-machine');
            const text = document.getElementById('modal-content').textContent;
            [...document.querySelectorAll('#modal-content button')].find(b=>b.textContent==='完了を記録').click();
            return {text,type:document.getElementById('modal-container').dataset.modalType,workers:document.getElementById('c-workers').value};
        })()`);
        assert.match(result.text,/ベルト交換/); assert.match(result.text,/次回のメンテ予定/); assert.equal(result.type,'complete'); assert.equal(result.workers,'田中');
        await page.evaluate('app.closeModal()');
    });
    await t.test('today filters show the real scheduled occurrence and saving removes it', async () => {
        const before = await page.evaluate(`(() => {
            app.switchView('dashboard'); app.setTodayWorkspaceFilter('line','1'); app.setTodayWorkspaceFilter('worker','田中');
            const count=app.getTodayActionSummary().todayTasks.length;
            document.querySelector('.today-scheduled-list [data-task-id="ws-task"]').click();
            document.getElementById('c-work-time').value='10'; document.getElementById('c-category').value='clean';
            return {count,valid:document.getElementById('complete-form').checkValidity(),invalid:[...document.querySelectorAll('#complete-form :invalid')].map(n=>({id:n.id,value:n.value,options:[...(n.options||[])].map(o=>o.value)}))};
        })()`);
        assert.equal(before.count,1); assert.equal(before.valid,true,JSON.stringify(before));
        await page.evaluate("app.saveModalData('complete')");
        assert.equal(await page.evaluate('app.getTodayActionSummary().todayTasks.length'),0);
        assert.equal(await page.evaluate("store.activeData.history.filter(h=>h.taskId==='ws-task').length"),1);
        await page.evaluate("app.setTodayWorkspaceFilter('line','all'); app.setTodayWorkspaceFilter('worker','all')");
    });
    await t.test('named searches restore query, line, period and scope after reload', async () => {
        await page.evaluate(`(() => {
            app.switchView('history');
            document.getElementById('global-search').value='ベルト'; document.getElementById('global-search').dispatchEvent(new Event('input',{bubbles:true}));
            document.getElementById('hist-filter-period').value='all'; document.getElementById('hist-filter-line').value='1';
            app.saveNamedSearch('包装機のベルト');
        })()`);
        await reloadApp(page,'saved search persists');
        await page.evaluate("app.applyNamedSearch('包装機のベルト')");
        assert.deepEqual(await page.evaluate("({view:app.currentView,q:document.getElementById('global-search').value,line:document.getElementById('hist-filter-line').value,period:document.getElementById('hist-filter-period').value,scope:document.getElementById('search-scope').value})"),{view:'history',q:'ベルト',line:'1',period:'all',scope:'view'});
        await page.evaluate(`(() => { document.getElementById('search-scope').value='all'; app.updateSearchScope(); document.getElementById('notebook-search').value='ベルト'; document.getElementById('notebook-search-period').value='this_month'; app.saveNamedSearch('全体のベルト'); })()`);
        await page.evaluate("app.applyNamedSearch('全体のベルト')");
        assert.equal(await page.evaluate("document.getElementById('modal-container').dataset.modalType"),'shift-notebook-search');
        assert.equal(await page.evaluate("document.getElementById('notebook-search-period').value"),'this_month');
        await page.evaluate('app.closeModal()');
    });
    await t.test('organized forms keep required fields visible and reuse only blank values', async () => {
        const result = await page.evaluate(`(() => {
            app.openSuddenRecordModal(); document.getElementById('s-machine-id').value='ws-machine'; app.onSuddenMachineChange('ws-machine');
            document.getElementById('s-machine-id').dispatchEvent(new Event('change',{bubbles:true}));
            document.getElementById('s-notes').value='今回の処置'; document.getElementById('record-reuse-select').value='ws-history';
            document.getElementById('record-reuse-select').dispatchEvent(new Event('change',{bubbles:true}));
            document.querySelector('.record-reuse button').click();
            return {cause:document.getElementById('s-cause').value,notes:document.getElementById('s-notes').value,required:[...document.querySelectorAll('#sudden-form [required]')].every(f=>!f.closest('details')||f.closest('details').open),open:document.querySelector('.maintenance-form-details').open};
        })()`);
        assert.equal(result.cause,'摩耗'); assert.equal(result.notes,'今回の処置'); assert.equal(result.required,true); assert.equal(result.open,true);
        await page.evaluate('app.closeModal()');
    });
    await t.test('worktime numbers drill into the exact records including multiperson contribution', async () => {
        const result = await page.evaluate(`(() => {
            app.switchView('worktime'); document.getElementById('worktime-filter-period').value='all'; app.saveWorkTimePeriodSelection(); app.setWorkTimeGroup('worker');
            const data=app._workTimeEvidenceContext;
            const sum=app.getWorkTimeEvidence(data.history,data.results,data.groupBy,data.machines).total;
            document.querySelector('.worktime-evidence-number').click();
            return {sum,text:document.getElementById('modal-content').textContent,type:document.getElementById('modal-container').dataset.modalType};
        })()`);
        assert.equal(result.sum,70); assert.equal(result.type,'evidence-records'); assert.match(result.text,/集計への加算/);
        await page.evaluate('app.closeModal()');
    });
    await t.test('mobile and 200 percent equivalent viewport keep the new controls and forms usable', async () => {
        for (const width of [390,640]) {
            await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:width===640?2:1,mobile:false});
            await page.evaluate("app.switchView('history'); document.getElementById('search-scope').value='view'; app.updateSearchScope(); app.openSuddenRecordModal()");
            await page.evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
            const layout = await page.evaluate(`(() => {
                const dialog=document.getElementById('modal-container'), form=document.getElementById('sudden-form'), bar=document.querySelector('.header-search-workspace');
                const overflow=[...form.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().width && n.getBoundingClientRect().right>form.getBoundingClientRect().right+2).slice(0,8).map(n=>({tag:n.tagName,id:n.id,width:n.getBoundingClientRect().width}));
                return {viewport:innerWidth,dialogRight:dialog.getBoundingClientRect().right,dialogLeft:dialog.getBoundingClientRect().left,formWidth:form.clientWidth,formScroll:form.scrollWidth,barLeft:bar.getBoundingClientRect().left,barRight:bar.getBoundingClientRect().right,scopeWidth:document.getElementById('search-scope').getBoundingClientRect().width,overflow};
            })()`);
            assert.ok(layout.dialogLeft>=-1 && layout.dialogRight<=width+1,JSON.stringify(layout));
            assert.ok(layout.formScroll<=layout.formWidth+2,JSON.stringify(layout));
            assert.ok(layout.barLeft<20 && layout.barRight<=width+1 && layout.scopeWidth>30,JSON.stringify(layout));
            await page.evaluate('app.closeModal()');
        }
    });
    await t.test('ten thousand real records render a bounded evidence page and reconcile the worktime table', async () => {
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        const result = await page.evaluate(`(() => {
            const saved = store.activeData.history;
            const records = Array.from({length:10000},(_,i)=>({...saved[0],id:'bulk-'+i,workers:['田中','鈴木'],workTime:30}));
            try {
                store.activeData.history=records;
                const start=performance.now(); app.switchView('worktime'); app.renderWorkTime('');
                const c=app._workTimeEvidenceContext, evidence=app.getWorkTimeEvidence(c.history,c.results,c.groupBy,c.machines);
                app.openWorkTimeEvidence();
                const rendered=document.querySelectorAll('#modal-content .workspace-row').length;
                const text=document.querySelector('#modal-content .workspace-toolbar').textContent;
                return {total:evidence.total,rendered,text,ms:performance.now()-start};
            } finally { store.activeData.history=saved; app.closeModal(); }
        })()`);
        assert.equal(result.total,600000); assert.equal(result.rendered,50); assert.match(result.text,/200 ページ・全 10000 件/);
        assert.ok(result.ms<8000,JSON.stringify(result));
        t.diagnostic(`10,000 records: ${Math.round(result.ms)} ms, 50 visible evidence rows`);
    });
    await t.test('compact search collapses without clearing input and machine chart buttons remain horizontal', async () => {
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        await page.evaluate("app.switchView('machines'); app.machineMaintenanceListMode=false; document.getElementById('global-search').value=''; app.renderMachines(); document.getElementById('search-scope').value='all'; app.updateSearchScope()");
        await page.evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
        const sizes = await page.evaluate(`(() => {
            const bar=document.querySelector('.header-search-workspace'), chart=document.querySelector('.machine-card-chart-link'), edit=document.querySelector('.machine-card-actions .edit-btn');
            const openHeight=bar.getBoundingClientRect().height;
            document.querySelector('.saved-search-controls').open=true;
            const panelHeight=bar.getBoundingClientRect().height;
            const savedName=document.getElementById('saved-search-name'), fieldRect=savedName.getBoundingClientRect();
            const panelAccessible=document.elementFromPoint(fieldRect.left+fieldRect.width/2,fieldRect.top+fieldRect.height/2)===savedName;
            document.getElementById('notebook-search').value='保持する検索';
            document.getElementById('search-workspace-toggle').click();
            const folded={height:bar.getBoundingClientRect().height,hidden:document.getElementById('search-workspace-controls').hidden,expanded:document.getElementById('search-workspace-toggle').getAttribute('aria-expanded')};
            document.getElementById('search-workspace-toggle').click();
            const text=document.getElementById('notebook-search').value;
            document.getElementById('search-workspace-toggle').click();
            const a=chart.getBoundingClientRect(), b=edit.getBoundingClientRect();
            return {openHeight,panelHeight,panelAccessible,folded,text,chartHeight:a.height,chartWidth:a.width,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
        })()`);
        assert.ok(sizes.openHeight<=48,JSON.stringify(sizes)); assert.equal(sizes.panelHeight,sizes.openHeight);
        assert.equal(sizes.panelAccessible,true);
        assert.ok(sizes.folded.height<=32,JSON.stringify(sizes)); assert.equal(sizes.folded.hidden,true); assert.equal(sizes.folded.expanded,'false'); assert.equal(sizes.text,'保持する検索');
        assert.ok(sizes.chartHeight<=32 && sizes.chartWidth>sizes.chartHeight*2,JSON.stringify(sizes)); assert.equal(sizes.overlap,false);
        await reloadApp(page,'collapsed search preference');
        assert.equal(await page.evaluate("document.getElementById('search-workspace-controls').hidden"),true);
        await page.evaluate('app.setSearchWorkspaceCollapsed(false)');
    });
});


test('integrity refinements: exact exports, strict CSV, selected worksheets, stock deletion and legacy reloads', {timeout:180000}, async t=>{
    const h=await launchHarness();t.after(()=>h.close());const {page}=h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook();await maintenanceLazyFeatures.loadPhotos();
        window.integrityImport=async(text)=>{
            app.openHistoryImportModal();const files=new DataTransfer();files.items.add(new File([text],'integrity.csv'));document.getElementById('hist-csv-upload').files=files.files;
            const confirm=window.confirm;try{window.confirm=()=>true;await app.processHistoryImportCSV();}finally{window.confirm=confirm;}
        };
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machines=[{id:'if1',name:'対象ポンプ',model:'P1',lineNo:'1',category:'循環'},{id:'if2',name:'他ポンプ',model:'P2',lineNo:'2',category:'電気'}];
            store.activeData.history=[];store.activeData.tasks=[];store.activeData.partsMaster=[];store.activeData.partStockMovements=[];store.activeData.historyImportLogs=[];
        });app.updateDataLists();
    })()`);
    await t.test('every history filter exports the same records and count shown in the screen',async()=>{
        const result=await page.evaluate(`(async()=>{
            const common={machineId:'if1',date:'2026-11-01',isSudden:true,workers:['田中'],workTime:10,category:'parts',notes:'処置',cause:'原因',replacedParts:[],photos:[]};
            await store.runAtomicSaveBatch(()=>store.activeData.history=[
                {...common,id:'a',errorContent:'対象a',cause:'',guide:'手順',replacedParts:[{name:'部品',model:'',count:1,unit:'個',price:5}],photos:[{source:'photoManagerVideo',videoId:'v'}]},
                {...common,id:'b',errorContent:'対象b',machineId:'if2',isDokatei:true,notes:''},
                {...common,id:'c',errorContent:'対象c',isSudden:false,historyType:'periodic'},
                {...common,id:'d',errorContent:'対象d',isSudden:false,isSingleMaintenance:true},
                {...common,id:'g',errorContent:'手順書',isManualGuide:true}
            ]);
            app.switchView('history');app.updateDataLists();const result=[];
            const cases=[
                ['line',()=>document.getElementById('hist-filter-line').value='2'],
                ['parts',()=>document.getElementById('hist-filter-parts').checked=true],
                ['photos',()=>document.getElementById('hist-filter-photos').checked=true],
                ['guide',()=>document.getElementById('hist-filter-guide').checked=true],
                ['category',()=>app.machineCategoryFilter='電気'],
                ['model',()=>app.modelFilter='P2'],
                ['worker',()=>app.workerFilter='田中'],
                ['missing',()=>app.historyMissingDetailFilter='cause'],
                ['recurrence',()=>app.historyRecurrenceFrequencyFilter={ids:['b'],kind:'single',label:'選択履歴'}],
                ['type',()=>document.getElementById('hist-filter-type').value='suddenBundle'],
                ['query',()=>document.getElementById('global-search').value='対象c'],
                ['combined',()=>{document.getElementById('hist-filter-line').value='1';document.getElementById('hist-filter-parts').checked=true;app.historyMissingDetailFilter='cause';}],
                ['empty',()=>app.workerFilter='存在しない作業者']
            ];
            for(const [name,configure] of cases){
                app.clearCurrentViewSearchAndFilters();document.getElementById('hist-filter-period').value='all';configure();app.renderHistory();
                const visible=[...document.querySelectorAll('#view-history tr[data-history-id]')].map(tr=>store.activeData.history.find(r=>r.id===tr.dataset.historyId).errorContent);
                let csv;const original=app.downloadCSV;try{app.downloadCSV=(n,v)=>csv=v;app.exportHistoryAsCSV();}finally{app.downloadCSV=original;}
                const rows=app.parseCSV(csv);result.push({name,visible,exported:rows.slice(1).map(row=>row[6]),button:document.getElementById('history-export-csv').textContent});
            }
            return result;
        })()`);
        const expected={line:['対象b'],parts:['対象a'],photos:['対象a'],guide:['対象a'],category:['対象b'],model:['対象b'],worker:['対象a','対象b','対象c','対象d'],missing:['対象a'],recurrence:['対象b'],type:['対象a','対象b'],query:['対象c'],combined:['対象a'],empty:[]};
        for(const row of result){assert.deepEqual(row.exported,row.visible,row.name);assert.deepEqual([...row.exported].sort(),expected[row.name],row.name);assert.match(row.button,new RegExp(row.exported.length+'件'));}
    });
    await t.test('malformed CSV shows row diagnostics and writes neither records nor provisional masters',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.clearCurrentViewSearchAndFilters();const before=JSON.stringify(store.activeData),messages=[];
            for(const text of ['日付,機械名,作業内容\\n2026-11-01,新規機械,"閉じない\\n2026-11-02,別機械,確認','日付,機械名,作業内容\\n2026-11-01,新規機械,交換,余分']){
                await integrityImport(text.replaceAll('\\\\n','\\n'));
                const dialog=document.querySelector('.history-import-errors');messages.push(dialog.textContent);dialog.close();app.closeModal();
            }
            return {unchanged:JSON.stringify(store.activeData)===before,messages};
        })()`);
        assert.equal(result.unchanged,true);assert.match(result.messages[0],/引用符が閉じていません/);assert.match(result.messages[1],/見出しは3列/);
    });
    await t.test('imported history deletion and immediate undo preserve stock, then batch undo reverses only edited stock',async()=>{
        const result=await page.evaluate(`(async()=>{
            await store.runAtomicSaveBatch(()=>store.activeData.partsMaster=[{name:'シール',model:'',stock:10,price:2,unit:'個'}]);
            await integrityImport('日付,機械名,型式,作業内容,部品名,部品数量,部品単位\\n2026-11-10,対象ポンプ,P1,削除検証,シール,2,個'.replaceAll('\\\\n','\\n'));
            const record=store.activeData.history.find(r=>r.errorContent==='削除検証'),log=store.activeData.historyImportLogs[0];
            let undo;const notice=app.showHistoryDeleteUndoNotice,confirm=window.confirm;
            try{
                app.showHistoryDeleteUndoNotice=(r,action)=>undo=action;window.confirm=()=>true;
                await app.deleteHistoryEntry(record.id);const deleted=store.getPartMaster('シール','').stock;await undo();const restored=store.getPartMaster('シール','').stock;
                await store.runAtomicSaveBatch(()=>{store.adjustStock('シール','',-1,{unit:'個',source:'maintenance-edit',sourceId:record.id});store.activeData.history.find(r=>r.id===record.id).replacedParts[0].count=3;});
                await app.deleteHistoryEntry(record.id);const afterEditDelete=store.getPartMaster('シール','').stock;await undo();
                const plan=app.createHistoryImportUndoPlan(log.id);plan.selected.add(record.id);await app.commitHistoryImportUndo(plan);
                return {deleted,restored,afterEditDelete,batchStock:store.getPartMaster('シール','').stock,exists:store.activeData.history.some(r=>r.id===record.id)};
            }finally{app.showHistoryDeleteUndoNotice=notice;window.confirm=confirm;app.closeModal();}
        })()`);
        assert.deepEqual(result,{deleted:10,restored:10,afterEditDelete:10,batchStock:10,exists:false});
    });
    await t.test('workbook relationships preserve sheet names and selection previews the exact rows on mobile',async()=>{
        const sheet=(name,date)=>'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">'+['日付','機械名','型式','作業内容'].map((s,i)=>`<c r="${String.fromCharCode(65+i)}1" t="inlineStr"><is><t>${s}</t></is></c>`).join('')+'</row><row r="8"><c r="A8"><v>'+date+'</v></c><c r="B8" t="inlineStr"><is><t>対象ポンプ</t></is></c><c r="C8" t="inlineStr"><is><t>P1</t></is></c><c r="D8" t="inlineStr"><is><t>'+name+'</t></is></c></row></sheetData></worksheet>';
        const bytes=makeWorkbookFixture({
            'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="1"/><sheets><sheet name="使い方" sheetId="9" r:id="cover"/><sheet name="先月の作業" sheetId="7" r:id="previous"/><sheet name="今月の作業" sheetId="3" r:id="current"/></sheets></workbook>',
            'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="cover" Target="worksheets/cover.xml"/><Relationship Id="previous" Target="worksheets/sheet7.xml"/><Relationship Id="current" Target="/xl/worksheets/sheet3.xml"/></Relationships>',
            'xl/worksheets/cover.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>入力方法の説明</t></is></c></row></sheetData></worksheet>',
            'xl/worksheets/sheet7.xml':sheet('先月の点検',44865),'xl/worksheets/sheet3.xml':sheet('今月の点検',44866)
        });
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
        const result=await page.evaluate(`(async()=>{
            app.openHistoryImportModal();const files=new DataTransfer();files.items.add(new File([Uint8Array.from(atob('${bytes}'),c=>c.charCodeAt(0))],'multi.xlsx'));document.getElementById('hist-csv-upload').files=files.files;
            await app.refreshHistoryImportPreview();let select=document.getElementById('hist-import-sheet');const names=[...select.options].map(o=>o.textContent),recommended=select.selectedOptions[0].textContent;
            select.value='xl/worksheets/cover.xml';select.onchange();const cover=document.getElementById('hist-csv-preview').textContent;
            const before=store.activeData.history.length,confirm=window.confirm;window.confirm=()=>true;
            try{
                await app.processHistoryImportCSV();const blocked=store.activeData.history.length===before,errors=document.querySelector('.history-import-errors').textContent;document.querySelector('.history-import-errors').close();
                select=document.getElementById('hist-import-sheet');select.value='xl/worksheets/sheet3.xml';select.onchange();
                const preview=document.getElementById('hist-csv-preview').textContent,box=document.getElementById('hist-import-sheet').getBoundingClientRect();
                await app.processHistoryImportCSV();return {names,recommended,cover,blocked,errors,preview,fits:box.left>=0&&box.right<=innerWidth,record:store.activeData.history.find(r=>r.errorContent==='今月の点検'),wrong:store.activeData.history.some(r=>r.errorContent==='先月の点検')};
            }finally{window.confirm=confirm;}
        })()`);
        assert.deepEqual(result.names,['使い方','先月の作業','今月の作業']);assert.equal(result.recommended,'先月の作業');assert.equal(result.blocked,true);assert.match(result.errors,/取込シート/);assert.match(result.cover,/別のシート/);assert.match(result.preview,/2026-11-02/);assert.match(result.preview,/今月の点検/);assert.equal(result.fits,true);assert.equal(result.record.date,'2026-11-02');assert.equal(result.wrong,false);
        await page.send('Emulation.clearDeviceMetricsOverride');
    });
    await t.test('legacy kg records and import-undo baselines keep cost through repeated persistence reloads',async()=>{
        await page.evaluate(`(async()=>{
            await store.runAtomicSaveBatch(()=>{
                store.activeData.partsMaster=[{name:'旧油',model:'',unit:'kg',stock:10,minStock:1,price:1500,priceRaw:'1500'}];
                const record={id:'legacy-weight',machineId:'if1',date:'2026-11-15',isSudden:true,errorContent:'旧データ確認',workTime:0,workers:[],importBatchId:'legacy-batch',replacedParts:[{name:'旧油',model:'',unit:'kg',count:2,price:1500}]};
                store.activeData.history=[record];store.activeData.partStockMovements=[{id:'weight-movement',partName:'旧油',partModel:'',unit:'kg',delta:-.5,quantity:.5,before:10.5,after:10,source:'manual',sourceId:''}];
                store.activeData.historyImportLogs=[{id:'legacy-batch',undo:{version:1,records:JSON.parse(JSON.stringify([record])),machines:[],partsMaster:[]}}];
            });
        })()`);
        for(let i=0;i<2;i++){
            await reloadApp(page,'legacy weight reload');
            const result=await page.evaluate(`(async()=>{const record=store.activeData.history.find(r=>r.id==='legacy-weight');const result={cost:app.calculateHistoryPartCost(record),count:record.replacedParts[0].count,price:record.replacedParts[0].price,stock:store.activeData.partsMaster[0].stock,delta:store.activeData.partStockMovements[0].delta,changed:app.getHistoryImportUndoEntries(store.activeData.historyImportLogs[0])[0].changed};await store.save();return result;})()`);
            assert.deepEqual(result,{cost:3000,count:2000,price:1.5,stock:10000,delta:-500,changed:false});
        }
    });
});


test('image editor: awaited saves, redo, persistent versions, comparison and export preview', {timeout:180000}, async t=>{
    const harness=await launchHarness();t.after(()=>harness.close());const {page}=harness;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadPhotoEffects();
        const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1000;const c=canvas.getContext('2d');c.fillStyle='#0f766e';c.fillRect(300,250,1000,500);
        await store.runAtomicSaveBatch(()=>{window.imageTestId=app.addPhotoManagerLibraryImage(canvas.toDataURL('image/png'),'画像検証').id;});
        await app.openPhotoManagerEditor(imageTestId);
        window.imageTestAddMark=(x=30)=>{app.pushShiftPhotoCompareUndo();const wrap=document.querySelector('.shift-photo-compare-image-wrap');wrap.querySelector('.shift-photo-compare-mark-layer').insertAdjacentHTML('beforeend',app.getShiftPhotoCompareMarkHtml({mode:'circle',x,y:50,size:60,color:'#dc2626'}));app.syncShiftPhotoCompareMarks(wrap);};
        window.imageTestFlush=async()=>{await Promise.allSettled([...(app._shiftPhotoCompareContext?.imagePendingSaves||[])]);};
        window.imageTestCount=()=>document.querySelectorAll('.shift-photo-compare-image-wrap .shift-photo-compare-mark:not([data-animation-ghost="1"])').length;
    })()`);
    await t.test('save cannot report success before disk completion and failed close keeps the editor retryable',async()=>{
        const result=await page.evaluate(`(async()=>{
            const write=store.writeSaveSnapshot;let release;const gate=new Promise(r=>release=r);let done=false;
            try{
                store.writeSaveSnapshot=async function(...args){await gate;return write.apply(this,args);};
                imageTestAddMark();const saving=app.saveShiftPhotoCompare().then(result=>{done=true;return result;});
                await new Promise(r=>setTimeout(r,60));const pending={done,text:document.querySelector('.shift-photo-compare-save').textContent,status:document.getElementById('image-edit-save-status').textContent};
                release();const saved=await saving;
                store.writeSaveSnapshot=async()=>{throw Error('画像保存の失敗テスト');};
                imageTestAddMark(60);await imageTestFlush();const closed=await app.closeShiftPhotoCompare();
                const failed={closed,open:!!document.getElementById('shift-photo-compare-overlay'),count:imageTestCount(),status:document.getElementById('image-edit-save-status').textContent};
                store.writeSaveSnapshot=write;const retried=await app.saveShiftPhotoCompare();return {pending,saved,failed,retried};
            }finally{release?.();store.writeSaveSnapshot=write;}
        })()`);
        assert.equal(result.pending.done,false);assert.match(result.pending.text,/保存中/);assert.equal(result.saved,true);
        assert.deepEqual(result.failed,{closed:false,open:true,count:2,status:'保存失敗・再保存できます'});assert.equal(result.retried,true);
    });
    await t.test('undo and redo preserve annotation data and shortcuts leave text input and IME alone',async()=>{
        const result=await page.evaluate(`(async()=>{
            const counts=[imageTestCount()];document.querySelector('.shift-photo-compare-undo').click();await imageTestFlush();counts.push(imageTestCount());
            document.querySelector('.shift-photo-compare-redo').click();await imageTestFlush();counts.push(imageTestCount());
            document.getElementById('shift-photo-compare-overlay').focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));await imageTestFlush();counts.push(imageTestCount());
            document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true}));await imageTestFlush();counts.push(imageTestCount());
            const input=document.getElementById('shift-photo-compare-text-input');input.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));counts.push(imageTestCount());
            document.getElementById('shift-photo-compare-overlay').focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,isComposing:true,bubbles:true}));counts.push(imageTestCount());
            app.undoShiftPhotoCompareMarkChange();imageTestAddMark(80);await imageTestFlush();const reset=document.querySelector('.shift-photo-compare-redo').disabled;await app.saveShiftPhotoCompare();return {counts,reset};
        })()`);
        assert.deepEqual(result.counts,[2,1,2,1,2,2,2]);assert.equal(result.reset,true);
    });
    await t.test('comparison is read-only and does not rewrite the current image or its saved data',async()=>{
        const result=await page.evaluate(`(async()=>{
            await imageTestFlush();const before=JSON.stringify(store.activeData),count=imageTestCount();
            document.getElementById('image-edit-compare').click();const showing=imageTestCount(),readonly=document.querySelector('.shift-photo-compare-grid').inert;
            app.undoShiftPhotoCompareMarkChange();const ignored=imageTestCount();document.getElementById('image-edit-compare').click();
            return {showing,readonly,ignored,restored:imageTestCount()===count,unchanged:before===JSON.stringify(store.activeData)};
        })()`);
        assert.deepEqual(result,{showing:0,readonly:true,ignored:0,restored:true,unchanged:true});
    });
    await t.test('saved versions survive close and reload, and restoring a version can itself be undone',async()=>{
        await page.evaluate('(async()=>{await app.saveShiftPhotoCompare();await app.closeShiftPhotoCompare();})()');
        await reloadApp(page,'image version reload');
        const result=await page.evaluate(`(async()=>{
            await maintenanceLazyFeatures.loadPhotoEffects();const item=app.getPhotoManagerLibrary().find(p=>p.name==='画像検証');window.imageTestId=item.id;await app.openPhotoManagerEditor(item.id);
            app.updateShiftPhotoCompareCaption(0,'点検後 点検完了');await app.saveShiftPhotoCompare();
            const versions=app.getImageEditVersions(),before=app.captureImageEditSnapshot();app.openImageEditVersions();
            const buttons=[...document.querySelectorAll('.image-edit-version button')];buttons.at(-1).click();
            const restored=app.captureImageEditSnapshot(),restoredCaption=document.querySelector('.shift-photo-compare-caption-input').value;app.undoShiftPhotoCompareMarkChange();await app.saveShiftPhotoCompare();
            return {count:versions.length,restored:restored.wraps[0].marks.length,undo:app.captureImageEditSnapshot().wraps[0].marks.length,original:before.wraps[0].marks.length,captionRestored:restoredCaption===restored.wraps[0].caption,captionUndone:document.querySelector('.shift-photo-compare-caption-input').value,role:app._shiftPhotoCompareContext.photos[0].role};
        })()`);
        assert.ok(result.count>=3);assert.equal(result.restored,0);assert.equal(result.undo,result.original);assert.equal(result.original,2);assert.equal(result.captionRestored,true);assert.equal(result.captionUndone,'点検後 点検完了');assert.equal(result.role,'after');
    });
    await t.test('export preview matches PNG transparency, JPEG background, dimensions and downloaded bytes',async()=>{
        await page.evaluate(`(()=>{const item=app.findPhotoManagerItem(imageTestId);app.openPhotoManagerExportSettings([item]);})()`);
        await page.waitFor("document.querySelector('.image-export-dialog .image-edit-dialog-actions button:last-child')?.disabled===false",'image export preview');
        const png=await page.evaluate(`(async()=>{
            const dialog=document.querySelector('.image-export-dialog'),image=dialog.querySelector('img');await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d');c.drawImage(image,0,0);
            const output={width:image.naturalWidth,height:image.naturalHeight,alpha:c.getImageData(0,0,1,1).data[3],status:dialog.querySelector('[role=status]').textContent};
            const format=dialog.querySelector('[aria-label="形式"]'),size=dialog.querySelector('[aria-label="長辺の上限"]');format.value='jpeg';format.dispatchEvent(new Event('input'));size.value='1280';size.dispatchEvent(new Event('input'));return output;
        })()`);
        assert.equal(png.width,1920);assert.equal(png.height,960);assert.equal(png.alpha,0);assert.match(png.status,/1920.*960/);
        await page.waitFor("document.querySelector('.image-export-dialog .image-edit-dialog-actions button:last-child')?.disabled===false",'JPEG export preview');
        const jpeg=await page.evaluate(`(async()=>{
            const dialog=document.querySelector('.image-export-dialog'),image=dialog.querySelector('img');await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixel=[...c.getImageData(0,0,1,1).data];
            let captured;const download=app.downloadPhotoManagerBlob;try{app.downloadPhotoManagerBlob=(blob,name)=>captured={blob,name};await dialog.querySelector('.image-edit-dialog-actions button:last-child').onclick();}finally{app.downloadPhotoManagerBlob=download;}
            const bytes=new Uint8Array(await captured.blob.arrayBuffer());const output={pixel,width:image.naturalWidth,height:image.naturalHeight,mime:captured.blob.type,name:captured.name,signature:[bytes[0],bytes[1]]};dialog.close();return output;
        })()`);
        assert.deepEqual(jpeg.pixel,[255,255,255,255]);assert.equal(jpeg.width,1280);assert.equal(jpeg.height,640);assert.equal(jpeg.mime,'image/jpeg');assert.match(jpeg.name,/\.jpg$/);assert.deepEqual(jpeg.signature,[255,216]);
    });
    await t.test('bulk export uses the chosen format, unique names and a responsive preview',async()=>{
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
        await page.evaluate(`(()=>{const item=app.findPhotoManagerItem(imageTestId);app.openPhotoManagerExportSettings([item,item]);})()`);
        await page.waitFor("document.querySelector('.image-export-dialog .image-edit-dialog-actions button:last-child')?.disabled===false",'bulk preview');
        const result=await page.evaluate(`(async()=>{
            const dialog=document.querySelector('.image-export-dialog'),box=dialog.getBoundingClientRect();let captured;const download=app.downloadPhotoManagerBlob;
            try{app.downloadPhotoManagerBlob=(blob,name)=>captured={blob,name};await dialog.querySelector('.image-edit-dialog-actions button:last-child').onclick();}finally{app.downloadPhotoManagerBlob=download;}
            const entries=await app.readXlsxZipEntries(await captured.blob.arrayBuffer()),names=Object.keys(entries);const output={names,jpeg:names.every(n=>entries[n][0]===255&&entries[n][1]===216),fits:box.left>=0&&box.right<=innerWidth&&dialog.scrollWidth<=dialog.clientWidth,name:captured.name};dialog.close();return output;
        })()`);
        assert.equal(result.names.length,2);assert.equal(new Set(result.names).size,2);assert.ok(result.names.every(n=>n.endsWith('.jpg')));assert.equal(result.jpeg,true);assert.equal(result.fits,true);assert.match(result.name,/\.zip$/);
        await page.send('Emulation.clearDeviceMetricsOverride');
    });
    await t.test('global annotations persist and blank background undo survives a failed save and retry',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.pushShiftPhotoCompareUndo();const layer=document.querySelector('.shift-photo-compare-global-layer');layer.insertAdjacentHTML('beforeend',app.getShiftPhotoCompareMarkHtml({mode:'arrow',x:50,y:50,size:70,color:'#dc2626'}));app.syncShiftPhotoCompareGlobalMarks(layer);await app.saveShiftPhotoCompare();await app.closeShiftPhotoCompare();
            await app.openPhotoManagerEditor(imageTestId);const globals=app._shiftPhotoCompareContext.globalMarks.length;await app.closeShiftPhotoCompare();
            await app.openShiftPhotoCompareWithPhotos([app.createShiftPhotoCompareBlankBasePhoto()],{source:'photoManagerBlank',title:'背景検証'});
            app.setShiftPhotoCompareBlankBaseColor('#ff0000');app.undoShiftPhotoCompareMarkChange();const undone=app.getShiftPhotoCompareBlankBaseColor();app.redoShiftPhotoCompareMarkChange();const redone=app.getShiftPhotoCompareBlankBaseColor();
            const write=store.writeSaveSnapshot;let failed;
            try{store.writeSaveSnapshot=async()=>{throw Error('白紙保存失敗')};failed=await app.saveShiftPhotoCompare();}finally{store.writeSaveSnapshot=write;}
            const retained=!!document.getElementById('shift-photo-compare-overlay'),retry=await app.saveShiftPhotoCompare(),id=app._shiftPhotoCompareContext.photoManagerBlankEditItemId;
            const saved=app.getPhotoManagerLibrary().find(p=>p.id===id).photoCompareBlankEdit.blankBaseColor;await app.closeShiftPhotoCompare();await app.openPhotoManagerBlankEdit(id);
            return {globals,undone,redone,failed,retained,retry,saved,reopened:app.getShiftPhotoCompareBlankBaseColor(),versions:app.getImageEditVersions().length};
        })()`);
        assert.equal(result.globals,1);assert.equal(result.undone,'#ffffff');assert.equal(result.redone,'#ff0000');assert.equal(result.failed,false);assert.equal(result.retained,true);assert.equal(result.retry,true);assert.equal(result.saved,'#ff0000');assert.equal(result.reopened,'#ff0000');assert.ok(result.versions>=2);
    });
});
